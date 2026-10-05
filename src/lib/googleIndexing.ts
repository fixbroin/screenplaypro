import crypto from 'crypto';
import { queryDb } from './mysql';

function base64UrlEncode(str: string | Buffer): string {
  const buf = typeof str === 'string' ? Buffer.from(str) : str;
  return buf.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export async function getGoogleIndexingToken(): Promise<string> {
  const configStr = process.env.FIREBASE_ADMIN_SDK_CONFIG;
  if (!configStr) {
    throw new Error("Missing FIREBASE_ADMIN_SDK_CONFIG env variable");
  }
  const config = JSON.parse(configStr);
  const privateKey = config.private_key;
  const clientEmail = config.client_email;

  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signatureInput);
  const signature = signer.sign(privateKey);
  const encodedSignature = base64UrlEncode(signature);

  const jwt = `${signatureInput}.${encodedSignature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to get OAuth token: ${errText}`);
  }

  const tokenData = await response.json();
  return tokenData.access_token;
}

async function logGoogleIndexing(url: string, type: string, status: 'success' | 'failure', errorMsg?: string) {
  try {
    const docId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullData = { url, type, status, error: errorMsg || null, processedDate: new Date().toISOString() };
    await queryDb(
      `INSERT INTO generic_collections (id, collection_name, data) VALUES (?, ?, ?)`,
      [docId, 'googleIndexingLogs', JSON.stringify(fullData)]
    );
  } catch (err) {
    console.error("Failed to write indexing log to MySQL:", err);
  }
}

export async function submitToGoogleIndexing(url: string, type: 'URL_UPDATED' | 'URL_DELETED' = 'URL_UPDATED') {
  try {
    const accessToken = await getGoogleIndexingToken();
    const response = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url,
        type
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Google Indexing API error for ${url}:`, errText);
      await logGoogleIndexing(url, type, 'failure', errText);
      return { success: false, error: errText };
    }

    const data = await response.json();
    console.log(`[Google Indexing] Successfully submitted URL: ${url} (${type})`);
    await logGoogleIndexing(url, type, 'success');
    return { success: true, data };
  } catch (error: any) {
    console.error(`[Google Indexing] Exception during submission for ${url}:`, error);
    await logGoogleIndexing(url, type, 'failure', error.message);
    return { success: false, error: error.message };
  }
}
