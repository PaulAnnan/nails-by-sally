// webhook.js — minimal, zero-dependency GitHub push webhook listener.
//
// On a verified push to the tracked branch it runs deploy/deploy.sh, which
// pulls the latest code and reloads the app under PM2.
//
// Security: GitHub signs every delivery with HMAC-SHA256 using the secret
// you configure on both sides. We reject anything that doesn't match.
//
// Config via environment:
//   WEBHOOK_SECRET   shared secret, must match the GitHub webhook  (required)
//   WEBHOOK_PORT     port to listen on                             (default: 9000)
//   WEBHOOK_PATH     URL path GitHub posts to                      (default: /webhook)
//   BRANCH           branch to deploy on                           (default: main)
//
// Run it under PM2 so it stays up:
//   pm2 start deploy/webhook.js --name nails-webhook

import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SECRET = process.env.WEBHOOK_SECRET;
const PORT = Number(process.env.WEBHOOK_PORT || 9000);
const PATHNAME = process.env.WEBHOOK_PATH || '/webhook';
const BRANCH = process.env.BRANCH || 'main';

if (!SECRET) {
  console.error('FATAL: WEBHOOK_SECRET is not set. Refusing to start.');
  process.exit(1);
}

// Constant-time comparison of the delivered signature against our own HMAC.
function isValidSignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  const expected =
    'sha256=' + crypto.createHmac('sha256', SECRET).update(rawBody).digest('hex');
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function runDeploy() {
  console.log(`[${new Date().toISOString()}] Triggering deploy...`);
  const child = spawn('bash', [path.join(__dirname, 'deploy.sh')], {
    cwd: path.join(__dirname, '..'),
    env: process.env,
    detached: true,
    stdio: 'ignore',
  });
  child.unref(); // let the deploy finish even if this request cycle ends
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url.split('?')[0] !== PATHNAME) {
    res.writeHead(404);
    return res.end('Not found');
  }

  const chunks = [];
  let size = 0;
  req.on('data', (c) => {
    size += c.length;
    if (size > 5 * 1024 * 1024) req.destroy(); // 5MB cap, ignore junk
    chunks.push(c);
  });

  req.on('end', () => {
    const raw = Buffer.concat(chunks);

    if (!isValidSignature(raw, req.headers['x-hub-signature-256'])) {
      console.warn(`[${new Date().toISOString()}] Rejected: bad signature`);
      res.writeHead(401);
      return res.end('Invalid signature');
    }

    const event = req.headers['x-github-event'];
    if (event === 'ping') {
      res.writeHead(200);
      return res.end('pong');
    }
    if (event !== 'push') {
      res.writeHead(204);
      return res.end();
    }

    let payload;
    try {
      payload = JSON.parse(raw.toString('utf8'));
    } catch {
      res.writeHead(400);
      return res.end('Bad JSON');
    }

    // Respond immediately; deploy runs in the background.
    res.writeHead(200);
    res.end('OK');

    if (payload.ref === `refs/heads/${BRANCH}`) {
      runDeploy();
    } else {
      console.log(
        `[${new Date().toISOString()}] Ignoring push to ${payload.ref} (want refs/heads/${BRANCH})`
      );
    }
  });
});

server.listen(PORT, () => {
  console.log(`Webhook listener up on :${PORT}${PATHNAME} (deploying branch "${BRANCH}")`);
});
