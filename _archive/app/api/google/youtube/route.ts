import { NextRequest, NextResponse } from 'next/server';
import { GoogleAPIClient } from '@/lib/google-apis';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get('apiKey');
    const query = searchParams.get('query');
    const videoId = searchParams.get('videoId');
    const maxResults = parseInt(searchParams.get('maxResults') || '10');

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    const client = new GoogleAPIClient({ apiKey });

    if (videoId) {
      // Get specific video details
      const video = await client.getYouTubeVideoDetails(videoId);
      return NextResponse.json({
        success: true,
        data: video,
      });
    } else if (query) {
      // Search for videos
      const videos = await client.searchYouTubeVideos(query, maxResults);
      return NextResponse.json({
        success: true,
        data: videos,
      });
    } else {
      return NextResponse.json(
        { error: 'Either query or videoId is required' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('YouTube API Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch YouTube data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 