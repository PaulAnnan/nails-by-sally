// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { SERVICES, getService } from "./data/services.js";
import path from "path";
import { fileURLToPath } from "url";

import webpush from "web-push";
import { Client, Environment, OrdersController } from "@paypal/paypal-server-sdk";
import nodemailer from "nodemailer";
import { buildNotificationPayload, sendPushToAll } from "./push-notifications.js";

// DynamoDB imports
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

// ESM-safe __dirname / __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();

/* ========= ENV ========= */
const {
  AWS_REGION,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  PORT = 4000,

  // Salon scheduling
  SALON_TZ = "America/Toronto",
  OPEN_TIME = "09:00",
  CLOSE_TIME = "18:00",
  SLOT_MINUTES = "30",

  // Auth
  JWT_SECRET,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,

  // Frontend origin for CORS/cookies
  CLIENT_ORIGIN = "http://localhost:5500",

  // PayPal
  PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET,
  PAYPAL_MODE = "sandbox", // "sandbox" or "live"
  DEPOSIT_PERCENTAGE = "25", // Default 25% deposit
  
  // Email
  EMAIL_USER,
  EMAIL_PASSWORD,
} = process.env;

/* ========= DynamoDB Setup ========= */
const APPOINTMENTS_TABLE = "NailsBySally_Appointments";
const ADMIN_USERS_TABLE = "NailsBySally_AdminUsers";

const dynamoClient = new DynamoDBClient({
  region: AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

const docClient = DynamoDBDocumentClient.from(dynamoClient);

/* ========= PayPal Setup ========= */
function getPayPalClient() {
  return new Client({
    clientCredentialsAuthCredentials: {
      oAuthClientId: PAYPAL_CLIENT_ID,
      oAuthClientSecret: PAYPAL_CLIENT_SECRET,
    },
    environment: PAYPAL_MODE === "live" ? Environment.Production : Environment.Sandbox,
  });
}

const paypalClient = PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET ? getPayPalClient() : null;


/* ========= EMAIL SETUP ========= */
let emailTransporter = null;

if (EMAIL_USER && EMAIL_PASSWORD) {
  emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASSWORD
    }
  });
  console.log('[EMAIL] ✅ Email configured');
} else {
  console.warn('[EMAIL] ⚠️  Email credentials not configured - confirmation emails will be disabled');
  console.warn('[EMAIL] Add EMAIL_USER and EMAIL_PASSWORD to .env');
}
/* ========= STARTUP SANITY CHECKS ========= */
if (!AWS_REGION || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
  console.error("[BOOT] Missing AWS credentials in .env");
  process.exit(1);
}
if (!JWT_SECRET || JWT_SECRET === "change-me") {
  console.error("[BOOT] Missing/weak JWT_SECRET in .env");
  process.exit(1);
}
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("[BOOT] Missing ADMIN_EMAIL or ADMIN_PASSWORD in .env");
  process.exit(1);
}
if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
  console.warn("[BOOT] ⚠️  PayPal credentials not configured - payments will be disabled");
  console.warn("[BOOT] Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to .env");
} else {
  console.log(`[PAYPAL] ✅ Configured in ${PAYPAL_MODE} mode`);
  console.log(`[PAYPAL] 💰 Deposit percentage: ${DEPOSIT_PERCENTAGE}%`);
}

/* ========= MIDDLEWARE ========= */
const isDevelopment = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) {
      console.log('[CORS] Allowing request with no origin');
      return callback(null, true);
    }
    
    console.log(`[CORS] Checking origin: ${origin}`);
    
    if (isDevelopment) {
      if (origin.startsWith('http://localhost:') || 
          origin.startsWith('https://localhost:') ||
          origin.startsWith('http://127.0.0.1:') || 
          origin.startsWith('https://127.0.0.1:') ||
          origin.includes('192.168.')) {
        console.log('[CORS] ✅ Allowed (development mode)');
        return callback(null, true);
      }
    }
    
    if (origin === CLIENT_ORIGIN) {
      console.log('[CORS] ✅ Allowed (matches CLIENT_ORIGIN)');
      return callback(null, true);
    }
    
    console.log(`[CORS] ❌ BLOCKED - Origin not allowed: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
  next();
});

/* ========= PUSH NOTIFICATION ROUTES ========= */
app.post('/api/push/subscribe', async (req, res) => {
  try {
    const subscription = req.body;
    
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }

    pushSubscriptions.set(subscription.endpoint, subscription);
    console.log('[PUSH] New subscription registered');

    res.json({ ok: true });
  } catch (error) {
    console.error('[PUSH] Subscribe error:', error);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

app.post('/api/push/unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;
    
    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint required' });
    }

    pushSubscriptions.delete(endpoint);
    console.log('[PUSH] Subscription removed');

    res.json({ ok: true });
  } catch (error) {
    console.error('[PUSH] Unsubscribe error:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

app.get('/api/push/vapid-public-key', (req, res) => {
  if (!VAPID_PUBLIC_KEY) {
    return res.status(503).json({ error: 'Push notifications not configured' });
  }
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// Test notification endpoint
app.post('/api/push/test', async (req, res) => {
  try {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return res.status(503).json({ error: 'Push notifications not configured' });
    }
    const payload = buildNotificationPayload('test', {});
    const results = await sendPushToAll(pushSubscriptions, payload);
    console.log('[PUSH] Test notification sent:', results);
    res.json({ ok: true, results });
  } catch (error) {
    console.error('[PUSH] Test notification error:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});


app.use(express.static(path.join(__dirname, "public")));

console.log("[DB] Using DynamoDB with region:", AWS_REGION);

/* ========= PUSH NOTIFICATIONS (WEB-PUSH) ========= */
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@nailsbysally.com';

const pushSubscriptions = new Map();

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log('[PUSH] ✅ Web-push configured');
} else {
  console.warn('[PUSH] ⚠️  VAPID keys not configured. Push notifications disabled.');
}

async function sendPushNotification(payload) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log('[PUSH] Skipping notification (VAPID not configured)');
    return;
  }

  const notificationPayload = JSON.stringify(payload);
  const promises = [];

  for (const [endpoint, subscription] of pushSubscriptions) {
    promises.push(
      webpush.sendNotification(subscription, notificationPayload)
        .then(() => console.log('[PUSH] ✅ Notification sent'))
        .catch(error => {
          console.error('[PUSH] ❌ Send error:', error.message);
          if (error.statusCode === 404 || error.statusCode === 410) {
            pushSubscriptions.delete(endpoint);
          }
        })
    );
  }

  await Promise.allSettled(promises);
}

/* ========= EMAIL CONFIRMATION ========= */
async function sendConfirmationEmail(appointmentData) {
  if (!emailTransporter) {
    console.log('[EMAIL] Skipping confirmation (email not configured)');
    return;
  }

  const {
    fullName,
    email,
    phone,
    serviceName,
    date,
    timeLabel,
    durationMin,
    depositPaid,
    remainingAmount,
    totalPrice,
    notes
  } = appointmentData;

  // Format date nicely
  const appointmentDate = new Date(date + 'T00:00:00');
  const formattedDate = appointmentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const mailOptions = {
    from: {
      name: 'Nails By Sally',
      address: EMAIL_USER
    },
    to: email,
    subject: `✨ Appointment Confirmed - ${serviceName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #f14aa6 0%, #7a5cff 100%);
            padding: 40px 30px;
            text-align: center;
            color: white;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
          }
          .header p {
            margin: 10px 0 0 0;
            font-size: 16px;
            opacity: 0.95;
          }
          .content {
            padding: 40px 30px;
          }
          .greeting {
            font-size: 18px;
            color: #333;
            margin-bottom: 20px;
          }
          .info-box {
            background-color: #f9fafb;
            border-left: 4px solid #f14aa6;
            padding: 20px;
            margin: 25px 0;
            border-radius: 8px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .info-row:last-child {
            border-bottom: none;
          }
          .info-label {
            font-weight: 600;
            color: #6b7280;
            font-size: 14px;
          }
          .info-value {
            color: #111827;
            font-weight: 600;
            text-align: right;
            font-size: 14px;
          }
          .payment-box {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            margin: 25px 0;
            text-align: center;
          }
          .payment-box h3 {
            margin: 0 0 15px 0;
            font-size: 18px;
          }
          .payment-amount {
            font-size: 32px;
            font-weight: 700;
            margin: 10px 0;
          }
          .payment-detail {
            font-size: 14px;
            opacity: 0.9;
            margin: 5px 0;
          }
          .notes-box {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            margin: 20px 0;
            border-radius: 8px;
          }
          .notes-box strong {
            color: #92400e;
            display: block;
            margin-bottom: 5px;
          }
          .notes-box p {
            margin: 0;
            color: #78350f;
          }
          .footer {
            background-color: #f9fafb;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
          }
          .footer p {
            margin: 5px 0;
            color: #6b7280;
            font-size: 14px;
          }
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #f14aa6 0%, #7a5cff 100%);
            color: white;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
          }
          .divider {
            height: 1px;
            background-color: #e5e7eb;
            margin: 30px 0;
          }
          @media only screen and (max-width: 600px) {
            .container {
              margin: 0;
              border-radius: 0;
            }
            .header, .content, .footer {
              padding: 30px 20px;
            }
            .info-row {
              flex-direction: column;
              gap: 5px;
            }
            .info-value {
              text-align: left;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💅 Appointment Confirmed!</h1>
            <p>Your booking has been successfully confirmed</p>
          </div>
          
          <div class="content">
            <p class="greeting">Hi ${fullName},</p>
            <p>Thank you for booking with Nails By Sally! We're excited to pamper you. Here are your appointment details:</p>
            
            <div class="info-box">
              <div class="info-row">
                <span class="info-label">💅 Service</span>
                <span class="info-value">${serviceName}</span>
              </div>
              <div class="info-row">
                <span class="info-label">📅 Date</span>
                <span class="info-value">${formattedDate}</span>
              </div>
              <div class="info-row">
                <span class="info-label">⏰ Time</span>
                <span class="info-value">${timeLabel}</span>
              </div>
              <div class="info-row">
                <span class="info-label">⏱️ Duration</span>
                <span class="info-value">${durationMin} minutes</span>
              </div>
              ${phone ? `
              <div class="info-row">
                <span class="info-label">📱 Phone</span>
                <span class="info-value">${phone}</span>
              </div>
              ` : ''}
            </div>

            <div class="payment-box">
              <h3>💰 Payment Summary</h3>
              <div class="payment-detail">Deposit Paid</div>
              <div class="payment-amount">$${depositPaid.toFixed(2)} CAD</div>
              <div class="divider" style="background-color: rgba(255,255,255,0.3); margin: 15px 40px;"></div>
              <div class="payment-detail">Remaining Balance (due at appointment)</div>
              <div class="payment-amount" style="font-size: 24px;">$${remainingAmount.toFixed(2)} CAD</div>
              <div class="payment-detail" style="margin-top: 10px;">Total: $${totalPrice.toFixed(2)} CAD</div>
            </div>

            ${notes ? `
            <div class="notes-box">
              <strong>📝 Your Notes:</strong>
              <p>${notes}</p>
            </div>
            ` : ''}

            <div class="divider"></div>

            <h3 style="color: #f14aa6; font-size: 18px;">📍 Location</h3>
            <p style="margin: 10px 0;">
              <strong>Nails By Sally</strong><br>
              [Your Address Here]<br>
              [City, Province, Postal Code]
            </p>

            <h3 style="color: #f14aa6; font-size: 18px; margin-top: 25px;">Important Information</h3>
            <ul style="color: #6b7280; line-height: 1.8;">
              <li>Please arrive 5-10 minutes before your appointment</li>
              <li>Bring your remaining balance of $${remainingAmount.toFixed(2)} CAD</li>
              <li>We accept cash, debit, and credit cards</li>
              <li>Cancellations require 24 hours notice</li>
            </ul>

            <p style="margin-top: 30px;">If you need to reschedule or have any questions, please contact us:</p>
            <p style="font-weight: 600; color: #f14aa6;">
              📧 ${EMAIL_USER}<br>
              📱 [Your Phone Number]
            </p>
          </div>

          <div class="footer">
            <p style="font-weight: 600; color: #333;">See you soon! 💅✨</p>
            <p>Nails By Sally</p>
            <p style="font-size: 12px; margin-top: 15px;">
              This is an automated confirmation email.<br>
              Please do not reply to this email.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await emailTransporter.sendMail(mailOptions);
    console.log(`[EMAIL] ✅ Confirmation sent to ${email}`);
  } catch (error) {
    console.error('[EMAIL] ❌ Failed to send confirmation:', error.message);
  }
}

/* ========= PUBLIC API ROUTES ========= */

// GET /api/services
app.get("/api/services", (req, res) => {
  try {
    res.json({ ok: true, services: SERVICES });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load services" });
  }
});

// GET /api/paypal-client-id
app.get("/api/paypal-client-id", (req, res) => {
  if (!PAYPAL_CLIENT_ID) {
    return res.status(503).json({ error: "PayPal not configured" });
  }
  res.json({ clientId: PAYPAL_CLIENT_ID });
});

/* ========= TIME HELPERS ========= */
const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const minutesToLabel = (m) => {
  const h = Math.floor(m / 60), mm = m % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
};

const localDateTimeToUTC = (dateYMD, minutesInDay, tz) => {
  const hh = String(Math.floor(minutesInDay / 60)).padStart(2, "0");
  const mm = String(minutesInDay % 60).padStart(2, "0");
  const local = new Date(`${dateYMD}T${hh}:${mm}:00`);

  const fmtDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const fmtTime = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const dateParts = Object.fromEntries(
    fmtDate.formatToParts(local).map((p) => [p.type, p.value])
  );
  const timeParts = Object.fromEntries(
    fmtTime.formatToParts(local).map((p) => [p.type, p.value])
  );

  const zoned = new Date(
    `${dateParts.year}-${dateParts.month}-${dateParts.day}T${timeParts.hour}:${timeParts.minute}:${timeParts.second}Z`
  );
  return zoned;
};

/* ========= AUTHENTICATION MIDDLEWARE ========= */
function authMiddleware(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
}

/* ========= ADMIN AUTH ROUTES ========= */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
  // or 'appointments.html' if you want that as the landing page
});

app.post("/api/admin/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedAdminEmail = (ADMIN_EMAIL || "").trim().toLowerCase();

  if (normalizedEmail !== normalizedAdminEmail) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: ADMIN_USERS_TABLE,
        Key: { email: normalizedEmail },
      })
    );

    let user = result.Item;

    if (!user) {
      const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
      user = {
        email: normalizedEmail,
        passwordHash: hash,
        createdAt: new Date().toISOString(),
      };
      await docClient.send(
        new PutCommand({
          TableName: ADMIN_USERS_TABLE,
          Item: user,
        })
      );
      console.log("[ADMIN] Created admin user:", normalizedEmail);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user.email }, JWT_SECRET, {
      expiresIn: "7d",
    });
    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({ ok: true, user: { email: user.email } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Login error" });
  }
});

app.post("/api/admin/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

app.get("/api/admin/me", authMiddleware, (req, res) => {
  res.json({ ok: true, user: { email: req.userId } });
});

/* ========= ADMIN APPOINTMENT ROUTES ========= */
app.get("/api/appointments", authMiddleware, async (req, res) => {
  try {
    const result = await docClient.send(
      new ScanCommand({
        TableName: APPOINTMENTS_TABLE,
      })
    );

    const items = result.Items || [];
    items.sort((a, b) => {
      const dateComp = a.date.localeCompare(b.date);
      if (dateComp !== 0) return dateComp;
      return new Date(a.startAt) - new Date(b.startAt);
    });

    res.json({ ok: true, appointments: items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
});

app.get("/api/availability", async (req, res) => {
  try {
    const { date, serviceId } = req.query;
    if (!date || !serviceId)
      return res.status(400).json({ error: "date & serviceId required" });

    const svc = getService(serviceId);
    if (!svc) return res.status(404).json({ error: "Service not found" });

    const result = await docClient.send(
      new QueryCommand({
        TableName: APPOINTMENTS_TABLE,
        IndexName: "DateIndex",
        KeyConditionExpression: "#date = :date",
        FilterExpression: "#status IN (:booked, :confirmed)",
        ExpressionAttributeNames: {
          "#date": "date",
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":date": date,
          ":booked": "booked",
          ":confirmed": "confirmed",
        },
      })
    );

    const existingAppts = result.Items || [];

    const start = toMinutes(OPEN_TIME);
    const end = toMinutes(CLOSE_TIME);
    const slot = Number(SLOT_MINUTES);
    const durMin = Number(svc.durationMin);

    const allSlots = [];
    for (let m = start; m + durMin <= end; m += slot) {
      allSlots.push(m);
    }

    const usedRanges = existingAppts.map((appt) => {
      const st = new Date(appt.startAt);
      const en = new Date(appt.endAt);
      return {
        start: st.getUTCHours() * 60 + st.getUTCMinutes(),
        end: en.getUTCHours() * 60 + en.getUTCMinutes(),
      };
    });

    const available = allSlots.filter((m) => {
      const proposedEnd = m + durMin;
      for (const r of usedRanges) {
        if (m < r.end && proposedEnd > r.start) return false;
      }
      return true;
    });

    const labels = available.map(minutesToLabel);
    res.json({ ok: true, slots: labels });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Availability check failed" });
  }
});

/* ========= PAYPAL ROUTES ========= */

// POST /api/create-paypal-order
app.post("/api/create-paypal-order", async (req, res) => {
  try {
    console.log('[PAYPAL] Received create order request');
    
    if (!paypalClient) {
      console.error('[PAYPAL] PayPal client not initialized');
      return res.status(503).json({ error: "PayPal not configured" });
    }

    const { serviceId, fullName, email, phone, notes, date, timeLabel } = req.body;
    console.log('[PAYPAL] Order data:', { serviceId, fullName, email, date, timeLabel });

    if (!serviceId || !fullName || !email || !date || !timeLabel) {
      console.error('[PAYPAL] Missing required fields:', { serviceId, fullName, email, date, timeLabel });
      return res.status(400).json({ error: "Missing required fields" });
    }

    const svc = getService(serviceId);
    if (!svc) {
      console.error('[PAYPAL] Service not found:', serviceId);
      return res.status(404).json({ error: "Service not found" });
    }

    // Calculate deposit
    const depositPercent = parseFloat(DEPOSIT_PERCENTAGE) / 100;
    const depositAmount = (svc.price * depositPercent).toFixed(2);
    const remainingAmount = (svc.price - depositAmount).toFixed(2);

    console.log(`[PAYPAL] Creating order - Service: ${svc.name}, Price: $${svc.price}, Deposit: $${depositAmount}, Remaining: $${remainingAmount}`);

    // Create PayPal order using new SDK
    const ordersController = new OrdersController(paypalClient);
    
    const orderRequest = {
      intent: "CAPTURE",
      purchaseUnits: [{
        amount: {
          currencyCode: "CAD",
          value: depositAmount,
          breakdown: {
            itemTotal: {
              currencyCode: "CAD",
              value: depositAmount
            }
          }
        },
        description: `Deposit for ${svc.name} - ${date} at ${timeLabel}`,
        customId: JSON.stringify({
          serviceId,
          fullName,
          email,
          phone: phone || "",
          notes: notes || "",
          date,
          timeLabel,
          depositAmount,
          remainingAmount,
          totalAmount: svc.price
        }),
        items: [{
          name: `${svc.name} (Deposit)`,
          description: `${DEPOSIT_PERCENTAGE}% deposit - Balance due at appointment: $${remainingAmount}`,
          unitAmount: {
            currencyCode: "CAD",
            value: depositAmount
          },
          quantity: "1",
          category: "DIGITAL_GOODS"
        }]
      }],
      applicationContext: {
        brandName: "Nails By Sally",
        landingPage: "NO_PREFERENCE",
        userAction: "PAY_NOW"
        // Return URLs removed - payment stays in PayPal until approved
      }
    };

    console.log('[PAYPAL] Sending order request to PayPal...');
    console.log('[PAYPAL] Return URL:', `${CLIENT_ORIGIN}/booking.html?payment=success`);

    const response = await ordersController.ordersCreate({
      body: orderRequest,
      prefer: "return=representation"
    });

    // The order data is in response.result (parsed object), not response.body (JSON string)
    const order = response.result;
    const orderId = order.id;
    
    if (!orderId) {
      console.error("[PAYPAL] ❌ No order ID found in response!");
      console.error("[PAYPAL] Response:", JSON.stringify(response, null, 2));
      throw new Error("No order ID received from PayPal");
    }

    console.log("[PAYPAL] ✅ Order created successfully:", orderId);

    res.json({
      ok: true,
      orderId: orderId,
      depositAmount,
      remainingAmount
    });

  } catch (err) {
    console.error("[PAYPAL] ❌ Create order error:");
    console.error("[PAYPAL] Error name:", err.name);
    console.error("[PAYPAL] Error message:", err.message);
    console.error("[PAYPAL] Error stack:", err.stack);
    
    // Log full error details if available
    if (err.result) {
      console.error("[PAYPAL] PayPal error details:", JSON.stringify(err.result, null, 2));
    }
    
    res.status(500).json({ 
      error: "Failed to create PayPal order",
      details: err.message 
    });
  }
});

// POST /api/capture-paypal-order
app.post("/api/capture-paypal-order", async (req, res) => {
  try {
    if (!paypalClient) {
      return res.status(503).json({ error: "PayPal not configured" });
    }

    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: "Order ID required" });
    }

    console.log(`[PAYPAL] Capturing payment for order: ${orderId}`);

    // First, get the order to verify it's approved
    const ordersController = new OrdersController(paypalClient);
    
    try {
      const { result: orderDetails } = await ordersController.ordersGet({ id: orderId });
      console.log('[PAYPAL] Order status:', orderDetails.status);
      
      if (orderDetails.status !== 'APPROVED') {
        console.error(`[PAYPAL] ❌ Order not approved. Status: ${orderDetails.status}`);
        return res.status(400).json({ 
          error: `Payment not approved. Status: ${orderDetails.status}`,
          status: orderDetails.status 
        });
      }
      
      console.log('[PAYPAL] ✅ Order is approved, proceeding with capture...');
    } catch (getError) {
      console.error('[PAYPAL] Failed to get order details:', getError);
      // Continue anyway - the capture will fail if order is invalid
    }

    // Capture the payment using new SDK
    const response = await ordersController.ordersCapture({
      id: orderId,
      prefer: "return=representation"
    });

    // The capture data is in response.result (parsed object)
    const capture = response.result;
    console.log("[PAYPAL] ✅ Payment captured:", capture.id);
    console.log("[PAYPAL] Capture status:", capture.status);

    // Verify capture was completed
    if (capture.status !== 'COMPLETED') {
      console.error(`[PAYPAL] ❌ Capture not completed. Status: ${capture.status}`);
      return res.status(400).json({ 
        error: `Payment capture failed. Status: ${capture.status}`,
        captureStatus: capture.status 
      });
    }

    // Extract booking details
    const purchaseUnit = capture.purchaseUnits[0];
    if (!purchaseUnit) {
      throw new Error("No purchase unit in capture response");
    }
    
    const customId = purchaseUnit.customId;
    if (!customId) {
      throw new Error("No custom ID in capture response");
    }
    
    const customData = JSON.parse(customId);
    const { serviceId, fullName, email, phone, notes, date, timeLabel, depositAmount, remainingAmount, totalAmount } = customData;

    const svc = getService(serviceId);
    if (!svc) {
      return res.status(404).json({ error: "Service not found" });
    }

    // Parse time
    const [hm, ampmRaw] = String(timeLabel).split(" ");
    let [hh, mm] = hm.split(":").map(Number);
    const ampm = (ampmRaw || "").toUpperCase();
    if (ampm === "PM" && hh !== 12) hh += 12;
    if (ampm === "AM" && hh === 12) hh = 0;
    const minutes = hh * 60 + (mm || 0);

    const startAt = localDateTimeToUTC(date, minutes, SALON_TZ);
    const endAt = localDateTimeToUTC(date, minutes + svc.durationMin, SALON_TZ);

    // Final conflict check
    const result = await docClient.send(
      new QueryCommand({
        TableName: APPOINTMENTS_TABLE,
        IndexName: "DateIndex",
        KeyConditionExpression: "#date = :date",
        FilterExpression: "#status IN (:booked, :confirmed)",
        ExpressionAttributeNames: {
          "#date": "date",
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":date": date,
          ":booked": "booked",
          ":confirmed": "confirmed",
        },
      })
    );

    const existingAppts = result.Items || [];
    const startAtTime = new Date(startAt).getTime();
    const endAtTime = new Date(endAt).getTime();

    const conflict = existingAppts.some((appt) => {
      const apptStart = new Date(appt.startAt).getTime();
      const apptEnd = new Date(appt.endAt).getTime();
      return apptStart < endAtTime && apptEnd > startAtTime;
    });

    if (conflict) {
      console.error("[PAYPAL] ❌ Time conflict after payment - needs refund");
      return res.status(409).json({ 
        error: "Time slot no longer available. Please contact us for a refund.",
        needsRefund: true,
        orderId: capture.id
      });
    }

    // Create appointment
    const id = randomUUID();
    const appointment = {
      id,
      fullName,
      email,
      phone: phone || "",
      notes: (notes || "").trim(),
      date,
      serviceId: svc.id,
      serviceName: svc.name,
      durationMin: svc.durationMin,
      price: svc.price,
      depositPaid: parseFloat(depositAmount),
      remainingAmount: parseFloat(remainingAmount),
      paymentStatus: "deposit_paid",
      paypalOrderId: orderId,
      paypalCaptureId: capture.id,
      paypalPayerEmail: capture.payer?.emailAddress || email,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      status: "confirmed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await docClient.send(
      new PutCommand({
        TableName: APPOINTMENTS_TABLE,
        Item: appointment,
      })
    );

    console.log(`[PAYPAL] ✅ Appointment created: ${id}`);

    // Send notification
    await sendPushNotification({
      title: "💰 New Paid Appointment",
      body: `${fullName} booked ${svc.name} for ${date} at ${timeLabel} - Deposit: $${depositAmount}`,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-72x72.png",
      tag: "new-appointment",
      url: "/appointments.html",
      appointmentId: id,
      requireInteraction: true,
      vibrate: [200, 100, 200]
    });

    // Send confirmation email
    await sendConfirmationEmail({
      fullName,
      email,
      phone,
      serviceName: svc.name,
      date,
      timeLabel,
      durationMin: svc.durationMin,
      depositPaid: parseFloat(depositAmount),
      remainingAmount: parseFloat(remainingAmount),
      totalPrice: svc.price,
      notes
    });

    res.json({ 
      ok: true, 
      appointmentId: id,
      depositPaid: depositAmount,
      remainingAmount: remainingAmount
    });

  } catch (err) {
    console.error("[PAYPAL] ❌ Capture error:", err);
    res.status(500).json({ error: "Failed to capture payment" });
  }
});

/* ========= LEGACY APPOINTMENT CREATION (without payment) ========= */
app.post("/api/appointments", async (req, res) => {
  try {
    const { fullName, email, phone, notes, date, timeLabel, serviceId, status } = req.body;

    if (!fullName || !email || !date || !timeLabel || !serviceId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const svc = getService(serviceId);
    if (!svc) return res.status(404).json({ error: "Service not found" });

    const [hm, ampmRaw] = String(timeLabel).split(" ");
    let [hh, mm] = hm.split(":").map(Number);
    const ampm = (ampmRaw || "").toUpperCase();
    if (ampm === "PM" && hh !== 12) hh += 12;
    if (ampm === "AM" && hh === 12) hh = 0;
    const minutes = hh * 60 + (mm || 0);

    const startAt = localDateTimeToUTC(date, minutes, SALON_TZ);
    const endAt = localDateTimeToUTC(date, minutes + svc.durationMin, SALON_TZ);

    const result = await docClient.send(
      new QueryCommand({
        TableName: APPOINTMENTS_TABLE,
        IndexName: "DateIndex",
        KeyConditionExpression: "#date = :date",
        FilterExpression: "#status IN (:booked, :confirmed)",
        ExpressionAttributeNames: {
          "#date": "date",
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":date": date,
          ":booked": "booked",
          ":confirmed": "confirmed",
        },
      })
    );

    const existingAppts = result.Items || [];
    const startAtTime = new Date(startAt).getTime();
    const endAtTime = new Date(endAt).getTime();

    const conflict = existingAppts.some((appt) => {
      const apptStart = new Date(appt.startAt).getTime();
      const apptEnd = new Date(appt.endAt).getTime();
      return apptStart < endAtTime && apptEnd > startAtTime;
    });

    if (conflict) return res.status(409).json({ error: "Selected time is no longer available" });

    const id = randomUUID();
    const appointment = {
      id,
      fullName,
      email,
      phone: phone || "",
      notes: (notes || "").trim(),
      date,
      serviceId: svc.id,
      serviceName: svc.name,
      durationMin: svc.durationMin,
      price: svc.price,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      status: (status || "pending").toLowerCase(),
      paymentStatus: "unpaid",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await docClient.send(
      new PutCommand({
        TableName: APPOINTMENTS_TABLE,
        Item: appointment,
      })
    );

    await sendPushNotification({
      title: "New Appointment",
      body: `${fullName} booked ${svc.name} for ${date} at ${timeLabel}`,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-72x72.png",
      tag: "new-appointment",
      url: "/appointments.html",
      appointmentId: id,
      requireInteraction: true,
      vibrate: [200, 100, 200]
    });

    res.json({ ok: true, appointmentId: id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unexpected error" });
  }
});

// PATCH /api/appointments/:id
app.patch("/api/appointments/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const getResult = await docClient.send(
      new GetCommand({
        TableName: APPOINTMENTS_TABLE,
        Key: { id },
      })
    );

    const doc = getResult.Item;
    if (!doc) return res.status(404).json({ error: "Not found" });

    const {
      fullName,
      email,
      phone,
      notes,
      serviceName,
      date,
      timeLabel,
      status,
      price,
      durationMin,
    } = req.body || {};

    const updates = {};
    if (fullName !== undefined) updates.fullName = fullName;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (notes !== undefined) updates.notes = notes;
    if (serviceName !== undefined) updates.serviceName = serviceName;
    if (price !== undefined) updates.price = price;
    if (durationMin !== undefined) updates.durationMin = durationMin;
    if (status !== undefined) updates.status = String(status).toLowerCase();

    if (date || timeLabel) {
      const newDate = date || doc.date;
      const label =
        timeLabel ||
        (function () {
          const d = new Date(doc.startAt);
          const h = d.getUTCHours(),
            m = d.getUTCMinutes();
          let hh = h % 12 || 12;
          const ampm = h >= 12 ? "PM" : "AM";
          return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
        })();

      const [hm, ampmRaw] = String(label).split(" ");
      let [hh, mm] = hm.split(":").map(Number);
      const ampm = (ampmRaw || "").toUpperCase();
      if (ampm === "PM" && hh !== 12) hh += 12;
      if (ampm === "AM" && hh === 12) hh = 0;
      const minutes = hh * 60 + (mm || 0);

      const dur = Number(updates.durationMin || doc.durationMin || 30);
      const startAt = localDateTimeToUTC(newDate, minutes, SALON_TZ);
      const endAt = localDateTimeToUTC(newDate, minutes + dur, SALON_TZ);

      const result = await docClient.send(
        new QueryCommand({
          TableName: APPOINTMENTS_TABLE,
          IndexName: "DateIndex",
          KeyConditionExpression: "#date = :date",
          FilterExpression: "#status IN (:booked, :confirmed) AND id <> :id",
          ExpressionAttributeNames: {
            "#date": "date",
            "#status": "status",
          },
          ExpressionAttributeValues: {
            ":date": newDate,
            ":booked": "booked",
            ":confirmed": "confirmed",
            ":id": id,
          },
        })
      );

      const existingAppts = result.Items || [];
      const startAtTime = new Date(startAt).getTime();
      const endAtTime = new Date(endAt).getTime();

      const conflict = existingAppts.some((appt) => {
        const apptStart = new Date(appt.startAt).getTime();
        const apptEnd = new Date(appt.endAt).getTime();
        return apptStart < endAtTime && apptEnd > startAtTime;
      });

      if (conflict)
        return res.status(409).json({ error: "Selected time is no longer available" });

      updates.date = newDate;
      updates.startAt = startAt.toISOString();
      updates.endAt = endAt.toISOString();
    }

    updates.updatedAt = new Date().toISOString();

    const updateExpression = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    Object.keys(updates).forEach((key, index) => {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      updateExpression.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = updates[key];
    });

    await docClient.send(
      new UpdateCommand({
        TableName: APPOINTMENTS_TABLE,
        Key: { id },
        UpdateExpression: `SET ${updateExpression.join(", ")}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: "ALL_NEW",
      })
    );

    const updatedResult = await docClient.send(
      new GetCommand({
        TableName: APPOINTMENTS_TABLE,
        Key: { id },
      })
    );

    res.json({ ok: true, appointment: updatedResult.Item });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Update failed" });
  }
});

// DELETE /api/appointments/:id
app.delete("/api/appointments/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await docClient.send(
      new DeleteCommand({
        TableName: APPOINTMENTS_TABLE,
        Key: { id },
      })
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Delete failed" });
  }
});


/* ========= CONTACT FORM EMAIL ========= */
app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: "Name, email, and message are required" });
    }

    if (!emailTransporter) {
      console.error('[CONTACT] Email not configured');
      return res.status(503).json({ error: "Email service not configured" });
    }

    // Email to salon
    const mailOptions = {
      from: email, // Client's email as the sender
      to: "NailsBySxlly@gmail.com",
      replyTo: email, // So you can reply directly to the client
      subject: subject || `New Contact Form Message from ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background: linear-gradient(90deg, #f14aa6, #5a38ff); padding: 30px; border-radius: 10px 10px 0 0;">
            <h2 style="color: white; margin: 0;">New Contact Form Message</h2>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h3 style="color: #333; margin-top: 0;">Contact Details</h3>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Name:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Email:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;"><a href="mailto:${email}" style="color: #f14aa6;">${email}</a></td>
              </tr>
              ${phone ? `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Phone:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${phone}</td>
              </tr>
              ` : ''}
              ${subject ? `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Subject:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${subject}</td>
              </tr>
              ` : ''}
            </table>
            
            <h3 style="color: #333; margin-top: 30px;">Message</h3>
            <div style="background: #f9f9f9; padding: 20px; border-radius: 5px; border-left: 4px solid #f14aa6;">
              <p style="margin: 0; white-space: pre-wrap; color: #555; line-height: 1.6;">${message}</p>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #888; font-size: 12px;">
              <p>This message was sent via the Nails By Sally contact form on ${new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' })}</p>
            </div>
          </div>
        </div>
      `
    };

    await emailTransporter.sendMail(mailOptions);
    console.log(`[CONTACT] Email sent successfully from ${email}`);

    res.json({ ok: true, message: "Your message has been sent successfully!" });
  } catch (err) {
    console.error('[CONTACT] Email error:', err);
    res.status(500).json({ error: "Failed to send message. Please try again later." });
  }
});
/* ========= START SERVER ========= */
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📍 CORS allowed origin: ${CLIENT_ORIGIN}`);
  console.log(`\n💡 Ready to accept bookings with payments!\n`);
});