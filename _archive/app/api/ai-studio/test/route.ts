import { NextRequest, NextResponse } from 'next/server';
import { AIStudioClient } from '@/lib/ai-studio';

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json();

    // Validate API key presence
    if (!apiKey || apiKey.trim() === '') {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    // Validate API key format
    if (!apiKey.startsWith('AIza') || apiKey.length < 39) {
      return NextResponse.json(
        { error: 'Invalid API key format. Expected Google AI Studio API key.' },
        { status: 400 }
      );
    }

    // Create AI Studio client and test connection
    const client = new AIStudioClient(apiKey);
    
    // Test with a simple message
    const testMessage = [
      { role: 'user' as const, content: 'Hello, please respond with "AI Studio connection successful!"' }
    ];

    const response = await client.chat(testMessage, 'You are a helpful AI assistant.');

    if (!response.content) {
      throw new Error('No response content received');
    }

    return NextResponse.json({
      success: true,
      message: 'AI Studio connection successful!',
      response: response.content,
      usage: response.usage
    });

  } catch (error) {
    console.error('AI Studio Test Error:', error);
    
    // Provide more specific error messages based on the improved error handling
    if (error instanceof Error) {
      if (error.message.includes('Invalid API key')) {
        return NextResponse.json(
          { error: 'Invalid API key. Please check your Google AI Studio API key.' },
          { status: 401 }
        );
      }
      if (error.message.includes('API quota exceeded')) {
        return NextResponse.json(
          { error: 'API quota exceeded. Please check your Google AI Studio usage limits.' },
          { status: 429 }
        );
      }
      if (error.message.includes('Service temporarily unavailable')) {
        return NextResponse.json(
          { error: 'Service temporarily unavailable. Please try again in a few moments.' },
          { status: 503 }
        );
      }
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to test AI Studio connection. Please try again.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 