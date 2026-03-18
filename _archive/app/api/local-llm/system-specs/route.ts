import { NextResponse } from 'next/server';
import { LocalLLMInstaller } from '@/lib/local-llm-installer';

export async function GET() {
  try {
    const specs = await LocalLLMInstaller.getSystemSpecs();
    const recommendedModels = LocalLLMInstaller.getRecommendedModels(specs);
    const bestModel = LocalLLMInstaller.getBestModel(specs);
    const allModels = LocalLLMInstaller.getAllModels();

    return NextResponse.json({
      success: true,
      data: {
        systemSpecs: specs,
        recommendedModels,
        bestModel,
        allModels,
      },
    });

  } catch (error) {
    console.error('System Specs API Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get system specifications',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 