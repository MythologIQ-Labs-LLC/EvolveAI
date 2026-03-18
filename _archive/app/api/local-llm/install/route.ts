import { NextRequest, NextResponse } from 'next/server';
import { LocalLLMInstaller } from '@/lib/local-llm-installer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, modelName } = body;

    switch (action) {
      case 'install-ollama':
        const ollamaResult = await LocalLLMInstaller.installOllama();
        return NextResponse.json({
          success: ollamaResult.success,
          error: ollamaResult.error,
        });

      case 'install-model':
        if (!modelName) {
          return NextResponse.json(
            { error: 'Model name is required' },
            { status: 400 }
          );
        }
        
        const modelResult = await LocalLLMInstaller.installModel(modelName);
        return NextResponse.json({
          success: modelResult.success,
          error: modelResult.error,
          progress: modelResult.progress,
        });

      case 'test-model':
        if (!modelName) {
          return NextResponse.json(
            { error: 'Model name is required' },
            { status: 400 }
          );
        }
        
        const testResult = await LocalLLMInstaller.testModel(modelName);
        return NextResponse.json({
          success: testResult.success,
          response: testResult.response,
          error: testResult.error,
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: install-ollama, install-model, or test-model' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Local LLM Install API Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process local LLM installation request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 