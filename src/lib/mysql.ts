import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'srv841.hstgr.io',
  user: process.env.MYSQL_USER || 'u205953244_screenplaypro',
  password: process.env.MYSQL_PASSWORD || '*Sri5565',
  database: process.env.MYSQL_DATABASE || 'u205953244_screenplaypro',
  port: Number(process.env.MYSQL_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 20000,
});

let isInitialized = false;

export async function initDb() {
  if (isInitialized) return;

  try {
    const connection = await pool.getConnection();

    try {
      // 1. Users Table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(128) PRIMARY KEY,
          email VARCHAR(255),
          displayName VARCHAR(255),
          username VARCHAR(255),
          passwordHash VARCHAR(255),
          mobileNumber VARCHAR(50),
          mobileNumberVerified TINYINT(1) DEFAULT 0,
          photoURL TEXT,
          isActive TINYINT(1) DEFAULT 1,
          roles JSON,
          subscriptionActive TINYINT(1) DEFAULT 0,
          currentSubscriptionId VARCHAR(128),
          subscriptionPlanName VARCHAR(255),
          subscriptionExpiresAt DATETIME,
          lastSubscriptionAt DATETIME,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_email (email),
          INDEX idx_username (username)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 2. Scripts Table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS scripts (
          id VARCHAR(128) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          writtenBy VARCHAR(255),
          content LONGTEXT,
          ownerId VARCHAR(128),
          ownerEmail VARCHAR(255),
          collaborators JSON,
          isPublic TINYINT(1) DEFAULT 0,
          publicPermission VARCHAR(50) DEFAULT 'view',
          shareId VARCHAR(50),
          settings JSON,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_ownerId (ownerId),
          INDEX idx_shareId (shareId)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 3. Admin Subscription Plans Table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS adminSubscriptionPlans (
          id VARCHAR(128) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          price DECIMAL(10,2) NOT NULL,
          durationDays INT NOT NULL,
          features JSON,
          isActive TINYINT(1) DEFAULT 1,
          \`order\` INT DEFAULT 1,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 4. User Subscriptions Table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS userSubscriptions (
          id VARCHAR(128) PRIMARY KEY,
          userId VARCHAR(128) NOT NULL,
          planId VARCHAR(128) NOT NULL,
          planName VARCHAR(255),
          amount DECIMAL(10,2),
          startDate DATETIME,
          endDate DATETIME,
          status VARCHAR(50) DEFAULT 'active',
          razorpayOrderId VARCHAR(255),
          razorpayPaymentId VARCHAR(255),
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_userId (userId)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 5. Web Settings Table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS webSettings (
          id VARCHAR(128) PRIMARY KEY,
          config LONGTEXT NOT NULL,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 6. Slideshows Table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS slideshows (
          id VARCHAR(128) PRIMARY KEY,
          title VARCHAR(255),
          subtitle VARCHAR(255),
          imageUrl TEXT NOT NULL,
          ctaText VARCHAR(255),
          ctaLink VARCHAR(255),
          \`order\` INT DEFAULT 1,
          isActive TINYINT(1) DEFAULT 1,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 7. SEO Overrides Table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS seoOverrides (
          id VARCHAR(128) PRIMARY KEY,
          path VARCHAR(255) NOT NULL,
          h1_title VARCHAR(255),
          seo_title VARCHAR(255),
          seo_description TEXT,
          seo_keywords TEXT,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_path (path)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 8. Account Deletion Requests Table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS accountDeletionRequests (
          id VARCHAR(128) PRIMARY KEY,
          userId VARCHAR(128) NOT NULL,
          userEmail VARCHAR(255),
          displayName VARCHAR(255),
          reason TEXT,
          status VARCHAR(50) DEFAULT 'pending',
          requestedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_userId (userId)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      isInitialized = true;
      console.log("MySQL Database schema initialized successfully.");
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error initializing MySQL tables:", error);
  }
}

// Automatically trigger database initialization on load
initDb();

export async function queryDb<T = any>(sql: string, params: any[] = []): Promise<T> {
  await initDb();
  const [rows] = await pool.execute(sql, params);
  return rows as T;
}

export default pool;
