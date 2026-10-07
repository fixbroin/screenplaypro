cd /var/www/screenplaypro

# 1. Stop PM2 process
pm2 stop screenplaypro

# 2. Pull latest code from GitHub
git pull origin main

# 3. Clean Next.js build & cache directories completely
rm -rf .next
rm -rf node_modules/.cache

# 4. Install dependencies & Build
npm install
npm run build

# 5. Restart PM2 with fresh environment reload
pm2 restart screenplaypro --update-env