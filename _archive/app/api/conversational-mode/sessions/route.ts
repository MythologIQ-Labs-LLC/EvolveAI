import { NextRequest, NextResponse } from 'next/server';
import { conversationalModeManager } from '@/lib/conversational-mode';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (sessionId) {
      const session = conversationalModeManager.getSession(sessionId);
      if (!session) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: session });
    }

    const sessions = conversationalModeManager.getAllSessions();
    return NextResponse.json({ success: true, data: sessions });

  } catch (error) {
    console.error('Conversational Mode Sessions Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch sessions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topic, strategyName, participantIds } = body;

    if (!topic || !strategyName) {
      return NextResponse.json(
        { error: 'Topic and strategy name are required' },
        { status: 400 }
      );
    }

    const session = await conversationalModeManager.createSession(
      topic,
      strategyName,
      participantIds
    );

    return NextResponse.json({
      success: true,
      data: session,
      message: 'Collaboration session created successfully'
    });

  } catch (error) {
    console.error('Conversational Mode Create Session Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    conversationalModeManager.deleteSession(sessionId);

    return NextResponse.json({
      success: true,
      message: 'Session deleted successfully'
    });

  } catch (error) {
    console.error('Conversational Mode Delete Session Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 