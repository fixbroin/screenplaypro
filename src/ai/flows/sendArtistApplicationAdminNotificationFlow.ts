
'use server';
/**
 * @fileOverview A Genkit flow to send an email notification to the admin
 * when a new Artist application is submitted.
 *
 * - sendNewArtistApplicationAdminEmail - Sends an email to the admin.
 * - NewArtistApplicationAdminEmailInput - The input type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import nodemailer from 'nodemailer';
import { ADMIN_EMAIL } from '@/contexts/AuthContext'; // Import ADMIN_EMAIL
import { getBaseUrl } from '@/lib/config';

const NewArtistApplicationAdminEmailInputSchema = z.object({
  applicationId: z.string().describe("The ID of the submitted Artist application."),
  ArtistName: z.string().describe("The name of the Artist who applied."),
  ArtistEmail: z.string().email().describe("The email of the Artist."),
  ArtistCategory: z.string().optional().describe("The primary work category of the Artist."),
  applicationUrl: z.string().url().describe("Direct URL to view the application in the admin panel."),
  // SMTP Settings
  smtpHost: z.string().optional().describe("SMTP host for sending emails."),
  smtpPort: z.string().optional().describe("SMTP port (e.g., '587', '465')."),
  smtpUser: z.string().optional().describe("SMTP username."),
  smtpPass: z.string().optional().describe("SMTP password."),
  senderEmail: z.string().email().optional().describe("The email address to send from."),
  siteName: z.string().optional(),
  logoUrl: z.string().url().optional(),
  // Additional details
  ArtistMobile: z.string().optional(),
  ArtistGender: z.string().optional(),
  ArtistExperience: z.string().optional(),
  ArtistLocation: z.string().optional(),
  ArtistAge: z.number().optional(),
  ArtistHeight: z.string().optional(),
  ArtistWeight: z.string().optional(),
  ArtistSkinTone: z.string().optional(),
  ArtistQualification: z.string().optional(),
  ArtistLanguages: z.string().optional(),
});

export type NewArtistApplicationAdminEmailInput = z.infer<typeof NewArtistApplicationAdminEmailInputSchema>;

export async function sendNewArtistApplicationAdminEmail(input: NewArtistApplicationAdminEmailInput): Promise<{ success: boolean; message: string }> {
  try {
    // Explicitly using ai.run to execute the flow
    return await newArtistApplicationAdminEmailFlow(input);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in sendNewArtistApplicationAdminEmail wrapper:", error);
    return { success: false, message: `Failed to process admin notification email flow: ${errorMessage}` };
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
        .summary-box { background-color: #fcfcfc; border: 1px solid #eeeeee; padding: 20px; border-radius: 10px; margin: 20px 0; }
        .section-title { font-size: 16px; font-weight: bold; border-bottom: 1px solid #f0f0f0; padding-bottom: 8px; margin-bottom: 12px; color: #111111; text-transform: uppercase; letter-spacing: 0.5px; }
        
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


const newArtistApplicationAdminEmailFlow = ai.defineFlow(
  {
    name: 'newArtistApplicationAdminEmailFlow',
    inputSchema: NewArtistApplicationAdminEmailInputSchema,
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async (details) => {
    try {
      const {
        smtpHost, smtpPort, smtpUser, smtpPass, senderEmail,
        applicationId, ArtistName, ArtistEmail, ArtistCategory, applicationUrl,
        siteName = "Screenplay Pro", logoUrl,
        ArtistMobile, ArtistGender, ArtistExperience, ArtistLocation, ArtistAge, ArtistHeight, ArtistWeight, ArtistSkinTone, ArtistQualification, ArtistLanguages
      } = details;

      const adminEmail = "fixbro.in@gmail.com";
      const canAttemptRealEmail = smtpHost && smtpPort && smtpUser && smtpPass && senderEmail;

      const emailSubject = `New Artist Application: ${ArtistName}`;
      const emailBodyContent = `
        <p>A new Artist application has been submitted on ${siteName}.</p>
        
        <div class="summary-box">
            <div class="section-title">Application Summary</div>
            <table width="100%" cellpadding="6" cellspacing="0" style="font-size: 14px; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #f0f0f0;">
                    <td width="35%" style="color: #666666; font-weight: bold; padding: 8px 0;">Full Name:</td>
                    <td style="color: #111111; padding: 8px 0;">${ArtistName}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f0f0f0;">
                    <td style="color: #666666; font-weight: bold; padding: 8px 0;">Email:</td>
                    <td style="color: #111111; padding: 8px 0;">${ArtistEmail}</td>
                </tr>
                ${ArtistMobile ? `
                <tr style="border-bottom: 1px solid #f0f0f0;">
                    <td style="color: #666666; font-weight: bold; padding: 8px 0;">Mobile:</td>
                    <td style="color: #111111; padding: 8px 0;">${ArtistMobile}</td>
                </tr>` : ''}
                ${ArtistCategory ? `
                <tr style="border-bottom: 1px solid #f0f0f0;">
                    <td style="color: #666666; font-weight: bold; padding: 8px 0;">Category:</td>
                    <td style="color: #111111; padding: 8px 0;">${ArtistCategory}</td>
                </tr>` : ''}
                ${ArtistExperience ? `
                <tr style="border-bottom: 1px solid #f0f0f0;">
                    <td style="color: #666666; font-weight: bold; padding: 8px 0;">Experience:</td>
                    <td style="color: #111111; padding: 8px 0;">${ArtistExperience}</td>
                </tr>` : ''}
                ${ArtistGender ? `
                <tr style="border-bottom: 1px solid #f0f0f0;">
                    <td style="color: #666666; font-weight: bold; padding: 8px 0;">Gender:</td>
                    <td style="color: #111111; padding: 8px 0;">${ArtistGender}</td>
                </tr>` : ''}
                ${ArtistAge ? `
                <tr style="border-bottom: 1px solid #f0f0f0;">
                    <td style="color: #666666; font-weight: bold; padding: 8px 0;">Age:</td>
                    <td style="color: #111111; padding: 8px 0;">${ArtistAge} Years</td>
                </tr>` : ''}
                ${ArtistLocation ? `
                <tr style="border-bottom: 1px solid #f0f0f0;">
                    <td style="color: #666666; font-weight: bold; padding: 8px 0;">Location:</td>
                    <td style="color: #111111; padding: 8px 0;">${ArtistLocation}</td>
                </tr>` : ''}
                ${ArtistHeight ? `
                <tr style="border-bottom: 1px solid #f0f0f0;">
                    <td style="color: #666666; font-weight: bold; padding: 8px 0;">Height:</td>
                    <td style="color: #111111; padding: 8px 0;">${ArtistHeight}</td>
                </tr>` : ''}
                ${ArtistWeight ? `
                <tr style="border-bottom: 1px solid #f0f0f0;">
                    <td style="color: #666666; font-weight: bold; padding: 8px 0;">Weight:</td>
                    <td style="color: #111111; padding: 8px 0;">${ArtistWeight} kg</td>
                </tr>` : ''}
                ${ArtistSkinTone ? `
                <tr style="border-bottom: 1px solid #f0f0f0;">
                    <td style="color: #666666; font-weight: bold; padding: 8px 0;">Skin Tone:</td>
                    <td style="color: #111111; padding: 8px 0;">${ArtistSkinTone}</td>
                </tr>` : ''}
                ${ArtistQualification ? `
                <tr style="border-bottom: 1px solid #f0f0f0;">
                    <td style="color: #666666; font-weight: bold; padding: 8px 0;">Qualification:</td>
                    <td style="color: #111111; padding: 8px 0;">${ArtistQualification}</td>
                </tr>` : ''}
                ${ArtistLanguages ? `
                <tr style="border-bottom: 1px solid #f0f0f0;">
                    <td style="color: #666666; font-weight: bold; padding: 8px 0;">Languages:</td>
                    <td style="color: #111111; padding: 8px 0;">${ArtistLanguages}</td>
                </tr>` : ''}
                <tr>
                    <td style="color: #666666; font-weight: bold; padding: 8px 0;">Application ID:</td>
                    <td style="color: #111111; font-family: monospace; padding: 8px 0;">${applicationId}</td>
                </tr>
            </table>
        </div>

        <p>Please review the application at your earliest convenience by clicking the button below:</p>
        <p><a href="${applicationUrl}" class="button">View Application</a></p>
        <p>The ${siteName} System</p>
      `;

      const htmlBody = createHtmlTemplate("New Artist Application", emailBodyContent, siteName, logoUrl);

      if (!canAttemptRealEmail) {
        console.warn("SMTP configuration incomplete. Simulating admin notification email.");
        return { success: false, message: "SMTP config incomplete. Email simulated." };
      }

      const portNumber = parseInt(smtpPort!, 10);
      if (isNaN(portNumber)) {
        return { success: false, message: "Invalid SMTP port." };
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost, port: portNumber, secure: portNumber === 465, auth: { user: smtpUser, pass: smtpPass },
      });
      
      await transporter.sendMail({
        from: `${siteName} System <${senderEmail}>`,
        to: adminEmail,
        subject: emailSubject,
        html: htmlBody,
      });
      
      return { success: true, message: "Admin notification email sent successfully." };

    } catch (error: any) {
      console.error("Error in newArtistApplicationAdminEmailFlow:", error);
      return { success: false, message: `Email sending failed: ${error.message || 'Unknown nodemailer error'}.` };
    }
  }
);

    