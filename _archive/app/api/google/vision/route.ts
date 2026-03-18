import { NextRequest, NextResponse } from 'next/server';
import { GoogleAPIClient } from '@/lib/google-apis';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, imageUrl } = body;

    if (!apiKey || !imageUrl) {
      return NextResponse.json(
        { error: 'API key and image URL are required' },
        { status: 400 }
      );
    }

    const client = new GoogleAPIClient({ apiKey });
    const analysis = await client.analyzeImage(imageUrl);

    return NextResponse.json({
      success: true,
      data: analysis,
    });

  } catch (error) {
    console.error('Vision API Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to analyze image',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 