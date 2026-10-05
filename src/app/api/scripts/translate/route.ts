import { NextRequest, NextResponse } from 'next/server';
import { ScriptElement } from '@/types/script';

async function translateSingleText(text: string, targetLang: string): Promise<string> {
  if (!text || !text.trim()) return text;
  
  // 1. Primary: Google Translate Chrome Extension Client
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const translatedChunks = data[0]
          .map((chunk: any) => (Array.isArray(chunk) ? chunk[0] : ''))
          .filter(Boolean);
        const result = translatedChunks.join('');
        if (result && result.trim()) {
          return result;
        }
      }
    }
  } catch (error) {
    console.warn('Primary translation fetch error:', error);
  }

  // 2. Secondary Fallback: MyMemory API
  try {
    const fallbackUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${targetLang}`;
    const fallbackResponse = await fetch(fallbackUrl);
    if (fallbackResponse.ok) {
      const fallbackData = await fallbackResponse.json();
      if (fallbackData?.responseData?.translatedText) {
        return fallbackData.responseData.translatedText;
      }
    }
  } catch (fallbackError) {
    console.warn('Fallback translation fetch error:', fallbackError);
  }

  return text;
}

export async function POST(req: NextRequest) {
  try {
    const { elements, targetLanguage, scriptTitle } = await req.json();

    if (!elements || !Array.isArray(elements)) {
      return NextResponse.json({ error: 'Invalid script elements array' }, { status: 400 });
    }

    if (!targetLanguage) {
      return NextResponse.json({ error: 'Target language is required' }, { status: 400 });
    }

    // Batch translate all script elements concurrently in chunks of 5 to respect rate limits
    const chunkSize = 5;
    const translatedElements: ScriptElement[] = [];

    for (let i = 0; i < elements.length; i += chunkSize) {
      const chunk = elements.slice(i, i + chunkSize);
      const translatedChunk = await Promise.all(
        chunk.map(async (el: ScriptElement) => {
          // Keep element structure, id, type, color, highlight, font formatting exact
          const translatedText = await translateSingleText(el.text, targetLanguage);
          return {
            ...el,
            text: translatedText,
          };
        })
      );
      translatedElements.push(...translatedChunk);
    }

    let translatedTitle = scriptTitle;
    if (scriptTitle && scriptTitle.trim()) {
      translatedTitle = await translateSingleText(scriptTitle, targetLanguage);
    }

    return NextResponse.json({
      success: true,
      targetLanguage,
      translatedTitle,
      translatedElements,
    });
  } catch (error) {
    console.error('Script Translation Error:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to translate script' },
      { status: 500 }
    );
  }
}
