# Auto-deploy on the Pi (GitHub webhook → PM2 reload)

When you push to **`main`**, GitHub pings a small listener on the Pi, which pulls
the new code and reloads the app under PM2. Zero-downtime, no manual SSH.

```
git push origin main  ──►  GitHub webhook  ──►  webhook.js (Pi)  ──►  deploy.sh  ──►  pm2 reload
```

## Files

| File          | Purpose                                                        |
|---------------|---------------------------------------------------------------|
| `deploy.sh`   | Pulls `origin/main`, `npm install` (only if the lockfile changed), `pm2 reload`. |
| `webhook.js`  | Zero-dependency listener that verifies GitHub's signature and runs `deploy.sh`.  |

---

## One-time setup on the Pi

Run these **on the Raspberry Pi**, inside the repo checkout.

### 1. Confirm the app's PM2 name

```bash
pm2 list
```

Note the **name** of your app process (the scripts assume `nails-by-sally`). If
it's different, pass `APP_NAME=...` in step 4 below.

### 2. Make the deploy script executable

```bash
chmod +x deploy/deploy.sh
```

### 3. Generate a webhook secret

Keep this — you'll paste the same value into GitHub in step 6.

```bash
openssl rand -hex 32
```

### 4. Start the webhook listener under PM2

Replace the secret with the one you just generated (and `APP_NAME` if yours differs):

```bash
WEBHOOK_SECRET='paste-your-secret-here' \
APP_NAME='nails-by-sally' \
BRANCH='main' \
pm2 start deploy/webhook.js --name nails-webhook
```

### 5. Make everything survive reboots

```bash
pm2 save
pm2 startup    # then run the sudo command it prints
```

### 6. Expose the webhook port to GitHub

GitHub needs to reach the Pi on the webhook port (**9000** by default). Pick one:

- **Cloudflare Tunnel (recommended — no router changes, no exposed IP):**
  ```bash
  cloudflared tunnel --url http://localhost:9000
  ```
  It prints a public `https://<random>.trycloudflare.com` URL. For a permanent
  URL, set up a named tunnel. Your webhook URL becomes `https://<...>/webhook`.

- **Router port-forward:** forward an external port to the Pi's `9000`, then use
  `http://YOUR_PUBLIC_IP:PORT/webhook`. Prefer HTTPS via a reverse proxy if you go this route.

### 7. Add the webhook in GitHub

Repo → **Settings → Webhooks → Add webhook**:

| Field         | Value                                             |
|---------------|---------------------------------------------------|
| Payload URL   | your public URL from step 6, ending in `/webhook` |
| Content type  | `application/json`                                |
| Secret        | the secret from step 3                            |
| Events        | **Just the `push` event**                         |

Save. GitHub sends a `ping` immediately — you should see a green check, and
`pong` in the Pi logs.

---

## Verifying & operating

```bash
pm2 logs nails-webhook          # watch the listener
tail -f deploy/logs/deploy.log  # watch deploys as they happen
```

Push a trivial commit to `main` and confirm the deploy log shows a new revision
and a PM2 reload.

### Notes
- `deploy.sh` does `git reset --hard origin/main`, so the Pi is always an exact
  mirror of `main`. **Never hand-edit code on the Pi** — changes get wiped. Your
  `.env` and `node_modules` are gitignored and are preserved.
- Native modules (`sharp`, `bcrypt`) only rebuild when the lockfile changes, so
  most deploys are fast.
- To deploy manually any time: `bash deploy/deploy.sh`
