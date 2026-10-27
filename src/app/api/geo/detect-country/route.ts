import { type NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const headersList = await headers();
    
    // 1. Direct Cloudflare / Vercel country headers
    const cfCountry = headersList.get('cf-ipcountry');
    const vercelCountry = headersList.get('x-vercel-ip-country');
    const genericCountry = headersList.get('x-country-code');

    const headerCountry = (cfCountry || vercelCountry || genericCountry || '').trim().toUpperCase();
    if (headerCountry && headerCountry !== 'XX' && headerCountry !== 'T1' && headerCountry.length === 2) {
      return NextResponse.json({ success: true, countryCode: headerCountry, source: 'header' });
    }

    // 2. Client IP extraction
    const cfConnectingIp = headersList.get('cf-connecting-ip');
    const forwardedFor = headersList.get('x-forwarded-for');
    const realIp = headersList.get('x-real-ip');
    const clientIp = headersList.get('x-client-ip');
    
    let userIp = (cfConnectingIp || (forwardedFor ? forwardedFor.split(',')[0].trim() : '') || realIp || clientIp || (req as any).ip || '').trim();

    if (userIp.startsWith('::ffff:')) {
      userIp = userIp.replace('::ffff:', '');
    }

    // Localhost / private IP
    if (!userIp || userIp === '127.0.0.1' || userIp === '::1' || userIp === 'localhost' || userIp.startsWith('192.168.') || userIp.startsWith('10.')) {
      return NextResponse.json({ success: true, countryCode: 'IN', source: 'local_default' });
    }

    // 3. Query IP-API with short timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    try {
      const geoRes = await fetch(`http://ip-api.com/json/${userIp}?fields=status,countryCode`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (geoRes.ok) {
        const data = await geoRes.json();
        if (data.status === 'success' && data.countryCode) {
          return NextResponse.json({ success: true, countryCode: data.countryCode.toUpperCase(), source: 'ip-api' });
        }
      }
    } catch {
      // ignore
    }

    return NextResponse.json({ success: true, countryCode: 'IN', source: 'fallback' });
  } catch {
    return NextResponse.json({ success: true, countryCode: 'IN', source: 'error_fallback' });
  }
}
