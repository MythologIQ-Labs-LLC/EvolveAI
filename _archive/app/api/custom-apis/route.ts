import { NextRequest, NextResponse } from 'next/server';
import { customAPIManager } from '@/lib/custom-api-manager';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apiId = searchParams.get('apiId');
    const type = searchParams.get('type');

    if (apiId) {
      const api = customAPIManager.getAPI(apiId);
      if (!api) {
        return NextResponse.json(
          { error: 'API not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: api });
    }

    if (type) {
      const apis = customAPIManager.getAPIsByType(type as any);
      return NextResponse.json({ success: true, data: apis });
    }

    const apis = customAPIManager.getAllAPIs();
    return NextResponse.json({ success: true, data: apis });

  } catch (error) {
    console.error('Custom APIs Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch custom APIs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const api = await customAPIManager.addAPI(body);

    return NextResponse.json({
      success: true,
      data: api,
      message: 'Custom API added successfully'
    });

  } catch (error) {
    console.error('Custom API Create Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create custom API',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'API ID is required' },
        { status: 400 }
      );
    }

    const api = await customAPIManager.updateAPI(id, updates);

    return NextResponse.json({
      success: true,
      data: api,
      message: 'Custom API updated successfully'
    });

  } catch (error) {
    console.error('Custom API Update Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update custom API',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apiId = searchParams.get('apiId');

    if (!apiId) {
      return NextResponse.json(
        { error: 'API ID is required' },
        { status: 400 }
      );
    }

    customAPIManager.deleteAPI(apiId);

    return NextResponse.json({
      success: true,
      message: 'Custom API deleted successfully'
    });

  } catch (error) {
    console.error('Custom API Delete Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete custom API',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 