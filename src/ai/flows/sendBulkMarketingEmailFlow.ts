
'use server';
/**
 * @fileOverview A Genkit flow to send a marketing email to multiple users,
 * replacing merge tags with user-specific data.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { queryDb } from '@/lib/mysql';
import type { FirestoreUser, AppSettings, GlobalWebSettings, FirestoreService, FirestoreCategory } from '@/types/firestore';
import { sendMarketingEmail } from './sendMarketingEmailFlow';
import { getBaseUrl } from '@/lib/config';

// Helper to safely get nested properties
const get = (obj: any, path: string, defaultValue: any = ''): any => {
    const keys = path.split('.');
    let result = obj;
    for (const key of keys) {
        if (result && typeof result === 'object' && key in result) {
            result = result[key];
        } else {
            return defaultValue;
        }
    }
    return result;
};

// Input schema for the bulk marketing email flow
const BulkMarketingEmailInputSchema = z.object({
  targetUserIds: z.union([z.literal('all'), z.array(z.string())]).describe("Either 'all' to send to all users, or an array of specific user IDs."),
  subject: z.string().describe("The subject line of the email."),
  body: z.string().describe("The HTML content of the email body, with merge tags like {{name}}."),
  categoryIdForServices: z.string().optional(), // New field for category-specific services
});

export type BulkMarketingEmailInput = z.infer<typeof BulkMarketingEmailInputSchema>;

// Exported function that calls the flow
export async function sendBulkMarketingEmail(input: BulkMarketingEmailInput): Promise<{ success: boolean; message: string }> {
  try {
    return await bulkMarketingEmailFlow(input);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("sendBulkMarketingEmail: Error calling flow:", error);
    return { success: false, message: `Failed to process bulk email flow.` };
  }
}

// The main flow definition
const bulkMarketingEmailFlow = ai.defineFlow(
  {
    name: 'bulkMarketingEmailFlow',
    inputSchema: BulkMarketingEmailInputSchema,
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async (input) => {
    try {
      console.log("====== BULK MARKETING EMAIL FLOW START ======");

      // 1. Fetch settings (SMTP, company details)
      const appConfigRows = await queryDb<any[]>("SELECT config FROM app_settings WHERE setting_key = 'applicationConfig'");
      const globalSettingsRows = await queryDb<any[]>("SELECT config FROM webSettings WHERE id = 'global'");

      const appConfig: AppSettings = appConfigRows.length > 0 ? (typeof appConfigRows[0].config === 'string' ? JSON.parse(appConfigRows[0].config) : appConfigRows[0].config) : {} as any;
      const globalSettings: GlobalWebSettings = globalSettingsRows.length > 0 ? (typeof globalSettingsRows[0].config === 'string' ? JSON.parse(globalSettingsRows[0].config) : globalSettingsRows[0].config) : {} as any;

      if (!appConfig.smtpHost || !appConfig.senderEmail) {
        throw new Error("SMTP settings are incomplete. Cannot send emails.");
      }

      // Fetch dynamic content for merge tags
      const baseUrl = getBaseUrl();
      
      // STYLING FOR LISTS (Matching new design standards)
      const listStyle = 'list-style: none; padding: 0; margin: 10px 0;';
      const itemStyle = 'padding: 8px 0; border-bottom: 1px solid #f0f0f0;';
      const linkStyle = 'color: #0B5ED7; text-decoration: none; font-weight: 500;';

      // Fetch services & categories from MySQL
      const serviceRows = await queryDb<any[]>("SELECT data FROM generic_collections WHERE collectionName = 'adminServices'");
      const categoryRows = await queryDb<any[]>("SELECT data FROM generic_collections WHERE collectionName = 'adminCategories'");
      const subCategoryRows = await queryDb<any[]>("SELECT data FROM generic_collections WHERE collectionName = 'adminSubCategories'");

      const services: FirestoreService[] = serviceRows.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data);
      const categories: FirestoreCategory[] = categoryRows.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data);
      const subCategories: any[] = subCategoryRows.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data);

      const activeServices = services.filter(s => s.isActive);
      const popularServicesHtml = `<ul style="${listStyle}">${activeServices.slice(0, 5).map(s => `<li style="${itemStyle}"><a href="${baseUrl}/service/${s.slug}" style="${linkStyle}">${s.name}</a></li>`).join('')}</ul>`;
      const popularCategoriesHtml = `<ul style="${listStyle}">${categories.slice(0, 5).map(c => `<li style="${itemStyle}"><a href="${baseUrl}/category/${c.slug}" style="${linkStyle}">${c.name}</a></li>`).join('')}</ul>`;

      const allServicesHtml = `<ul style="${listStyle}">${activeServices.map(s => `<li style="${itemStyle}"><a href="${baseUrl}/service/${s.slug}" style="${linkStyle}">${s.name}</a></li>`).join('')}</ul>`;
      const allCategoriesHtml = `<ul style="${listStyle}">${categories.map(c => `<li style="${itemStyle}"><a href="${baseUrl}/category/${c.slug}" style="${linkStyle}">${c.name}</a></li>`).join('')}</ul>`;

      let categoryServicesHtml = '';
      if (input.categoryIdForServices) {
        const subCatIds = subCategories.filter(sc => sc.parentId === input.categoryIdForServices).map(sc => sc.id);
        if (subCatIds.length > 0) {
            const categoryServices = activeServices.filter(s => subCatIds.includes(s.subCategoryId));
            categoryServicesHtml = `<ul style="${listStyle}">${categoryServices.map(s => `<li style="${itemStyle}"><a href="${baseUrl}/service/${s.slug}" style="${linkStyle}">${s.name}</a></li>`).join('')}</ul>`;
        }
      }

      // 2. Fetch target users
      let users: FirestoreUser[] = [];
      if (input.targetUserIds === 'all') {
        const userRows = await queryDb<any[]>("SELECT * FROM users");
        users = userRows as FirestoreUser[];
      } else if (Array.isArray(input.targetUserIds) && input.targetUserIds.length > 0) {
        const placeholders = input.targetUserIds.map(() => '?').join(',');
        const userRows = await queryDb<any[]>(`SELECT * FROM users WHERE id IN (${placeholders})`, input.targetUserIds);
        users = userRows as FirestoreUser[];
      }

      if (users.length === 0) {
        return { success: true, message: "No target users found." };
      }

      // 3. Iterate, replace tags, and send emails
      let successfulSends = 0;
      let failedSends = 0;

      const appDetails = {
        websiteName: globalSettings.websiteName || 'Screenplay Pro',
        websiteUrl: getBaseUrl(),
        supportEmail: globalSettings.contactEmail || 'support@screenplaypro.in',
        companyAddress: globalSettings.address || '',
        logoUrl: globalSettings.logoUrl || '',
      };
      
      for (const user of users) {
        if (!user.email) continue;

        let emailBody = input.body;
        let emailSubject = input.subject;

        const mergeData = {
          name: user.displayName || 'Valued Customer',
          email: user.email,
          mobile: user.mobileNumber || '',
          signupDate: user.createdAt?.toDate().toLocaleDateString('en-IN') || '',
          websiteName: appDetails.websiteName,
          websiteUrl: appDetails.websiteUrl,
          supportEmail: appDetails.supportEmail,
          companyAddress: appDetails.companyAddress,
          popular_services: popularServicesHtml,
          popular_categories: popularCategoriesHtml,
          all_services: allServicesHtml,
          all_categories: allCategoriesHtml,
          category_services: categoryServicesHtml,
        };

        // Replace tags
        for (const [key, value] of Object.entries(mergeData)) {
            const tag = new RegExp(`{{${key}}}`, 'g');
            emailBody = emailBody.replace(tag, value || '');
            emailSubject = emailSubject.replace(tag, value || '');
        }

        // Send email via the single marketing email flow (which already uses the new design)
        const result = await sendMarketingEmail({
          toEmail: user.email,
          subject: emailSubject,
          htmlBody: emailBody,
          smtpHost: appConfig.smtpHost,
          smtpPort: appConfig.smtpPort,
          smtpUser: appConfig.smtpUser,
          smtpPass: appConfig.smtpPass,
          senderEmail: appConfig.senderEmail,
          siteName: appDetails.websiteName,
          logoUrl: appDetails.logoUrl,
        });

        if (result.success) {
          successfulSends++;
        } else {
          failedSends++;
        }
      }

      return { success: true, message: `Email campaign finished. Sent: ${successfulSends}. Failed: ${failedSends}.` };

    } catch (error) {
      console.error("CRITICAL ERROR in bulkMarketingEmailFlow:", error);
      return { success: false, message: `Bulk flow failed.` };
    }
  }
);
