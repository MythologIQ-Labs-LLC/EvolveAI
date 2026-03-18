import { NextRequest, NextResponse } from 'next/server';
import { AIStudioClient, type ChatMessage } from '@/lib/ai-studio';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, apiKey, model, systemPrompt } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    // Validate API key format
    if (!AIStudioClient.validateApiKey(apiKey)) {
      return NextResponse.json(
        { error: 'Invalid API key format' },
        { status: 400 }
      );
    }

    // Initialize AI Studio client with retry configuration
    const client = new AIStudioClient({
      apiKey,
      model: model || 'gemini-1.5-flash',
      temperature: 0.7,
      maxTokens: 2048,
      retryAttempts: 3,
      retryDelay: 1000,
    });

    // Convert messages to the format expected by AI Studio
    const chatMessages: ChatMessage[] = messages.map((msg: any) => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.content,
      timestamp: new Date(msg.timestamp),
    }));

    // Get response from AI Studio with improved error handling
    const response = await client.chat(chatMessages, systemPrompt);

    return NextResponse.json({
      success: true,
      data: {
        content: response.content,
        model: response.model,
        timestamp: response.timestamp,
        usage: response.usage,
        cost: response.usage ? 0 : 0, // Google AI Studio is free
      },
    });

  } catch (error) {
    console.error('Chat API Error:', error);
    
    // Provide more specific error messages
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
        error: 'Failed to process chat message',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 