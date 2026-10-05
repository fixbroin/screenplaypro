
'use server';
/**
 * @fileOverview A Genkit flow to send an email notification to a Artist
 * when their application status is updated by an admin.
 *
 * - sendArtistApplicationStatusEmail - Sends an email to the Artist.
 * - ArtistApplicationStatusEmailInput - The input type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import nodemailer from 'nodemailer';
import type { ArtistApplicationStatus } from '@/types/firestore'; // Import status type
import { getBaseUrl } from '@/lib/config';

const ArtistApplicationStatusEmailInputSchema = z.object({
  ArtistName: z.string().describe("The name of the Artist."),
  ArtistEmail: z.string().email().describe("The email of the Artist."),
  applicationStatus: z.custom<ArtistApplicationStatus>().describe("The new status of the application (e.g., 'approved', 'rejected', 'needs_update')."),
  adminReviewNotes: z.string().optional().describe("Admin notes, especially if rejected or needs update."),
  applicationUrl: z.string().url().describe("Direct URL for the Artist to view/update their application if needed."),
  // SMTP Settings
  smtpHost: z.string().optional().describe("SMTP host for sending emails."),
  smtpPort: z.string().optional().describe("SMTP port (e.g., '587', '465')."),
  smtpUser: z.string().optional().describe("SMTP username."),
  smtpPass: z.string().optional().describe("SMTP password."),
  senderEmail: z.string().email().optional().describe("The email address to send from."),
  siteName: z.string().optional(),
  logoUrl: z.string().url().optional(),
});

export type ArtistApplicationStatusEmailInput = z.infer<typeof ArtistApplicationStatusEmailInputSchema>;

export async function sendArtistApplicationStatusEmail(input: ArtistApplicationStatusEmailInput): Promise<{ success: boolean; message: string }> {
  try {
    return await ArtistApplicationStatusEmailFlow(input);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Failed to process Artist status email flow: ${errorMessage}` };
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
        .notes { background-color: #f9f9f9; border-left: 3px solid #0B5ED7; padding: 15px; margin: 15px 0; border-radius: 0 8px 8px 0; }
        
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


const ArtistApplicationStatusEmailFlow = ai.defineFlow(
  {
    name: 'ArtistApplicationStatusEmailFlow',
    inputSchema: ArtistApplicationStatusEmailInputSchema,
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async (details) => {
    try {
      const {
        smtpHost, smtpPort, smtpUser, smtpPass, senderEmail,
        ArtistName, ArtistEmail, applicationStatus, adminReviewNotes, applicationUrl,
        siteName = "Screenplay Pro", logoUrl,
      } = details;
      
      const canAttemptRealEmail = smtpHost && smtpPort && smtpUser && smtpPass && senderEmail;

      let emailSubject = "";
      let emailBodyContent = "";

      switch (applicationStatus) {
        case 'approved':
          emailSubject = `Your ${siteName} Artist Application has been Approved!`;
          emailBodyContent = `
            <p>Dear ${ArtistName},</p>
            <p>Congratulations! We are pleased to inform you that your Artist application with ${siteName} has been approved.</p>
            <p>Your profile is now live on our directory! To maximize your casting opportunities and help casting directors find you, please log in to complete your profile setup:</p>
            
            <div style="background-color: #f6fdfa; border: 1px solid #d1fae5; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: left;">
              <h3 style="color: #065f46; font-size: 15px; font-weight: bold; margin-top: 0; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">🚀 Profile Completeness Checklist</h3>
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 13px; color: #374151; line-height: 1.5;">
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; width: 25px; color: #059669; vertical-align: top;">1.</td>
                  <td style="padding: 6px 0; vertical-align: top;"><strong>Upload Profile Photo & Write Bio</strong><br><span style="color: #6b7280; font-size: 11px;">Add a professional headshot and brief description of your talent.</span></td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; width: 25px; color: #059669; vertical-align: top;">2.</td>
                  <td style="padding: 6px 0; vertical-align: top;"><strong>Add Audition or Work Videos</strong><br><span style="color: #6b7280; font-size: 11px;">Link your best performance reels or work samples.</span></td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; width: 25px; color: #059669; vertical-align: top;">3.</td>
                  <td style="padding: 6px 0; vertical-align: top;"><strong>Add Course Certificates</strong><br><span style="color: #6b7280; font-size: 11px;">Showcase your training, acting workshops, or creative degrees.</span></td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; width: 25px; color: #059669; vertical-align: top;">4.</td>
                  <td style="padding: 6px 0; vertical-align: top;"><strong>Link Social Media Profiles</strong><br><span style="color: #6b7280; font-size: 11px;">Connect Instagram, YouTube, or LinkedIn for casting background checks.</span></td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; width: 25px; color: #059669; vertical-align: top;">5.</td>
                  <td style="padding: 6px 0; vertical-align: top;"><strong>Configure Mobile & Email Visibility</strong><br><span style="color: #6b7280; font-size: 11px;">Control which contact details are visible to casting directors.</span></td>
                </tr>
              </table>
            </div>

            <p>You can manage all of these setup tasks directly from your profile settings. We've set up an interactive setup walkthrough on your dashboard to guide you through each card!</p>
            <p style="text-align: center;"><a href="${applicationUrl.replace('artist-registration', 'profile')}" class="button" style="background-color: #059669; color: #ffffff !important; display: inline-block; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin-top: 10px;">Complete Profile Setup</a></p>
            <p>Welcome aboard,</p>
            <p>The ${siteName} Team</p>
          `;
          break;
        case 'rejected':
          emailSubject = `Update Regarding Your ${siteName} Artist Application`;
          emailBodyContent = `
            <p>Dear ${ArtistName},</p>
            <p>Thank you for your interest in becoming a Artist with ${siteName}.</p>
            <p>After careful review, we regret to inform you that your application was not approved at this time.</p>
            ${adminReviewNotes ? `<div class="notes"><p><strong>Reason/Feedback:</strong><br>${adminReviewNotes}</p></div>` : ''}
            <p>If you have questions, please contact our support team.</p>
            <p>Sincerely,</p>
            <p>The ${siteName} Team</p>
          `;
          break;
        case 'needs_update':
          emailSubject = `Action Required: Update Your ${siteName} Artist Application`;
          emailBodyContent = `
            <p>Dear ${ArtistName},</p>
            <p>We have reviewed your Artist application for ${siteName} and require some additional information or corrections.</p>
            ${adminReviewNotes ? `<div class="notes"><p><strong>Please address the following:</strong><br>${adminReviewNotes}</p></div>` : ''}
            <p>Please log in to your application to make the necessary updates:</p>
            <p><a href="${applicationUrl}" class="button">Update Application</a></p>
            <p>Once updated, your application will be re-reviewed.</p>
            <p>Thank you,</p>
            <p>The ${siteName} Team</p>
          `;
          break;
        default:
          return { success: true, message: "No email template for this status." };
      }

      const htmlBody = createHtmlTemplate(`Application Status: ${applicationStatus.replace(/_/g, ' ')}`, emailBodyContent, siteName, logoUrl);

      if (!canAttemptRealEmail) {
        console.warn("SMTP configuration incomplete. Simulating Artist status email.");
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
        from: `${siteName} Team <${senderEmail}>`, to: ArtistEmail, subject: emailSubject, html: htmlBody,
      });

      return { success: true, message: "Artist status email sent successfully." };

    } catch (error: any) {
      console.error("Error in ArtistApplicationStatusEmailFlow:", error);
      return { success: false, message: `Email sending failed: ${error.message || 'Unknown error'}.` };
    }
  }
);

    

