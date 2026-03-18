import { NextRequest, NextResponse } from 'next/server';
import { GoogleAPIClient } from '@/lib/google-apis';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get('apiKey');
    const query = searchParams.get('query');
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    if (!apiKey || !query) {
      return NextResponse.json(
        { error: 'API key and query are required' },
        { status: 400 }
      );
    }

    const client = new GoogleAPIClient({ apiKey });
    const location = lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : undefined;
    const places = await client.searchPlaces(query, location);

    return NextResponse.json({
      success: true,
      data: places,
    });

  } catch (error) {
    console.error('Places API Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to search places',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 