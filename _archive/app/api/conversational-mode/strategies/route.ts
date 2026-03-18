import { NextRequest, NextResponse } from 'next/server';
import { conversationalModeManager } from '@/lib/conversational-mode';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type === 'strategies') {
      const strategies = conversationalModeManager.getStrategies();
      return NextResponse.json({ success: true, data: strategies });
    } else if (type === 'participants') {
      const participants = conversationalModeManager.getParticipants();
      return NextResponse.json({ success: true, data: participants });
    }

    return NextResponse.json({
      success: true,
      data: {
        strategies: conversationalModeManager.getStrategies(),
        participants: conversationalModeManager.getParticipants()
      }
    });

  } catch (error) {
    console.error('Conversational Mode Strategies Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch strategies/participants',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { participantId, isActive } = body;

    if (!participantId || typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'Participant ID and active status are required' },
        { status: 400 }
      );
    }

    conversationalModeManager.updateParticipantStatus(participantId, isActive);

    return NextResponse.json({
      success: true,
      message: 'Participant status updated successfully'
    });

  } catch (error) {
    console.error('Conversational Mode Update Participant Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update participant status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 