import { NextRequest, NextResponse } from 'next/server';
import { GoogleAPIClient } from '@/lib/google-apis';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, text } = body;

    if (!apiKey || !text) {
      return NextResponse.json(
        { error: 'API key and text are required' },
        { status: 400 }
      );
    }

    const client = new GoogleAPIClient({ apiKey });
    const sentiment = await client.analyzeSentiment(text);

    return NextResponse.json({
      success: true,
      data: sentiment,
    });

  } catch (error) {
    console.error('Natural Language API Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to analyze sentiment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 