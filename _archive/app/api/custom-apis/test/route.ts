import { NextRequest, NextResponse } from 'next/server';
import { customAPIManager } from '@/lib/custom-api-manager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiId, endpointId, params, body: requestBody } = body;

    if (!apiId) {
      return NextResponse.json(
        { error: 'API ID is required' },
        { status: 400 }
      );
    }

    const result = await customAPIManager.callAPI(apiId, endpointId, params, requestBody);

    return NextResponse.json({
      success: true,
      data: result.data,
      message: 'API call successful'
    });

  } catch (error) {
    console.error('Custom API Test Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to test custom API',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 