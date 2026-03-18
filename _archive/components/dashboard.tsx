import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Activity, DollarSign, Zap, Clock, RefreshCw } from "lucide-react"
import { useDashboardData } from "@/hooks/use-dashboard-data"

export function Dashboard() {
  const { data, loading, error } = useDashboardData();

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span>Loading dashboard data...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-2">Failed to load dashboard data</p>
          <p className="text-sm text-muted-foreground">Please check your connection and try again</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <ScrollArea className="h-full">
        <div className="p-6 space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Dashboard</h2>
            <p className="text-muted-foreground">Monitor your Google AI Bridge usage and performance</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total API Calls</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.apiCalls.total.toLocaleString()}</div>
                <p className={`text-xs ${data.apiCalls.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {data.apiCalls.change >= 0 ? '+' : ''}{data.apiCalls.change}% from last week
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Estimated Cost</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${data.cost.current.toFixed(2)}</div>
                <p className={`text-xs ${data.cost.change >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {data.cost.change >= 0 ? '+' : ''}${data.cost.change.toFixed(2)} from last week
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.responseTime.average}s</div>
                <p className={`text-xs ${data.responseTime.change <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {data.responseTime.change >= 0 ? '+' : ''}{data.responseTime.change}s from last week
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.successRate.current}%</div>
                <p className={`text-xs ${data.successRate.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {data.successRate.change >= 0 ? '+' : ''}{data.successRate.change}% from last week
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Connection Status</CardTitle>
                <CardDescription>Current status of all integrations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">AI Studio Agent</span>
                  <Badge className={data.connections.aiStudio 
                    ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                    : "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
                  }>
                    {data.connections.aiStudio ? 'Connected' : 'Disconnected'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Gmail API</span>
                  <Badge className={data.connections.gmail 
                    ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                    : "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
                  }>
                    {data.connections.gmail ? 'Connected' : 'Disconnected'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Google Drive</span>
                  <Badge className={data.connections.drive 
                    ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                    : "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
                  }>
                    {data.connections.drive ? 'Connected' : 'Disconnected'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Google Calendar</span>
                  <Badge className={data.connections.calendar 
                    ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                    : "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
                  }>
                    {data.connections.calendar ? 'Connected' : 'Disconnected'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Local LLM</span>
                  <Badge className={data.connections.localLLM 
                    ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                    : "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200"
                  }>
                    {data.connections.localLLM ? 'Connected' : 'Disconnected'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>API Usage Breakdown</CardTitle>
                <CardDescription>Usage by service this month</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Gmail API</span>
                    <span>{data.usageBreakdown.gmail}%</span>
                  </div>
                  <Progress value={data.usageBreakdown.gmail} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Google Drive</span>
                    <span>{data.usageBreakdown.drive}%</span>
                  </div>
                  <Progress value={data.usageBreakdown.drive} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Calendar API</span>
                    <span>{data.usageBreakdown.calendar}%</span>
                  </div>
                  <Progress value={data.usageBreakdown.calendar} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Other APIs</span>
                    <span>{data.usageBreakdown.other}%</span>
                  </div>
                  <Progress value={data.usageBreakdown.other} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest API calls and events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.recentActivity.map((activity, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 border-b border-border last:border-0"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="text-sm text-muted-foreground">{activity.time}</div>
                      <div className="text-sm font-medium">{activity.event}</div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Badge
                        variant="outline"
                        className={
                          activity.status === "Success"
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }
                      >
                        {activity.status}
                      </Badge>
                      <div className="text-sm text-primary">{activity.cost}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  )
}
