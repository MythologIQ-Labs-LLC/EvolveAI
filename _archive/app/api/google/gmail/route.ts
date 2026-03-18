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
    const messages = await client.getGmailMessages(maxResults);

    return NextResponse.json({
      success: true,
      data: messages,
    });

  } catch (error) {
    console.error('Gmail API Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch Gmail messages',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessToken, to, subject, body: emailBody } = body;

    if (!accessToken || !to || !subject || !emailBody) {
      return NextResponse.json(
        { error: 'Access token, to, subject, and body are required' },
        { status: 400 }
      );
    }

    const client = new GoogleAPIClient({ accessToken });
    const success = await client.sendGmailMessage(to, subject, emailBody);

    return NextResponse.json({
      success,
      message: success ? 'Email sent successfully' : 'Failed to send email',
    });

  } catch (error) {
    console.error('Gmail Send Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send Gmail message',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 