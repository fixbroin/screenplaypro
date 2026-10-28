import { queryDb, initDb } from './mysql';

export interface DatabaseBackupPayload {
  version: string;
  exportedAt: string;
  source: string;
  summary: Record<string, number>;
  tables: {
    slideshows?: any[];
    app_settings?: any[];
    scripts?: any[];
    users?: any[];
    webSettings?: any[];
    adminSubscriptionPlans?: any[];
    userSubscriptions?: any[];
    seoOverrides?: any[];
    accountDeletionRequests?: any[];
    generic_collections?: any[];
  };
  // Legacy / Direct collection format compatibility
  collections?: Record<string, any[]>;
}

export interface RestoreResult {
  success: boolean;
  totalRestored: number;
  breakdown: Record<string, number>;
  errors: string[];
}

function formatDateForMySQL(dateVal: any): string | null {
  if (!dateVal) return null;
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 19).replace('T', ' ');
  } catch {
    return null;
  }
}

function ensureJsonString(val: any, defaultVal: string = '{}'): string {
  if (val === null || val === undefined) return defaultVal;
  if (typeof val === 'string') return val;
  try {
    return JSON.stringify(val);
  } catch {
    return defaultVal;
  }
}

/**
 * Exports all application database tables from MySQL into a complete structured backup object.
 */
export async function exportAllDatabaseTables(): Promise<DatabaseBackupPayload> {
  await initDb();

  const tables: DatabaseBackupPayload['tables'] = {};
  const summary: Record<string, number> = {};

  // 1. Slideshows
  try {
    const rows = await queryDb<any[]>('SELECT * FROM slideshows ORDER BY `order` ASC, createdAt DESC');
    tables.slideshows = rows || [];
    summary.slideshows = tables.slideshows.length;
  } catch (err: any) {
    console.error('Error exporting slideshows:', err?.message || err);
    tables.slideshows = [];
    summary.slideshows = 0;
  }

  // 2. App Settings (Includes Ads in featuresConfiguration, branding, etc.)
  try {
    const rows = await queryDb<any[]>('SELECT * FROM app_settings ORDER BY setting_key ASC');
    tables.app_settings = rows || [];
    summary.app_settings = tables.app_settings.length;
  } catch (err: any) {
    console.error('Error exporting app_settings:', err?.message || err);
    tables.app_settings = [];
    summary.app_settings = 0;
  }

  // 3. Scripts (Screenplays)
  try {
    const rows = await queryDb<any[]>('SELECT * FROM scripts ORDER BY updatedAt DESC');
    tables.scripts = rows || [];
    summary.scripts = tables.scripts.length;
  } catch (err: any) {
    console.error('Error exporting scripts:', err?.message || err);
    tables.scripts = [];
    summary.scripts = 0;
  }

  // 4. Users
  try {
    const rows = await queryDb<any[]>('SELECT * FROM users ORDER BY createdAt DESC');
    tables.users = rows || [];
    summary.users = tables.users.length;
  } catch (err: any) {
    console.error('Error exporting users:', err?.message || err);
    tables.users = [];
    summary.users = 0;
  }

  // 5. Web Settings
  try {
    const rows = await queryDb<any[]>('SELECT * FROM webSettings');
    tables.webSettings = rows || [];
    summary.webSettings = tables.webSettings.length;
  } catch (err: any) {
    console.error('Error exporting webSettings:', err?.message || err);
    tables.webSettings = [];
    summary.webSettings = 0;
  }

  // 6. Admin Subscription Plans
  try {
    const rows = await queryDb<any[]>('SELECT * FROM adminSubscriptionPlans ORDER BY `order` ASC');
    tables.adminSubscriptionPlans = rows || [];
    summary.adminSubscriptionPlans = tables.adminSubscriptionPlans.length;
  } catch (err: any) {
    console.error('Error exporting adminSubscriptionPlans:', err?.message || err);
    tables.adminSubscriptionPlans = [];
    summary.adminSubscriptionPlans = 0;
  }

  // 7. User Subscriptions
  try {
    const rows = await queryDb<any[]>('SELECT * FROM userSubscriptions ORDER BY createdAt DESC');
    tables.userSubscriptions = rows || [];
    summary.userSubscriptions = tables.userSubscriptions.length;
  } catch (err: any) {
    console.error('Error exporting userSubscriptions:', err?.message || err);
    tables.userSubscriptions = [];
    summary.userSubscriptions = 0;
  }

  // 8. SEO Overrides
  try {
    const rows = await queryDb<any[]>('SELECT * FROM seoOverrides');
    tables.seoOverrides = rows || [];
    summary.seoOverrides = tables.seoOverrides.length;
  } catch (err: any) {
    console.error('Error exporting seoOverrides:', err?.message || err);
    tables.seoOverrides = [];
    summary.seoOverrides = 0;
  }

  // 9. Account Deletion Requests
  try {
    const rows = await queryDb<any[]>('SELECT * FROM accountDeletionRequests ORDER BY requestedAt DESC');
    tables.accountDeletionRequests = rows || [];
    summary.accountDeletionRequests = tables.accountDeletionRequests.length;
  } catch (err: any) {
    console.error('Error exporting accountDeletionRequests:', err?.message || err);
    tables.accountDeletionRequests = [];
    summary.accountDeletionRequests = 0;
  }

  // 10. Generic Collections (FAQs, Reviews, Popups, Logs, etc.)
  try {
    const rows = await queryDb<any[]>('SELECT * FROM generic_collections ORDER BY collection_name ASC, createdAt DESC');
    tables.generic_collections = rows || [];
    summary.generic_collections = tables.generic_collections.length;
  } catch (err: any) {
    console.error('Error exporting generic_collections:', err?.message || err);
    tables.generic_collections = [];
    summary.generic_collections = 0;
  }

  // Also construct grouped collections map for direct backward compatibility
  const collectionsMap: Record<string, any[]> = {};
  if (Array.isArray(tables.generic_collections)) {
    for (const item of tables.generic_collections) {
      const collName = item.collection_name || 'misc';
      if (!collectionsMap[collName]) collectionsMap[collName] = [];
      try {
        const parsed = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
        collectionsMap[collName].push({ ...parsed, id: item.id });
      } catch {
        collectionsMap[collName].push({ id: item.id, data: item.data });
      }
    }
  }

  return {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    source: 'Screenplay Pro MySQL Database',
    summary,
    tables,
    collections: collectionsMap,
  };
}

/**
 * Restores records into corresponding MySQL tables, handling both new v2.0 format and legacy format.
 */
export async function restoreAllDatabaseTables(importData: any): Promise<RestoreResult> {
  await initDb();

  const breakdown: Record<string, number> = {};
  const errors: string[] = [];
  let totalRestored = 0;

  if (!importData || typeof importData !== 'object') {
    throw new Error('Invalid backup file data: expected JSON object.');
  }

  // Detect whether data is wrapped in tables or root-level keys
  const isV2Format = Boolean(importData.tables && typeof importData.tables === 'object');
  const sourceData = isV2Format ? importData.tables : importData;

  // ----------------------------------------------------
  // 1. Restore Slideshows (slides / shows)
  // ----------------------------------------------------
  const rawSlides = sourceData.slideshows || sourceData.adminSlideshows || (importData.collections?.adminSlideshows);
  if (Array.isArray(rawSlides) && rawSlides.length > 0) {
    let count = 0;
    for (const slide of rawSlides) {
      try {
        const slideId = slide.id || `slide_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const title = slide.title || '';
        const subtitle = slide.subtitle || slide.description || '';
        const imageUrl = slide.imageUrl || '';
        const imageHint = slide.imageHint || '';
        const ctaText = slide.ctaText || slide.buttonText || '';
        const ctaLink = slide.ctaLink || slide.buttonLinkValue || '';
        const buttonLinkType = slide.buttonLinkType || (ctaLink && !ctaLink.startsWith('http') && !ctaLink.startsWith('/') ? 'category' : 'url');
        const order = Number(slide.order || 0);
        const isActive = slide.isActive === undefined ? 1 : (slide.isActive ? 1 : 0);

        await queryDb(
          `INSERT INTO slideshows (id, title, subtitle, imageUrl, imageHint, ctaText, ctaLink, buttonLinkType, \`order\`, isActive, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             title = VALUES(title),
             subtitle = VALUES(subtitle),
             imageUrl = VALUES(imageUrl),
             imageHint = VALUES(imageHint),
             ctaText = VALUES(ctaText),
             ctaLink = VALUES(ctaLink),
             buttonLinkType = VALUES(buttonLinkType),
             \`order\` = VALUES(\`order\`),
             isActive = VALUES(isActive),
             updatedAt = NOW()`,
          [slideId, title, subtitle, imageUrl, imageHint, ctaText, ctaLink, buttonLinkType, order, isActive]
        );
        count++;
      } catch (err: any) {
        errors.push(`Slideshow ${slide.id || 'unknown'}: ${err.message}`);
      }
    }
    breakdown.slideshows = count;
    totalRestored += count;
  }

  // ----------------------------------------------------
  // 2. Restore App Settings (Includes Ads in featuresConfiguration)
  // ----------------------------------------------------
  const rawSettings = sourceData.app_settings || sourceData.settings;
  if (Array.isArray(rawSettings) && rawSettings.length > 0) {
    let count = 0;
    for (const row of rawSettings) {
      try {
        const key = row.setting_key || row.key;
        if (!key) continue;
        const valueStr = ensureJsonString(row.setting_value ?? row.data ?? row.value);
        await queryDb(
          `INSERT INTO app_settings (setting_key, setting_value, updatedAt)
           VALUES (?, ?, NOW())
           ON DUPLICATE KEY UPDATE
             setting_value = VALUES(setting_value),
             updatedAt = NOW()`,
          [key, valueStr]
        );
        count++;
      } catch (err: any) {
        errors.push(`App Setting ${row.setting_key}: ${err.message}`);
      }
    }
    breakdown.app_settings = count;
    totalRestored += count;
  } else if (sourceData.featuresConfiguration) {
    // Legacy support: featuresConfiguration passed as standalone property
    try {
      const valueStr = ensureJsonString(sourceData.featuresConfiguration);
      await queryDb(
        `INSERT INTO app_settings (setting_key, setting_value, updatedAt)
         VALUES ('featuresConfiguration', ?, NOW())
         ON DUPLICATE KEY UPDATE
           setting_value = VALUES(setting_value),
           updatedAt = NOW()`,
        [valueStr]
      );
      breakdown.app_settings = 1;
      totalRestored += 1;
    } catch (err: any) {
      errors.push(`featuresConfiguration: ${err.message}`);
    }
  }

  // ----------------------------------------------------
  // 3. Restore Scripts (Screenplays)
  // ----------------------------------------------------
  const rawScripts = sourceData.scripts || (importData.collections?.scripts);
  if (Array.isArray(rawScripts) && rawScripts.length > 0) {
    let count = 0;
    for (const s of rawScripts) {
      try {
        const scriptId = s.id || `script_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const title = s.title || 'Untitled Screenplay';
        const description = s.description || '';
        const writtenBy = s.writtenBy || '';
        const content = typeof s.content === 'string' ? s.content : JSON.stringify(s.content || '');
        const ownerId = s.ownerId || '';
        const ownerEmail = s.ownerEmail || '';
        const collaborators = ensureJsonString(s.collaborators, '[]');
        const isPublic = s.isPublic ? 1 : 0;
        const publicPermission = s.publicPermission || 'view';
        const shareId = s.shareId || '';
        const settings = ensureJsonString(s.settings, '{}');

        await queryDb(
          `INSERT INTO scripts (
             id, title, description, writtenBy, content, ownerId, ownerEmail,
             collaborators, isPublic, publicPermission, shareId, settings, createdAt, updatedAt
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             title = VALUES(title),
             description = VALUES(description),
             writtenBy = VALUES(writtenBy),
             content = VALUES(content),
             ownerId = VALUES(ownerId),
             ownerEmail = VALUES(ownerEmail),
             collaborators = VALUES(collaborators),
             isPublic = VALUES(isPublic),
             publicPermission = VALUES(publicPermission),
             shareId = VALUES(shareId),
             settings = VALUES(settings),
             updatedAt = NOW()`,
          [scriptId, title, description, writtenBy, content, ownerId, ownerEmail, collaborators, isPublic, publicPermission, shareId, settings]
        );
        count++;
      } catch (err: any) {
        errors.push(`Script ${s.id}: ${err.message}`);
      }
    }
    breakdown.scripts = count;
    totalRestored += count;
  }

  // ----------------------------------------------------
  // 4. Restore Users
  // ----------------------------------------------------
  const rawUsers = sourceData.users || (importData.collections?.users);
  if (Array.isArray(rawUsers) && rawUsers.length > 0) {
    let count = 0;
    for (const u of rawUsers) {
      try {
        const userId = u.id || u.uid;
        if (!userId) continue;
        const email = u.email || '';
        const displayName = u.displayName || 'User';
        const username = u.username || '';
        const passwordHash = u.passwordHash || '';
        const mobileNumber = u.mobileNumber || '';
        const mobileNumberVerified = u.mobileNumberVerified ? 1 : 0;
        const photoURL = u.photoURL || '';
        const isActive = u.isActive === undefined ? 1 : (u.isActive ? 1 : 0);
        const roles = ensureJsonString(u.roles, '["user"]');
        const subscriptionActive = u.subscriptionActive ? 1 : 0;
        const currentSubscriptionId = u.currentSubscriptionId || null;
        const subscriptionPlanName = u.subscriptionPlanName || null;
        const subscriptionExpiresAt = formatDateForMySQL(u.subscriptionExpiresAt);
        const lastSubscriptionAt = formatDateForMySQL(u.lastSubscriptionAt);
        const lastLoginAt = formatDateForMySQL(u.lastLoginAt);

        await queryDb(
          `INSERT INTO users (
             id, email, displayName, username, passwordHash, mobileNumber,
             mobileNumberVerified, photoURL, isActive, roles, subscriptionActive,
             currentSubscriptionId, subscriptionPlanName, subscriptionExpiresAt,
             lastSubscriptionAt, lastLoginAt, createdAt, updatedAt
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             email = COALESCE(NULLIF(VALUES(email), ''), users.email),
             displayName = COALESCE(NULLIF(VALUES(displayName), ''), users.displayName),
             username = COALESCE(NULLIF(VALUES(username), ''), users.username),
             mobileNumber = COALESCE(NULLIF(VALUES(mobileNumber), ''), users.mobileNumber),
             photoURL = COALESCE(NULLIF(VALUES(photoURL), ''), users.photoURL),
             isActive = VALUES(isActive),
             roles = VALUES(roles),
             subscriptionActive = VALUES(subscriptionActive),
             currentSubscriptionId = VALUES(currentSubscriptionId),
             subscriptionPlanName = VALUES(subscriptionPlanName),
             subscriptionExpiresAt = VALUES(subscriptionExpiresAt),
             lastSubscriptionAt = VALUES(lastSubscriptionAt),
             lastLoginAt = COALESCE(VALUES(lastLoginAt), users.lastLoginAt),
             updatedAt = NOW()`,
          [
            userId, email, displayName, username, passwordHash, mobileNumber,
            mobileNumberVerified, photoURL, isActive, roles, subscriptionActive,
            currentSubscriptionId, subscriptionPlanName, subscriptionExpiresAt,
            lastSubscriptionAt, lastLoginAt
          ]
        );
        count++;
      } catch (err: any) {
        errors.push(`User ${u.id}: ${err.message}`);
      }
    }
    breakdown.users = count;
    totalRestored += count;
  }

  // ----------------------------------------------------
  // 5. Restore Web Settings
  // ----------------------------------------------------
  const rawWebSettings = sourceData.webSettings || (importData.collections?.webSettings);
  if (Array.isArray(rawWebSettings) && rawWebSettings.length > 0) {
    let count = 0;
    for (const ws of rawWebSettings) {
      try {
        const id = ws.id || 'general';
        const configStr = typeof ws.config === 'string' ? ws.config : JSON.stringify(ws.config || ws);
        await queryDb(
          `INSERT INTO webSettings (id, config, updatedAt)
           VALUES (?, ?, NOW())
           ON DUPLICATE KEY UPDATE
             config = VALUES(config),
             updatedAt = NOW()`,
          [id, configStr]
        );
        count++;
      } catch (err: any) {
        errors.push(`WebSetting ${ws.id}: ${err.message}`);
      }
    }
    breakdown.webSettings = count;
    totalRestored += count;
  }

  // ----------------------------------------------------
  // 6. Restore Admin Subscription Plans
  // ----------------------------------------------------
  const rawPlans = sourceData.adminSubscriptionPlans || (importData.collections?.adminSubscriptionPlans);
  if (Array.isArray(rawPlans) && rawPlans.length > 0) {
    let count = 0;
    for (const p of rawPlans) {
      try {
        const planId = p.id || `plan_${Date.now()}`;
        const name = p.name || 'Plan';
        const price = Number(p.price || 0);
        const priceUsd = p.priceUsd !== undefined ? Number(p.priceUsd) : null;
        const durationDays = Number(p.durationDays || 30);
        const features = ensureJsonString(p.features, '[]');
        const isActive = p.isActive === undefined ? 1 : (p.isActive ? 1 : 0);
        const order = Number(p.order || 1);

        await queryDb(
          `INSERT INTO adminSubscriptionPlans (id, name, price, priceUsd, durationDays, features, isActive, \`order\`, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             name = VALUES(name),
             price = VALUES(price),
             priceUsd = VALUES(priceUsd),
             durationDays = VALUES(durationDays),
             features = VALUES(features),
             isActive = VALUES(isActive),
             \`order\` = VALUES(\`order\`),
             updatedAt = NOW()`,
          [planId, name, price, priceUsd, durationDays, features, isActive, order]
        );
        count++;
      } catch (err: any) {
        errors.push(`Plan ${p.id}: ${err.message}`);
      }
    }
    breakdown.adminSubscriptionPlans = count;
    totalRestored += count;
  }

  // ----------------------------------------------------
  // 7. Restore User Subscriptions
  // ----------------------------------------------------
  const rawUserSubs = sourceData.userSubscriptions || (importData.collections?.userSubscriptions);
  if (Array.isArray(rawUserSubs) && rawUserSubs.length > 0) {
    let count = 0;
    for (const sub of rawUserSubs) {
      try {
        const subId = sub.id || `sub_${Date.now()}`;
        const userId = sub.userId || '';
        const planId = sub.planId || '';
        const planName = sub.planName || '';
        const amount = Number(sub.amount || 0);
        const startDate = formatDateForMySQL(sub.startDate) || formatDateForMySQL(new Date());
        const endDate = formatDateForMySQL(sub.endDate) || formatDateForMySQL(new Date(Date.now() + 30 * 86400000));
        const status = sub.status || 'active';
        const razorpayOrderId = sub.razorpayOrderId || '';
        const razorpayPaymentId = sub.razorpayPaymentId || '';

        await queryDb(
          `INSERT INTO userSubscriptions (id, userId, planId, planName, amount, startDate, endDate, status, razorpayOrderId, razorpayPaymentId, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE
             status = VALUES(status),
             endDate = VALUES(endDate)`,
          [subId, userId, planId, planName, amount, startDate, endDate, status, razorpayOrderId, razorpayPaymentId]
        );
        count++;
      } catch (err: any) {
        errors.push(`UserSubscription ${sub.id}: ${err.message}`);
      }
    }
    breakdown.userSubscriptions = count;
    totalRestored += count;
  }

  // ----------------------------------------------------
  // 8. Restore SEO Overrides
  // ----------------------------------------------------
  const rawSeo = sourceData.seoOverrides || (importData.collections?.seoOverrides);
  if (Array.isArray(rawSeo) && rawSeo.length > 0) {
    let count = 0;
    for (const seo of rawSeo) {
      try {
        const id = seo.id || `seo_${Date.now()}`;
        const pathVal = seo.path || '/';
        const h1_title = seo.h1_title || '';
        const seo_title = seo.seo_title || '';
        const seo_description = seo.seo_description || '';
        const seo_keywords = seo.seo_keywords || '';

        await queryDb(
          `INSERT INTO seoOverrides (id, path, h1_title, seo_title, seo_description, seo_keywords, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE
             h1_title = VALUES(h1_title),
             seo_title = VALUES(seo_title),
             seo_description = VALUES(seo_description),
             seo_keywords = VALUES(seo_keywords),
             updatedAt = NOW()`,
          [id, pathVal, h1_title, seo_title, seo_description, seo_keywords]
        );
        count++;
      } catch (err: any) {
        errors.push(`SEO ${seo.id}: ${err.message}`);
      }
    }
    breakdown.seoOverrides = count;
    totalRestored += count;
  }

  // ----------------------------------------------------
  // 9. Restore Generic Collections & Legacy Collections
  // (FAQs, Reviews, Popups, PromoCodes, VisitorLogs, etc.)
  // ----------------------------------------------------
  const rawCollections = sourceData.generic_collections;
  if (Array.isArray(rawCollections) && rawCollections.length > 0) {
    let count = 0;
    for (const item of rawCollections) {
      try {
        const id = item.id;
        const collection_name = item.collection_name;
        if (!id || !collection_name) continue;
        const dataStr = typeof item.data === 'string' ? item.data : JSON.stringify(item.data || {});
        await queryDb(
          `INSERT INTO generic_collections (id, collection_name, data, createdAt, updatedAt)
           VALUES (?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             data = VALUES(data),
             updatedAt = NOW()`,
          [id, collection_name, dataStr]
        );
        count++;
      } catch (err: any) {
        errors.push(`Collection item ${item.id}: ${err.message}`);
      }
    }
    breakdown.generic_collections = count;
    totalRestored += count;
  }

  // If input format had top-level collection names like importData.adminFAQs, importData.adminReviews, etc.
  const knownTopLevelNonGeneric = new Set([
    'version', 'exportedAt', 'source', 'summary', 'tables', 'collections',
    'slideshows', 'adminSlideshows', 'app_settings', 'settings', 'featuresConfiguration',
    'scripts', 'users', 'webSettings', 'adminSubscriptionPlans', 'userSubscriptions',
    'seoOverrides', 'accountDeletionRequests', 'generic_collections'
  ]);

  for (const key of Object.keys(importData)) {
    if (!knownTopLevelNonGeneric.has(key) && Array.isArray(importData[key])) {
      let count = 0;
      for (const item of importData[key]) {
        try {
          const docId = item.id || item._id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const fullData = { ...item, id: docId };
          const dataStr = JSON.stringify(fullData);
          await queryDb(
            `INSERT INTO generic_collections (id, collection_name, data, createdAt, updatedAt)
             VALUES (?, ?, ?, NOW(), NOW())
             ON DUPLICATE KEY UPDATE
               data = VALUES(data),
               updatedAt = NOW()`,
            [docId, key, dataStr]
          );
          count++;
        } catch (err: any) {
          errors.push(`Generic ${key}/${item.id}: ${err.message}`);
        }
      }
      if (count > 0) {
        breakdown[key] = (breakdown[key] || 0) + count;
        totalRestored += count;
      }
    }
  }

  return {
    success: errors.length === 0 || totalRestored > 0,
    totalRestored,
    breakdown,
    errors
  };
}
