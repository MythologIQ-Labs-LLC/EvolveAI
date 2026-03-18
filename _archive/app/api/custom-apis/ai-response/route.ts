import { NextRequest, NextResponse } from 'next/server';
import { customAPIManager } from '@/lib/custom-api-manager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, message, context } = body;

    if (!agentId || !message) {
      return NextResponse.json(
        { error: 'Agent ID and message are required' },
        { status: 400 }
      );
    }

    const response = await customAPIManager.generateAIAgentResponse(agentId, message, context);

    return NextResponse.json({
      success: true,
      data: { response },
      message: 'AI response generated successfully'
    });

  } catch (error) {
    console.error('Custom AI Response Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate AI response',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 