import { NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/mysql';

const SETTING_KEY = 'mobile_app_update';

export interface MobileAppUpdateConfig {
  isEnabled: boolean;
  forceUpdate: boolean;
  versionName: string;
  versionCode: number;
  playStoreUrl: string;
  title: string;
  message: string;
  updatedAt?: string;
}

const DEFAULT_CONFIG: MobileAppUpdateConfig = {
  isEnabled: false,
  forceUpdate: true,
  versionName: '',
  versionCode: 0,
  playStoreUrl: 'https://play.google.com/store/apps/details?id=com.fixbro.newtalent',
  title: 'New Update Available!',
  message:
    'A new version of Screenplay Pro is available on Google Play Store with improved any-to-any language translation, faster performance, and bug fixes. Please update the app to continue.',
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  try {
    const rows = await queryDb<any[]>(
      'SELECT setting_value, updatedAt FROM app_settings WHERE setting_key = ?',
      [SETTING_KEY]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { success: true, data: DEFAULT_CONFIG },
        { headers: corsHeaders }
      );
    }

    let parsed: Partial<MobileAppUpdateConfig> = {};
    try {
      parsed =
        typeof rows[0].setting_value === 'string'
          ? JSON.parse(rows[0].setting_value)
          : rows[0].setting_value || {};
    } catch {
      parsed = {};
    }

    const config: MobileAppUpdateConfig = {
      isEnabled: parsed.isEnabled ?? DEFAULT_CONFIG.isEnabled,
      forceUpdate: parsed.forceUpdate ?? DEFAULT_CONFIG.forceUpdate,
      versionName: String(parsed.versionName || DEFAULT_CONFIG.versionName).trim(),
      versionCode: Number(parsed.versionCode ?? DEFAULT_CONFIG.versionCode) || DEFAULT_CONFIG.versionCode,
      playStoreUrl: String(parsed.playStoreUrl || DEFAULT_CONFIG.playStoreUrl).trim(),
      title: String(parsed.title || DEFAULT_CONFIG.title).trim(),
      message: String(parsed.message || DEFAULT_CONFIG.message).trim(),
      updatedAt: parsed.updatedAt || rows[0].updatedAt || new Date().toISOString(),
    };

    return NextResponse.json(
      { success: true, data: config },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Error fetching mobile app update config:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load update settings', data: DEFAULT_CONFIG },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const config: MobileAppUpdateConfig = {
      isEnabled: Boolean(body.isEnabled ?? true),
      forceUpdate: Boolean(body.forceUpdate ?? true),
      versionName: String(body.versionName || DEFAULT_CONFIG.versionName).trim(),
      versionCode: Number(body.versionCode ?? DEFAULT_CONFIG.versionCode) || 1,
      playStoreUrl: String(body.playStoreUrl || DEFAULT_CONFIG.playStoreUrl).trim(),
      title: String(body.title || DEFAULT_CONFIG.title).trim(),
      message: String(body.message || DEFAULT_CONFIG.message).trim(),
      updatedAt: new Date().toISOString(),
    };

    const valueStr = JSON.stringify(config);

    await queryDb(
      `INSERT INTO app_settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updatedAt = NOW()`,
      [SETTING_KEY, valueStr]
    );

    return NextResponse.json(
      { success: true, data: config },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Error saving mobile app update config:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save update settings' },
      { status: 500, headers: corsHeaders }
    );
  }
}
