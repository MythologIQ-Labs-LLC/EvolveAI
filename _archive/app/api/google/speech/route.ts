import { NextRequest, NextResponse } from 'next/server';
import { GoogleAPIClient } from '@/lib/google-apis';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, audioContent, languageCode } = body;

    if (!apiKey || !audioContent) {
      return NextResponse.json(
        { error: 'API key and audio content are required' },
        { status: 400 }
      );
    }

    const client = new GoogleAPIClient({ apiKey });
    const transcript = await client.transcribeAudio(audioContent, languageCode || 'en-US');

    return NextResponse.json({
      success: true,
      data: { transcript },
    });

  } catch (error) {
    console.error('Speech API Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to transcribe audio',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 