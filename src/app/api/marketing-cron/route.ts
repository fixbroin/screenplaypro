import { type NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/mysql';
import { sendMarketingEmail } from '@/ai/flows/sendMarketingEmailFlow';
import type { MarketingAutomationSettings, AppSettings, GlobalWebSettings, FirestoreUser, UserCart } from '@/types/firestore';
import { getBaseUrl } from '@/lib/config';

function getTimestampMillis(ts: any): number {
  if (!ts) return 0;
  if (typeof ts === 'object') {
    if (ts.seconds !== undefined) return ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000;
    if (ts._seconds !== undefined) return ts._seconds * 1000 + (ts._nanoseconds || 0) / 1000000;
    if (ts instanceof Date) return ts.getTime();
  }
  if (typeof ts === 'string') {
    const date = new Date(ts);
    return isNaN(date.getTime()) ? 0 : date.getTime();
  }
  return typeof ts === 'number' ? ts : 0;
}

const toMs = (delay?: MarketingAutomationSettings['noBookingReminderDelay']): number => {
    if (!delay) return 0;
    const { days = 0, hours = 0, minutes = 0 } = delay;
    return (days * 86400000) + (hours * 3600000) + (minutes * 60000);
};

const replaceMergeTags = (
    template: string,
    user: FirestoreUser,
    appConfig: AppSettings,
    globalSettings: GlobalWebSettings,
    dynamicContent: {
        popularServicesHtml: string;
        cartContentHtml: string;
        popularCategoriesHtml: string;
        allServicesHtml: string;
        allCategoriesHtml: string;
        categoryServicesHtml: string;
    }
): string => {
    const cartLink = `${getBaseUrl()}/cart`;
    let body = template;
    body = body.replace(/\{\{name\}\}/g, user.displayName || 'Valued Customer');
    body = body.replace(/\{\{email\}\}/g, user.email || '');
    body = body.replace(/\{\{mobile\}\}/g, user.mobileNumber || '');
    body = body.replace(/\{\{signupDate\}\}/g, (() => {
        const millis = getTimestampMillis(user.createdAt);
        return millis ? new Date(millis).toLocaleDateString('en-IN') : '';
    })());
    
    body = body.replace(/\{\{websiteName\}\}/g, globalSettings.websiteName || 'Screenplay Pro');
    body = body.replace(/\{\{websiteUrl\}\}/g, getBaseUrl());
    body = body.replace(/\{\{supportEmail\}\}/g, globalSettings.contactEmail || 'support@screenplaypro.in');
    body = body.replace(/\{\{companyAddress\}\}/g, globalSettings.address || 'Company Address');
    
    body = body.replace(/\{\{popular_services\}\}/g, dynamicContent.popularServicesHtml);
    body = body.replace(/\{\{popular_categories\}\}/g, dynamicContent.popularCategoriesHtml);
    body = body.replace(/\{\{all_services\}\}/g, dynamicContent.allServicesHtml);
    body = body.replace(/\{\{all_categories\}\}/g, dynamicContent.allCategoriesHtml);
    body = body.replace(/\{\{cart_items\}\}/g, dynamicContent.cartContentHtml);
    const firstCartItemName = dynamicContent.cartContentHtml.match(/<li>(.*?)<\/li>/)?.[1]?.replace(/ \(x\d+\)/, '') || 'Your items';
    body = body.replace(/\{\{cart_item_name\}\}/g, firstCartItemName);
    body = body.replace(/\{\{cart_link\}\}/g, cartLink);
    body = body.replace(/\{\{category_services\}\}/g, dynamicContent.categoryServicesHtml);

    return body;
};

export async function GET(req: NextRequest) {
    const secret = new URL(req.url).searchParams.get('secret');
    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const now = Date.now();
        console.log("Marketing cron job started at:", new Date(now).toISOString());

        const [marketingRows, appRows, webRows] = await Promise.all([
             queryDb<any[]>("SELECT setting_value FROM app_settings WHERE setting_key = 'marketingConfiguration'").catch(() => []),
             queryDb<any[]>("SELECT setting_value FROM app_settings WHERE setting_key = 'applicationConfig'").catch(() => []),
             queryDb<any[]>("SELECT config FROM webSettings WHERE id = 'global'").catch(() => [])
        ]);
        
        if (marketingRows.length === 0) {
            console.log("Settings not found in MySQL. Aborting cron job.");
            return NextResponse.json({ status: 'Settings not found' }, { status: 200 });
        }
        
        const marketingConfig = JSON.parse(marketingRows[0].setting_value) as MarketingAutomationSettings;
        const appConfig = appRows.length > 0 ? JSON.parse(appRows[0].setting_value) : {} as AppSettings;
        const globalSettings = webRows.length > 0 ? JSON.parse(webRows[0].config) : {} as GlobalWebSettings;

        const anyEnabled = marketingConfig.noBookingReminderEnabled || 
                           marketingConfig.abandonedCartEnabled || 
                           marketingConfig.recurringEngagementEnabled;
        
        if (!anyEnabled) {
            console.log("No marketing features enabled. Exiting.");
            return NextResponse.json({ status: 'ok', sent: 0, message: 'No features enabled' });
        }

        let emailsSent = 0;
        console.log(`Marketing cron job finished. Sent ${emailsSent} emails.`);
        return NextResponse.json({ status: 'ok', sent: emailsSent });

    } catch (error) {
        console.error("Error in marketing cron job:", error);
        return NextResponse.json({ status: 'error', error: (error as Error).message }, { status: 500 });
    }
}
