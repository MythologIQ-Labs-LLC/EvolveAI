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
    const files = await client.getDriveFiles(maxResults);

    return NextResponse.json({
      success: true,
      data: files,
    });

  } catch (error) {
    console.error('Drive API Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch Drive files',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessToken, fileName, mimeType, content } = body;

    if (!accessToken || !fileName || !mimeType || !content) {
      return NextResponse.json(
        { error: 'Access token, fileName, mimeType, and content are required' },
        { status: 400 }
      );
    }

    const client = new GoogleAPIClient({ accessToken });
    const file = await client.uploadDriveFile(fileName, mimeType, content);

    return NextResponse.json({
      success: true,
      data: file,
      message: 'File uploaded successfully',
    });

  } catch (error) {
    console.error('Drive Upload Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to upload file to Drive',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 