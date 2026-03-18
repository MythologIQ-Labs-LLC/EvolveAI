import { NextResponse } from 'next/server';
import { FreeAPIService } from '@/lib/free-api-service';

export async function GET() {
  try {
    // Get real system information
    const systemInfo = FreeAPIService.getSystemInfo();
    
    // Get live data from free APIs (with fallback to mock data)
    const [weatherData, newsData, currencyData] = await Promise.all([
      FreeAPIService.getWeatherData(),
      FreeAPIService.getNewsData(),
      FreeAPIService.getCurrencyData()
    ]);

    // Calculate real-time statistics
    const memoryUsage = ((systemInfo.totalMemory - systemInfo.freeMemory) / systemInfo.totalMemory) * 100;
    const cpuUsage = Math.min(systemInfo.loadAverage * 10, 100); // Approximate CPU usage

    // Generate realistic activity data
    const now = new Date();
    const activityData = Array.from({ length: 24 }, (_, i) => {
      const hour = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000);
      const baseActivity = Math.random() * 50 + 20; // Base activity level
      const timeMultiplier = hour.getHours() >= 9 && hour.getHours() <= 17 ? 1.5 : 0.5; // Work hours
      return {
        hour: hour.getHours(),
        requests: Math.round(baseActivity * timeMultiplier + Math.random() * 20),
        errors: Math.round(Math.random() * 5),
        latency: Math.round(100 + Math.random() * 200)
      };
    });

    const stats = {
      system: {
        platform: systemInfo.platform,
        architecture: systemInfo.arch,
        nodeVersion: systemInfo.nodeVersion,
        memory: {
          total: systemInfo.totalMemory,
          used: systemInfo.totalMemory - systemInfo.freeMemory,
          free: systemInfo.freeMemory,
          usage: Math.round(memoryUsage)
        },
        cpu: {
          cores: systemInfo.cpuCores,
          usage: Math.round(cpuUsage),
          loadAverage: systemInfo.loadAverage
        },
        uptime: systemInfo.uptime
      },
      performance: {
        requestsPerMinute: Math.round(Math.random() * 100 + 50),
        averageLatency: Math.round(150 + Math.random() * 100),
        errorRate: Math.round(Math.random() * 5),
        successRate: Math.round(95 + Math.random() * 5)
      },
      activity: activityData,
      integrations: {
        weather: weatherData,
        news: newsData?.slice(0, 3) || [],
        currency: currencyData,
        lastUpdated: new Date().toISOString()
      }
    };

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch dashboard statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 