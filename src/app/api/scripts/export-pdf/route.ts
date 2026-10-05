import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import { Script, ScriptElement } from '@/types/script';
import fs from 'fs';
import path from 'path';

const ELEMENT_STYLES: Record<string, string> = {
  'scene-heading': 'font-weight: bold; text-transform: uppercase; line-height: 1.2;',
  'action': 'line-height: 1.2;',
  'character': 'text-align: center; width: 50%; margin: 0 auto; font-weight: bold; text-transform: uppercase; line-height: 1.2;',
  'parenthetical': 'text-align: center; width: 30%; margin: 0 auto; font-style: italic; line-height: 1.1;',
  'dialogue': 'text-align: center; width: 70%; margin: 0 auto; line-height: 1.2;',
  'transition': 'text-align: right; text-transform: uppercase; line-height: 1.2;',
  'note': 'font-style: italic; color: #666; background: #f4f4f4; padding: 5pt; font-size: 10pt; line-height: 1.2;'
};

const ELEMENT_LABELS: Record<string, string> = {
  'scene-heading': 'SCENE HEADING',
  'action': 'ACTION',
  'character': 'CHARACTER',
  'parenthetical': 'PARENTHETICAL',
  'dialogue': 'DIALOGUE',
  'transition': 'TRANSITION',
  'note': 'NOTE'
};

function getElementHtml(el: ScriptElement, showLabels: boolean = true) {
  let inlineStyle = ELEMENT_STYLES[el.type] || '';
  if (el.color) inlineStyle += `color: ${el.color};`;
  if (el.highlight) inlineStyle += `background-color: ${el.highlight};`;
  if (el.fontWeight === 'bold') inlineStyle += `font-weight: bold;`;
  if (el.fontSize === 'small') inlineStyle += `font-size: 10pt;`;
  if (el.fontSize === 'large') inlineStyle += `font-size: 14pt;`;

  // Define the spacing between blocks
  let marginTop = '12pt';
  if (el.type === 'scene-heading') marginTop = '25pt';
  if (el.type === 'character') marginTop = '18pt';
  if (el.type === 'parenthetical' || el.type === 'dialogue') marginTop = '2pt'; // Tighten dialogue blocks

  if (!showLabels) {
    return `<div style="width: 100%; margin-top: ${marginTop}; ${inlineStyle}">${el.text}</div>`;
  }

  const labelText = ELEMENT_LABELS[el.type] || el.type.toUpperCase().replace('-', ' ');
  
  // Style for the small label
  let labelStyle = 'font-size: 7pt; color: #999; text-transform: uppercase; font-family: sans-serif; font-weight: bold; margin-bottom: 2pt; line-height: 1;';
  
  // Center labels for characters, parentheticals, and dialogue
  if (el.type === 'character' || el.type === 'parenthetical' || el.type === 'dialogue') {
    labelStyle += ' text-align: center;';
  } else if (el.type === 'transition') {
    labelStyle += ' text-align: right;';
  }

  return `
    <div style="width: 100%; margin-top: ${marginTop}; display: flex; flex-direction: column;">
      <div style="${labelStyle}">${labelText}</div>
      <div style="${inlineStyle}">${el.text}</div>
    </div>
  `;
}



let localFontsCss = '';
try {
  const fontsCssPath = path.join(process.cwd(), 'public/fonts/local_fonts.css');
  if (fs.existsSync(fontsCssPath)) {
    const rawCss = fs.readFileSync(fontsCssPath, 'utf8');
    const absoluteFontsDir = path.join(process.cwd(), 'public/fonts').replace(/\\/g, '/');
    localFontsCss = rawCss.replace(/\/fonts\//g, `file:///${absoluteFontsDir}/`);
  }
} catch (e) {
  console.error('Error loading local fonts CSS for PDF export:', e);
}

import { adminDb } from '@/lib/firebaseAdmin';
import { ADMIN_EMAIL } from '@/lib/constants';

export async function POST(req: NextRequest) {
  let browser;
  try {
    const script: Script = await req.json();

    // Verify User Subscription on Server Side
    const ownerId = script.ownerId;
    const ownerEmail = script.ownerEmail;

    if (ownerId && ownerEmail?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      try {
        const userDoc = await adminDb.collection('users').doc(ownerId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          const isAdmin = userData?.roles?.includes('admin');
          const isSubscribed = !!userData?.subscriptionActive;
          let isExpired = false;

          if (userData?.subscriptionExpiresAt) {
            const expiresMillis = typeof userData.subscriptionExpiresAt.toMillis === 'function'
              ? userData.subscriptionExpiresAt.toMillis()
              : (userData.subscriptionExpiresAt as any)?._seconds 
                ? (userData.subscriptionExpiresAt as any)._seconds * 1000 
                : 0;
            if (expiresMillis && Date.now() > expiresMillis) {
              isExpired = true;
            }
          }

          if (!isAdmin && (!isSubscribed || isExpired)) {
            return NextResponse.json(
              { error: 'An active Screenplay Pro subscription is required to download script PDFs. Please subscribe or renew your plan.' },
              { status: 403 }
            );
          }
        }
      } catch (authError) {
        console.error("Error verifying subscription in export-pdf:", authError);
      }
    }

    const showLabels = script.settings?.showLabelsInPdf ?? true;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          ${localFontsCss}
        </style>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&family=Noto+Sans+Devanagari:wght@400;700&family=Noto+Sans+Kannada:wght@400;700&family=Noto+Sans+Telugu:wght@400;700&family=Noto+Sans+Tamil:wght@400;700&family=Noto+Sans+Malayalam:wght@400;700&family=Noto+Sans+Bengali:wght@400;700&family=Noto+Sans+Gujarati:wght@400;700&family=Noto+Sans+Gurmukhi:wght@400;700&family=Noto+Sans+Oriya:wght@400;700&family=Courier+Prime:wght@400;700&display=swap" rel="stylesheet">
        <style>
          @page { size: A4; margin: 1in; }
          body {
            font-family: 'Courier Prime', 'Noto Sans', 'Noto Sans Devanagari', 'Noto Sans Kannada', 'Noto Sans Telugu', 'Noto Sans Tamil', 'Noto Sans Malayalam', 'Noto Sans Bengali', 'Noto Sans Gujarati', 'Noto Sans Gurmukhi', 'Noto Sans Oriya', sans-serif;
            font-size: 12pt;
            line-height: 1.3;
            color: black;
            margin: 0;
            padding: 0;
          }
          .title-page {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 9in;
            text-align: center;
            page-break-after: always;
          }
          .title-page h1 { font-size: 28pt; text-transform: uppercase; margin-bottom: 40pt; }
          .title-page .written-by { font-size: 14pt; margin-bottom: 5pt; }
          .title-page .author { font-size: 14pt; font-weight: bold; text-decoration: underline; text-transform: uppercase; }
          .content { width: 100%; }
        </style>
      </head>
      <body>
        <div class="title-page">
          <h1>${script.title}</h1>
          <div class="written-by">Written by</div>
          <div class="author">${script.writtenBy || 'Author'}</div>
        </div>
        <div class="content">
          ${script.content.map(el => getElementHtml(el, showLabels)).join('')}
        </div>
      </body>
      </html>
    `;

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    });
    
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="font-family: sans-serif; font-size: 11px; width: 100%; padding: 0 0.5in; display: flex; justify-content: space-between; color: #666; border-top: 1px solid #eee; padding-top: 5px;">
          <div style="width: 30%; text-align: left;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
          <div style="width: 40%; text-align: center;">Powered by screenplaypro.in</div>
          <div style="width: 30%; text-align: right;">Copyright © ${script.writtenBy || 'Author'}</div>
        </div>
      `,
      margin: { top: '1in', bottom: '1in', left: '1in', right: '1in' }
    });

    return new NextResponse(pdf as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${script.title.replace(/\s+/g, '_')}.pdf"`,
      },
    });
  } catch (error) {
    console.error('PDF Export Error:', error);
    return NextResponse.json({ error: (error as Error).message || 'Failed to generate PDF' }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}
