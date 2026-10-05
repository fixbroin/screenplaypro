const fs = require('fs');
const path = require('path');
const https = require('https');

const fontsDir = path.join(__dirname, '../public/fonts');
const assetsFontsDir = path.join(__dirname, '../public/assets/fonts');

if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}
if (!fs.existsSync(assetsFontsDir)) {
  fs.mkdirSync(assetsFontsDir, { recursive: true });
}

// User-Agent for Google Fonts to return woff2 or ttf
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const googleFontsUrl = 'https://fonts.googleapis.com/css2?' + [
  'family=Noto+Sans:wght@400;700',
  'family=Noto+Sans+Devanagari:wght@400;700',
  'family=Noto+Sans+Kannada:wght@400;700',
  'family=Noto+Sans+Telugu:wght@400;700',
  'family=Noto+Sans+Tamil:wght@400;700',
  'family=Noto+Sans+Malayalam:wght@400;700',
  'family=Noto+Sans+Bengali:wght@400;700',
  'family=Noto+Sans+Gujarati:wght@400;700',
  'family=Noto+Sans+Gurmukhi:wght@400;700',
  'family=Noto+Sans+Oriya:wght@400;700',
  'family=Courier+Prime:wght@400;700',
].join('&') + '&display=swap';

function fetchUrl(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location, headers).then(resolve).catch(reject);
      }
      let data = [];
      res.on('data', (chunk) => data.push(chunk));
      res.on('end', () => resolve({ buffer: Buffer.concat(data), text: Buffer.concat(data).toString('utf8') }));
    }).on('error', reject);
  });
}

async function downloadFonts() {
  console.log('Fetching Google Fonts CSS...');
  const { text: cssText } = await fetchUrl(googleFontsUrl, { 'User-Agent': USER_AGENT });

  fs.writeFileSync(path.join(fontsDir, 'indian_languages_fonts.css'), cssText);
  fs.writeFileSync(path.join(assetsFontsDir, 'indian_languages_fonts.css'), cssText);
  console.log('Saved CSS file.');

  // Extract all font file URLs
  const urlRegex = /url\((https:\/\/[^)]+)\)/g;
  let match;
  let fontIndex = 0;
  let localCss = cssText;

  while ((match = urlRegex.exec(cssText)) !== null) {
    const fontUrl = match[1];
    fontIndex++;
    const ext = fontUrl.endsWith('.woff2') ? '.woff2' : fontUrl.endsWith('.ttf') ? '.ttf' : '.woff';
    const filename = `font_${fontIndex}${ext}`;
    const targetPath = path.join(fontsDir, filename);
    const targetAssetPath = path.join(assetsFontsDir, filename);

    console.log(`Downloading font ${fontIndex}: ${filename}...`);
    const { buffer } = await fetchUrl(fontUrl);
    fs.writeFileSync(targetPath, buffer);
    fs.writeFileSync(targetAssetPath, buffer);

    localCss = localCss.replace(fontUrl, `/fonts/${filename}`);
  }

  // Save local-referencing CSS
  fs.writeFileSync(path.join(fontsDir, 'local_fonts.css'), localCss);
  fs.writeFileSync(path.join(assetsFontsDir, 'local_fonts.css'), localCss);
  console.log('Downloaded all font files and created local_fonts.css successfully!');
}

downloadFonts().catch((err) => {
  console.error('Error downloading fonts:', err);
  process.exit(1);
});
