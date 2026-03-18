import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // In a real implementation, this would fetch from your activity log
    // For now, we'll return mock data that can be replaced with real data later
    
    const events = [
      'Gmail API call',
      'Calendar API call', 
      'Drive API call',
      'Gemini API call',
      'Local LLM call',
      'YouTube API call',
      'Places API call',
      'Translation API call',
      'Speech API call',
      'Vision API call'
    ];

    const recentActivity = Array.from({ length: 5 }, (_, i) => {
      const now = new Date();
      const time = new Date(now.getTime() - (i * 15 * 60 * 1000)); // 15 minutes apart
      const event = events[Math.floor(Math.random() * events.length)];
      const status = Math.random() > 0.1 ? 'Success' : 'Failed'; // 90% success rate
      const cost = status === 'Success' 
        ? `$${(Math.random() * 0.01).toFixed(3)}`
        : '$0.000';

      return {
        time: time.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        }),
        event,
        status,
        cost
      };
    });

    return NextResponse.json({ recentActivity });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent activity' },
      { status: 500 }
    );
  }
} 