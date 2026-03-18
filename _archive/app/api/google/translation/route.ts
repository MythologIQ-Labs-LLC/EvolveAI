import { NextRequest, NextResponse } from 'next/server';
import { GoogleAPIClient } from '@/lib/google-apis';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, text, targetLanguage, sourceLanguage } = body;

    if (!apiKey || !text || !targetLanguage) {
      return NextResponse.json(
        { error: 'API key, text, and target language are required' },
        { status: 400 }
      );
    }

    const client = new GoogleAPIClient({ apiKey });
    const result = await client.translateText(text, targetLanguage, sourceLanguage);

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error('Translation API Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to translate text',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 