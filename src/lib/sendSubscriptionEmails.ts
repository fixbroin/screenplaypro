import nodemailer from 'nodemailer';
import { queryDb } from '@/lib/mysql';
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
    const rows = await queryDb<any[]>('SELECT setting_value FROM app_settings WHERE setting_key = ?', ['applicationConfig']);
    if (rows && rows.length > 0) {
      const data = typeof rows[0].setting_value === 'string' ? JSON.parse(rows[0].setting_value) : rows[0].setting_value;
      if (data?.smtpHost) config.smtpHost = data.smtpHost;
      if (data?.smtpPort) config.smtpPort = data.smtpPort;
      if (data?.smtpUser) config.smtpUser = data.smtpUser;
      if (data?.smtpPass) config.smtpPass = data.smtpPass;
      if (data?.senderEmail) config.senderEmail = data.senderEmail;
    }
  } catch (err) {
    console.warn("Could not read SMTP settings from MySQL app_settings, using env fallback:", err);
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
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 12px; }
    .container { max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #0f766e, #0d9488); color: #ffffff; padding: 24px 16px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { margin: 6px 0 0 0; font-size: 12px; opacity: 0.95; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
    .content { padding: 20px 16px; color: #334155; line-height: 1.6; font-size: 14px; }
    .info-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin: 18px 0; }
    .info-item { padding: 10px 0; border-bottom: 1px solid #e2e8f0; text-align: left; }
    .info-item:last-child { border-bottom: none; }
    .info-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; color: #64748b; margin-bottom: 4px; display: block; }
    .info-value { font-size: 15px; font-weight: 700; color: #0f172a; word-break: break-all; display: block; line-height: 1.4; text-align: left; }
    .btn { display: block; width: 100%; box-sizing: border-box; background-color: #0f766e; color: #ffffff !important; font-weight: bold; padding: 14px 18px; border-radius: 10px; text-decoration: none; margin-top: 20px; text-align: center; font-size: 15px; }
    .footer { background-color: #f8fafc; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
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
      <p>Automated payment transaction notice.</p>
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
      <p style="font-size: 15px; margin-top: 0;">Hi <strong>${params.userName}</strong>,</p>
      <p style="font-size: 14px;">Congratulations! Your subscription to <strong>${params.planName}</strong> is active!</p>
      
      <div class="info-card">
        <div class="info-item">
          <span class="info-label">Plan Name</span>
          <span class="info-value">${params.planName}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Amount Paid</span>
          <span class="info-value">₹${params.price}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Start Date</span>
          <span class="info-value">${params.startDate}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Expiry Date</span>
          <span class="info-value">${params.expiryDate}</span>
        </div>
        <div class="info-item">
          <span class="info-label">PDF Downloads</span>
          <span class="info-value">Unlimited Exports</span>
        </div>
      </div>

      <p style="font-size: 13px;">You can now export studio-standard PDF scripts, translate into Indian languages, and sync your screenplays to the cloud anytime.</p>
      
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
      <p style="font-size: 15px; margin-top: 0;">Hi <strong>${params.userName}</strong>,</p>
      <p style="font-size: 14px;">Your <strong>${params.planName}</strong> subscription at Screenplay Pro has expired on <strong>${params.expiryDate}</strong>.</p>
      
      <div class="info-card" style="border-left: 4px solid #ef4444;">
        <div class="info-item" style="border-bottom: none;">
          <span class="info-label" style="color: #dc2626;">Subscription Status</span>
          <span class="info-value" style="color: #dc2626;">Expired</span>
        </div>
      </div>

      <p style="font-size: 13px;">Anyone can write and edit scripts for free anytime. Renew your subscription to unlock studio PDF downloads.</p>
      
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
      <p style="font-size: 15px; margin-top: 0;">Hello Admin,</p>
      <p style="font-size: 14px;">A new subscription has just been activated on Screenplay Pro!</p>
      
      <div class="info-card">
        <div class="info-item">
          <span class="info-label">User Name</span>
          <span class="info-value">${params.userName}</span>
        </div>
        <div class="info-item">
          <span class="info-label">User Email</span>
          <span class="info-value">${params.userEmail}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Mobile Number</span>
          <span class="info-value">${params.userMobile || 'N/A'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Profile ID (UID)</span>
          <span class="info-value">${params.userId}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Plan Name</span>
          <span class="info-value">${params.planName}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Amount Paid</span>
          <span class="info-value">₹${params.price}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Order / Transaction ID</span>
          <span class="info-value">${params.orderId || 'N/A'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Start Date</span>
          <span class="info-value">${params.startDate}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Expiry Date</span>
          <span class="info-value">${params.expiryDate}</span>
        </div>
      </div>

      <div style="text-align: center;">
        <a href="https://screenplaypro.in/admin/subscriptions" class="btn">View Subscriptions in Admin</a>
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
