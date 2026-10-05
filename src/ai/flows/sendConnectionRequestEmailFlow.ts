
'use server';
/**
 * @fileOverview A Genkit flow to send a connection request email to an artist.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import nodemailer from 'nodemailer';
import { getBaseUrl } from '@/lib/config';

const ConnectionRequestEmailInputSchema = z.object({
  artistName: z.string(),
  artistEmail: z.string().email(),
  senderName: z.string(),
  senderAge: z.number().optional(),
  senderCategory: z.string().optional(),
  requestorEmail: z.string().email().optional(),
  // SMTP Settings
  smtpHost: z.string().optional(),
  smtpPort: z.string().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  senderEmail: z.string().email().optional(),
  siteName: z.string().optional(),
  logoUrl: z.string().optional(),
});

export type ConnectionRequestEmailInput = z.infer<typeof ConnectionRequestEmailInputSchema>;

export async function sendConnectionRequestEmail(input: ConnectionRequestEmailInput): Promise<{ success: boolean; message: string }> {
  try {
    return await connectionRequestEmailFlow(input);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Failed to process connection request email flow: ${errorMessage}` };
  }
}

const createHtmlTemplate = (title: string, bodyContent: string, siteName: string, logoUrl?: string) => {
    const finalLogoUrl = logoUrl || `${getBaseUrl()}/default-image.png`;
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { margin: 0; padding: 0; background-color: #F8F9FA; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .inner-container { padding: 25px; }
        .header { text-align: center; padding: 20px 0; border-bottom: 1px solid #f0f0f0; }
        .header img { max-width: 140px; height: auto; }
        .content { padding: 25px 0; color: #333333; line-height: 1.6; }
        .content h2 { color: #111111; font-size: 22px; margin-bottom: 15px; }
        .footer { text-align: center; font-size: 12px; color: #999999; padding: 25px; border-top: 1px solid #eeeeee; }
        .button {
            display: inline-block; padding: 14px 28px; background-color: #0B5ED7; color: #ffffff !important;
            text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin-top: 20px;
        }
        @media only screen and (max-width: 600px) {
            .inner-container { padding: 15px !important; }
            .container { width: 100% !important; }
        }
    </style>
</head>
<body>
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8F9FA;">
        <tr>
            <td align="center">
                <table class="container" width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; margin: 20px 0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                    <tr>
                        <td class="inner-container">
                            <div class="header">
                                <a href="${getBaseUrl()}" target="_blank">
                                    <img src="${finalLogoUrl}" alt="${siteName} Logo">
                                </a>
                            </div>
                            <div class="content">
                                <h2>${title}</h2>
                                ${bodyContent}
                            </div>
                            <div class="footer">
                                <p>&copy; ${new Date().getFullYear()} ${siteName}. All rights reserved.</p>
                                <p>This is an automated email. Please do not reply directly.</p>
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`;
};

const connectionRequestEmailFlow = ai.defineFlow(
  {
    name: 'connectionRequestEmailFlow',
    inputSchema: ConnectionRequestEmailInputSchema,
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async (details) => {
    const { smtpHost, smtpPort, smtpUser, smtpPass, senderEmail, artistName, artistEmail, senderName, senderAge, senderCategory, requestorEmail, siteName = "Screenplay Pro", logoUrl } = details;
    
    const canAttemptRealEmail = smtpHost && smtpPort && smtpUser && smtpPass && senderEmail;

    const connectionsUrl = `${getBaseUrl()}/connections`;
    const emailSubject = `New Connection Request from ${senderName} on ${siteName}`;
    const emailBodyContent = `
        <p>Hi ${artistName},</p>
        <p>You have received a new connection request on ${siteName}.</p>
        <p><strong>Sender Details:</strong></p>
        <ul style="list-style-type: none; padding-left: 0; line-height: 1.8;">
          <li><strong>Name:</strong> ${senderName}</li>
          ${senderAge ? `<li><strong>Age:</strong> ${senderAge}</li>` : ''}
          ${senderCategory ? `<li><strong>Category:</strong> ${senderCategory}</li>` : ''}
        </ul>
        <br />
        <p>They are interested in your profile and would like to connect with you.</p>
        <p>You can review and respond to this request in your connections dashboard:</p>
        <p><a href="${connectionsUrl}" class="button">Review Request</a></p>
        <p>If you have any questions, feel free to contact our support team.</p>
        <p>Best regards,<br>The ${siteName} Team</p>
    `;
    const htmlBody = createHtmlTemplate(`New Connection Request`, emailBodyContent, siteName, logoUrl);

    if (!canAttemptRealEmail) {
      console.warn("SMTP configuration incomplete. Simulating connection request email.");
      return { success: false, message: "SMTP config incomplete. Email simulated." };
    }

    const portNumber = parseInt(smtpPort!, 10);
    if (isNaN(portNumber)) {
        return { success: false, message: "Invalid SMTP port." };
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost, port: portNumber, secure: portNumber === 465, auth: { user: smtpUser, pass: smtpPass },
    });
    
    try {
      await transporter.sendMail({
        from: `${siteName} <${senderEmail}>`,
        to: artistEmail,
        subject: emailSubject,
        html: htmlBody,
      });
      return { success: true, message: "Connection request email sent successfully." };
    } catch (error: any) {
      console.error("Error sending connection request email:", error);
      return { success: false, message: `Email sending failed: ${error.message || 'Unknown nodemailer error'}.` };
    }
  }
);
