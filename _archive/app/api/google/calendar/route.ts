import { NextRequest, NextResponse } from 'next/server';
import { GoogleAPIClient } from '@/lib/google-apis';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accessToken = searchParams.get('accessToken');
    const maxResults = parseInt(searchParams.get('maxResults') || '10');

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access token is required' },
        { status: 400 }
      );
    }

    const client = new GoogleAPIClient({ accessToken });
    const events = await client.getCalendarEvents(maxResults);

    return NextResponse.json({
      success: true,
      data: events,
    });

  } catch (error) {
    console.error('Calendar API Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch calendar events',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessToken, event } = body;

    if (!accessToken || !event) {
      return NextResponse.json(
        { error: 'Access token and event data are required' },
        { status: 400 }
      );
    }

    const client = new GoogleAPIClient({ accessToken });
    const createdEvent = await client.createCalendarEvent(event);

    return NextResponse.json({
      success: true,
      data: createdEvent,
      message: 'Event created successfully',
    });

  } catch (error) {
    console.error('Calendar Create Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create calendar event',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 