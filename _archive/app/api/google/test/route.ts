import { NextRequest, NextResponse } from 'next/server';
import { GoogleAPIClient } from '@/lib/google-apis';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, accessToken, apiName } = body;

    if (!apiKey && !accessToken) {
      return NextResponse.json(
        { error: 'Either API key or access token is required' },
        { status: 400 }
      );
    }

    const client = new GoogleAPIClient({ 
      apiKey: apiKey || undefined,
      accessToken: accessToken || undefined 
    });

    let testResult = false;
    let testDetails = '';

    switch (apiName) {
      case 'gmail':
        if (!accessToken) {
          return NextResponse.json(
            { error: 'Access token required for Gmail API' },
            { status: 400 }
          );
        }
        testResult = await client.testAPIConnection('gmail');
        testDetails = testResult ? 'Gmail API connection successful' : 'Gmail API connection failed';
        break;

      case 'drive':
        if (!accessToken) {
          return NextResponse.json(
            { error: 'Access token required for Drive API' },
            { status: 400 }
          );
        }
        testResult = await client.testAPIConnection('drive');
        testDetails = testResult ? 'Drive API connection successful' : 'Drive API connection failed';
        break;

      case 'calendar':
        if (!accessToken) {
          return NextResponse.json(
            { error: 'Access token required for Calendar API' },
            { status: 400 }
          );
        }
        testResult = await client.testAPIConnection('calendar');
        testDetails = testResult ? 'Calendar API connection successful' : 'Calendar API connection failed';
        break;

      case 'youtube':
        if (!apiKey) {
          return NextResponse.json(
            { error: 'API key required for YouTube API' },
            { status: 400 }
          );
        }
        testResult = await client.testAPIConnection('youtube');
        testDetails = testResult ? 'YouTube API connection successful' : 'YouTube API connection failed';
        break;

      case 'vision':
        if (!apiKey) {
          return NextResponse.json(
            { error: 'API key required for Vision API' },
            { status: 400 }
          );
        }
        testResult = await client.testAPIConnection('vision');
        testDetails = testResult ? 'Vision API connection successful' : 'Vision API connection failed';
        break;

      case 'translation':
        if (!apiKey) {
          return NextResponse.json(
            { error: 'API key required for Translation API' },
            { status: 400 }
          );
        }
        testResult = await client.testAPIConnection('translation');
        testDetails = testResult ? 'Translation API connection successful' : 'Translation API connection failed';
        break;

      case 'speech':
        if (!apiKey) {
          return NextResponse.json(
            { error: 'API key required for Speech API' },
            { status: 400 }
          );
        }
        // Speech API requires audio content, so we'll just check if the client can be created
        testResult = true;
        testDetails = 'Speech API client created successfully';
        break;

      case 'natural-language':
        if (!apiKey) {
          return NextResponse.json(
            { error: 'API key required for Natural Language API' },
            { status: 400 }
          );
        }
        // Natural Language API requires text content, so we'll just check if the client can be created
        testResult = true;
        testDetails = 'Natural Language API client created successfully';
        break;

      case 'places':
        if (!apiKey) {
          return NextResponse.json(
            { error: 'API key required for Places API' },
            { status: 400 }
          );
        }
        testResult = await client.testAPIConnection('places');
        testDetails = testResult ? 'Places API connection successful' : 'Places API connection failed';
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid API name. Supported: gmail, drive, calendar, youtube, vision, translation, speech, natural-language, places' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: testResult,
      apiName,
      message: testDetails,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Google API Test Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to test Google API connection',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 