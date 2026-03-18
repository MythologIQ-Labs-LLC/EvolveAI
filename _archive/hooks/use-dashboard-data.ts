import { useState, useEffect } from 'react';

export interface DashboardData {
  apiCalls: {
    total: number;
    change: number;
  };
  cost: {
    current: number;
    change: number;
  };
  responseTime: {
    average: number;
    change: number;
  };
  successRate: {
    current: number;
    change: number;
  };
  connections: {
    aiStudio: boolean;
    gmail: boolean;
    drive: boolean;
    calendar: boolean;
    localLLM: boolean;
  };
  usageBreakdown: {
    gmail: number;
    drive: number;
    calendar: number;
    other: number;
  };
  recentActivity: Array<{
    time: string;
    event: string;
    status: 'Success' | 'Failed';
    cost: string;
  }>;
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);
        
        // Fetch data from multiple endpoints
        const [statsResponse, connectionsResponse, activityResponse] = await Promise.allSettled([
          fetch('/api/dashboard/stats'),
          fetch('/api/dashboard/connections'),
          fetch('/api/dashboard/activity')
        ]);

        // Default data structure
        const dashboardData: DashboardData = {
          apiCalls: { total: 0, change: 0 },
          cost: { current: 0, change: 0 },
          responseTime: { average: 0, change: 0 },
          successRate: { current: 0, change: 0 },
          connections: {
            aiStudio: false,
            gmail: false,
            drive: false,
            calendar: false,
            localLLM: false
          },
          usageBreakdown: {
            gmail: 0,
            drive: 0,
            calendar: 0,
            other: 0
          },
          recentActivity: []
        };

        // Process stats data
        if (statsResponse.status === 'fulfilled' && statsResponse.value.ok) {
          const stats = await statsResponse.value.json();
          dashboardData.apiCalls = stats.apiCalls || dashboardData.apiCalls;
          dashboardData.cost = stats.cost || dashboardData.cost;
          dashboardData.responseTime = stats.responseTime || dashboardData.responseTime;
          dashboardData.successRate = stats.successRate || dashboardData.successRate;
          dashboardData.usageBreakdown = stats.usageBreakdown || dashboardData.usageBreakdown;
        }

        // Process connections data
        if (connectionsResponse.status === 'fulfilled' && connectionsResponse.value.ok) {
          const connections = await connectionsResponse.value.json();
          dashboardData.connections = { ...dashboardData.connections, ...connections };
        }

        // Process activity data
        if (activityResponse.status === 'fulfilled' && activityResponse.value.ok) {
          const activity = await activityResponse.value.json();
          dashboardData.recentActivity = activity.recentActivity || dashboardData.recentActivity;
        }

        setData(dashboardData);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        setError('Failed to load dashboard data');
        
        // Set fallback data for testing
        setData({
          apiCalls: { total: 1247, change: 12 },
          cost: { current: 23.45, change: 5.2 },
          responseTime: { average: 1.2, change: -0.3 },
          successRate: { current: 99.2, change: 0.5 },
          connections: {
            aiStudio: true,
            gmail: true,
            drive: true,
            calendar: true,
            localLLM: false
          },
          usageBreakdown: {
            gmail: 45,
            drive: 30,
            calendar: 15,
            other: 10
          },
          recentActivity: [
            { time: "10:45 AM", event: "Gmail API call", status: "Success", cost: "$0.002" },
            { time: "10:30 AM", event: "Calendar API call", status: "Success", cost: "$0.001" },
            { time: "10:15 AM", event: "Drive API call", status: "Success", cost: "$0.002" },
            { time: "10:00 AM", event: "Gemini API call", status: "Success", cost: "$0.005" },
            { time: "09:45 AM", event: "Local LLM call", status: "Failed", cost: "$0.000" },
          ]
        });
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  return { data, loading, error };
} 