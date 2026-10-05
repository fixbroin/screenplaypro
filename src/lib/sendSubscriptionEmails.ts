import nodemailer from 'nodemailer';
import { adminDb } from '@/lib/firebaseAdmin';
import { ADMIN_EMAIL } from '@/lib/constants';

interface SMTPConfig {
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPass?: string;
  senderEmail?: string;
}

async function getSmtpConfig(): Promise<SMTPConfig> {
  let config: SMTPConfig = {
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: process.env.SMTP_PORT || '587',
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    senderEmail: process.env.SENDER_EMAIL || 'no-reply@screenplaypro.in'
  };

  try {
    const docSnap = await adminDb.collection('webSettings').doc('applicationConfig').get();
    if (docSnap.exists) {
      const data = docSnap.data();
      if (data?.smtpHost) config.smtpHost = data.smtpHost;
      if (data?.smtpPort) config.smtpPort = data.smtpPort;
      if (data?.smtpUser) config.smtpUser = data.smtpUser;
      if (data?.smtpPass) config.smtpPass = data.smtpPass;
      if (data?.senderEmail) config.senderEmail = data.senderEmail;
    }
  } catch (err) {
    console.warn("Could not read SMTP settings from Firestore, using env fallback:", err);
  }

  return config;
}

function createTransporter(config: SMTPConfig) {
  if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
    return null;
  }

  const port = parseInt(config.smtpPort || '587', 10);
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: isNaN(port) ? 587 : port,
    secure: port === 465,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });
}

function getBaseTemplate(title: string, bodyHtml: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #0f766e, #0d9488); color: #ffffff; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { margin: 5px 0 0 0; font-size: 13px; opacity: 0.9; text-transform: uppercase; tracking: 1px; }
    .content { padding: 30px; color: #334155; line-height: 1.6; font-size: 15px; }
    .info-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 20px 0; }
    .info-table { width: 100%; border-collapse: collapse; }
    .info-table td { padding: 8px 0; font-size: 14px; }
    .info-table td.label { font-weight: bold; color: #64748b; width: 40%; }
    .info-table td.value { color: #0f172a; font-weight: 600; text-align: right; }
    .btn { display: inline-block; background-color: #0f766e; color: #ffffff !important; font-weight: bold; padding: 14px 28px; border-radius: 10px; text-decoration: none; margin-top: 20px; text-align: center; font-size: 15px; }
    .footer { background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎬 Screenplay Pro</h1>
      <p>${title}</p>
    </div>
    <div class="content">
      ${bodyHtml}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Screenplay Pro. All rights reserved.</p>
      <p>This is an automated system email.</p>
    </div>
  </div>
</body>
</html>
  `;
}

// EMAIL 1: User Subscription Activation Email
export async function sendUserSubscriptionActivationEmail(params: {
  userEmail: string;
  userName: string;
  planName: string;
  price: number;
  startDate: string;
  expiryDate: string;
}) {
  try {
    const config = await getSmtpConfig();
    const transporter = createTransporter(config);
    if (!transporter) {
      console.warn("SMTP credentials not configured. Skipping user activation email.");
      return false;
    }

    const bodyHtml = `
      <p>Hi <strong>${params.userName}</strong>,</p>
      <p>Congratulations! Your subscription to <strong>${params.planName}</strong> is now active!</p>
      
      <div class="info-card">
        <table class="info-table">
          <tr><td class="label">Plan Name</td><td class="value">${params.planName}</td></tr>
          <tr><td class="label">Amount Paid</td><td class="value">₹${params.price}</td></tr>
          <tr><td class="label">Start Date</td><td class="value">${params.startDate}</td></tr>
          <tr><td class="label">Expiry Date</td><td class="value">${params.expiryDate}</td></tr>
          <tr><td class="label">PDF Downloads</td><td class="value">Unlimited</td></tr>
        </table>
      </div>

      <p>You can now export studio-standard PDF scripts, translate into Indian languages, and sync your screenplays to the cloud anytime.</p>
      
      <div style="text-align: center;">
        <a href="https://screenplaypro.in/script-writing" class="btn">Start Writing Scripts</a>
      </div>
    `;

    await transporter.sendMail({
      from: `Screenplay Pro <${config.senderEmail}>`,
      to: params.userEmail,
      subject: `Your Screenplay Pro Subscription is Active! 🎬`,
      html: getBaseTemplate("Subscription Confirmation", bodyHtml)
    });
    return true;
  } catch (err) {
    console.error("Error sending user activation email:", err);
    return false;
  }
}

// EMAIL 2: User Subscription Expiry / Renewal Email
export async function sendUserSubscriptionExpiryEmail(params: {
  userEmail: string;
  userName: string;
  planName: string;
  expiryDate: string;
}) {
  try {
    const config = await getSmtpConfig();
    const transporter = createTransporter(config);
    if (!transporter) {
      console.warn("SMTP credentials not configured. Skipping user expiry email.");
      return false;
    }

    const bodyHtml = `
      <p>Hi <strong>${params.userName}</strong>,</p>
      <p>Your <strong>${params.planName}</strong> subscription at Screenplay Pro has expired on <strong>${params.expiryDate}</strong>.</p>
      
      <div class="info-card" style="border-left: 4px solid #ef4444;">
        <p style="margin: 0; font-weight: bold; color: #dc2626;">Subscription Expired</p>
        <p style="margin: 5px 0 0 0; font-size: 13px; color: #64748b;">To continue exporting studio-ready PDFs and accessing your saved scripts, please renew your plan.</p>
      </div>

      <p>Anyone can write and edit for free anytime. Upgrade or renew your subscription to unlock PDF script downloads.</p>
      
      <div style="text-align: center;">
        <a href="https://screenplaypro.in/subscriptions?reason=pdf_export" class="btn" style="background-color: #dc2626;">Renew Subscription Now</a>
      </div>
    `;

    await transporter.sendMail({
      from: `Screenplay Pro <${config.senderEmail}>`,
      to: params.userEmail,
      subject: `Screenplay Pro — Subscription Renewal Notice ⏰`,
      html: getBaseTemplate("Subscription Renewal Notice", bodyHtml)
    });
    return true;
  } catch (err) {
    console.error("Error sending user expiry email:", err);
    return false;
  }
}

// EMAIL 3: Admin Subscription Notification Email
export async function sendAdminSubscriptionNotificationEmail(params: {
  userId: string;
  userName: string;
  userEmail: string;
  userMobile?: string;
  planName: string;
  price: number;
  orderId?: string;
  startDate: string;
  expiryDate: string;
}) {
  try {
    const config = await getSmtpConfig();
    const transporter = createTransporter(config);
    if (!transporter) {
      console.warn("SMTP credentials not configured. Skipping admin notification email.");
      return false;
    }

    const bodyHtml = `
      <p>Hello Admin,</p>
      <p>A new subscription has just been activated on Screenplay Pro!</p>
      
      <div class="info-card">
        <table class="info-table">
          <tr><td class="label">User Name</td><td class="value">${params.userName}</td></tr>
          <tr><td class="label">User Email</td><td class="value">${params.userEmail}</td></tr>
          <tr><td class="label">Mobile Number</td><td class="value">${params.userMobile || 'N/A'}</td></tr>
          <tr><td class="label">Profile ID (UID)</td><td class="value">${params.userId}</td></tr>
          <tr><td class="label">Plan Name</td><td class="value">${params.planName}</td></tr>
          <tr><td class="label">Amount Paid</td><td class="value">₹${params.price}</td></tr>
          <tr><td class="label">Order / Transaction ID</td><td class="value">${params.orderId || 'N/A'}</td></tr>
          <tr><td class="label">Start Date</td><td class="value">${params.startDate}</td></tr>
          <tr><td class="label">Expiry Date</td><td class="value">${params.expiryDate}</td></tr>
        </table>
      </div>

      <div style="text-align: center;">
        <a href="https://screenplaypro.in/admin/subscriptions" class="btn">View Subscribed People in Admin</a>
      </div>
    `;

    await transporter.sendMail({
      from: `Screenplay Pro <${config.senderEmail}>`,
      to: ADMIN_EMAIL,
      subject: `🔔 New Subscription Activated: ${params.userName} (${params.planName})`,
      html: getBaseTemplate("New Subscription Alert", bodyHtml)
    });
    return true;
  } catch (err) {
    console.error("Error sending admin subscription notification email:", err);
    return false;
  }
}
