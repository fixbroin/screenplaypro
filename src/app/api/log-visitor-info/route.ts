import { type NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/mysql';
import { headers } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      // Handle empty/malformed request bodies gracefully
    }
    
    const { pathname, userAgent } = body;

    if (!pathname || !userAgent) {
      return NextResponse.json({ success: false, error: 'Missing required fields.' }, { status: 400 });
    }

    const headersList = await headers();
    
    const cfConnectingIp = headersList.get('cf-connecting-ip');
    const forwardedFor = headersList.get('x-forwarded-for');
    const realIp = headersList.get('x-real-ip');
    const clientIp = headersList.get('x-client-ip');
    
    let userIp = 'unknown';
    
    if (cfConnectingIp) {
        userIp = cfConnectingIp;
    } else if (forwardedFor) {
        userIp = forwardedFor.split(',')[0].trim();
    } else if (realIp) {
        userIp = realIp;
    } else if (clientIp) {
        userIp = clientIp;
    } else if ((req as any).ip) {
        userIp = (req as any).ip;
    }

    if (userIp === '::1' || userIp === 'localhost' || userIp === '::ffff:127.0.0.1') {
        userIp = '127.0.0.1';
    }
    if (userIp.startsWith('::ffff:')) {
        userIp = userIp.replace('::ffff:', '');
    }

    let geoData = {
        city: 'Unknown City',
        region: 'Unknown Region',
        country: 'Unknown Country',
        zip: 'Unknown Postal',
        isp: 'Unknown ISP'
    };

    if (userIp === '127.0.0.1') {
        geoData = {
            city: 'Local Dev',
            region: 'localhost',
            country: 'Localhost',
            zip: '000000',
            isp: 'Development Machine'
        };
    } else if (userIp !== 'unknown') {
        try {
            const geoRes = await fetch(`http://ip-api.com/json/${userIp}`);
            if (geoRes.ok) {
                const data = await geoRes.json();
                if (data.status === 'success') {
                    geoData = {
                        city: data.city || 'Unknown City',
                        region: data.regionName || 'Unknown Region',
                        country: data.country || 'Unknown Country',
                        zip: data.zip || 'Unknown Postal',
                        isp: data.isp || data.org || 'Unknown ISP'
                    };
                }
            }
            
            if (geoData.city === 'Unknown City') {
                const fallbackRes = await fetch(`https://ipapi.co/${userIp}/json/`);
                if (fallbackRes.ok) {
                    const data = await fallbackRes.json();
                    if (!data.error) {
                        geoData = {
                            city: data.city || 'Unknown City',
                            region: data.region || 'Unknown Region',
                            country: data.country_name || 'Unknown Country',
                            zip: data.postal || 'Unknown Postal',
                            isp: data.org || 'Unknown ISP'
                        };
                    }
                }
            }
        } catch (geoErr) {
            console.error("Geo lookup error on server:", geoErr);
        }
    }
    
    const docId = `vis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const visitorLog = {
      id: docId,
      ipAddress: userIp,
      city: geoData.city,
      region: geoData.region,
      countryName: geoData.country,
      postalCode: geoData.zip,
      ispOrganization: geoData.isp,
      pathname: pathname,
      userAgent: userAgent,
      timestamp: new Date().toISOString(),
    };

    await queryDb(
      'INSERT INTO generic_collections (id, collection_name, data) VALUES (?, ?, ?)',
      [docId, 'visitorInfoLogs', JSON.stringify(visitorLog)]
    );

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error in /api/log-visitor-info:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
