import { NextRequest, NextResponse } from 'next/server';
import { conversationalModeManager } from '@/lib/conversational-mode';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, content } = body;

    if (!sessionId || !content) {
      return NextResponse.json(
        { error: 'Session ID and content are required' },
        { status: 400 }
      );
    }

    const aiResponses = await conversationalModeManager.addUserMessage(sessionId, content);

    return NextResponse.json({
      success: true,
      data: aiResponses,
      message: 'AI responses generated successfully'
    });

  } catch (error) {
    console.error('Conversational Mode Message Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process message',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 