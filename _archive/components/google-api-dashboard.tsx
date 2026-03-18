"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"

interface APIUsage {
  apiName: string
  calls: number
  cost: number
  limit: number
  quota: number
}

interface APIMetrics {
  totalCalls: number
  totalCost: number
  monthlyBudget: number
  topAPIs: APIUsage[]
  usageByDay: Array<{ date: string; calls: number; cost: number }>
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']

export function GoogleAPIDashboard() {
  const [metrics, setMetrics] = useState<APIMetrics>({
    totalCalls: 0,
    totalCost: 0,
    monthlyBudget: 50,
    topAPIs: [],
    usageByDay: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAPIMetrics()
  }, [])

  const fetchAPIMetrics = async () => {
    try {
      // In a real implementation, this would fetch from your backend
      // For now, we'll use mock data
      const mockMetrics: APIMetrics = {
        totalCalls: 1247,
        totalCost: 12.45,
        monthlyBudget: 50,
        topAPIs: [
          { apiName: "Gmail API", calls: 450, cost: 2.25, limit: 1000, quota: 45 },
          { apiName: "YouTube API", calls: 320, cost: 3.20, limit: 10000, quota: 3.2 },
          { apiName: "Vision API", calls: 180, cost: 0.27, limit: 1000, quota: 18 },
          { apiName: "Translation API", calls: 150, cost: 3.00, limit: 500000, quota: 0.03 },
          { apiName: "Drive API", calls: 120, cost: 0.48, limit: 1000, quota: 12 },
          { apiName: "Calendar API", calls: 27, cost: 0.81, limit: 1000, quota: 2.7 }
        ],
        usageByDay: [
          { date: "2024-01-01", calls: 45, cost: 0.23 },
          { date: "2024-01-02", calls: 67, cost: 0.34 },
          { date: "2024-01-03", calls: 89, cost: 0.45 },
          { date: "2024-01-04", calls: 123, cost: 0.62 },
          { date: "2024-01-05", calls: 156, cost: 0.78 },
          { date: "2024-01-06", calls: 134, cost: 0.67 },
          { date: "2024-01-07", calls: 178, cost: 0.89 }
        ]
      }
      setMetrics(mockMetrics)
    } catch (error) {
      console.error("Failed to fetch API metrics:", error)
    } finally {
      setLoading(false)
    }
  }

  const getBudgetUsage = () => {
    return (metrics.totalCost / metrics.monthlyBudget) * 100
  }

  const getBudgetColor = (usage: number) => {
    if (usage < 50) return "text-green-600"
    if (usage < 80) return "text-yellow-600"
    return "text-red-600"
  }

  const pieData = metrics.topAPIs.map(api => ({
    name: api.apiName,
    value: api.calls
  }))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total API Calls</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalCalls.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              +12% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <span className="text-muted-foreground">$</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.totalCost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Budget Usage</CardTitle>
            <span className="text-muted-foreground">%</span>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getBudgetColor(getBudgetUsage())}`}>
              {getBudgetUsage().toFixed(1)}%
            </div>
            <Progress value={getBudgetUsage()} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              ${metrics.totalCost.toFixed(2)} / ${metrics.monthlyBudget}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active APIs</CardTitle>
            <Badge variant="secondary">{metrics.topAPIs.length}</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.topAPIs.length}</div>
            <p className="text-xs text-muted-foreground">
              APIs in use
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="usage" className="space-y-4">
        <TabsList>
          <TabsTrigger value="usage">Usage Overview</TabsTrigger>
          <TabsTrigger value="costs">Cost Analysis</TabsTrigger>
          <TabsTrigger value="trends">Usage Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="usage" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>API Usage Distribution</CardTitle>
                <CardDescription>Breakdown of API calls by service</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>API Quota Usage</CardTitle>
                <CardDescription>Current usage vs limits</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {metrics.topAPIs.map((api) => (
                  <div key={api.apiName} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{api.apiName}</span>
                      <span>{api.calls.toLocaleString()} / {api.limit.toLocaleString()}</span>
                    </div>
                    <Progress value={api.quota} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>${api.cost.toFixed(2)}</span>
                      <span>{api.quota.toFixed(1)}% used</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="costs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cost Breakdown</CardTitle>
              <CardDescription>Detailed cost analysis by API</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={metrics.topAPIs}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="apiName" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`$${value}`, 'Cost']} />
                  <Bar dataKey="cost" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Usage Trends</CardTitle>
              <CardDescription>API calls and costs over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={metrics.usageByDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Bar yAxisId="left" dataKey="calls" fill="#8884d8" name="API Calls" />
                  <Bar yAxisId="right" dataKey="cost" fill="#82ca9d" name="Cost ($)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Alerts and Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Alerts & Recommendations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {getBudgetUsage() > 80 && (
            <div className="flex items-center space-x-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <Badge variant="destructive">Warning</Badge>
              <span className="text-sm">
                Budget usage is at {getBudgetUsage().toFixed(1)}%. Consider setting up billing alerts.
              </span>
            </div>
          )}
          
          {metrics.topAPIs.some(api => api.quota > 80) && (
            <div className="flex items-center space-x-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <Badge variant="secondary">Quota Alert</Badge>
              <span className="text-sm">
                Some APIs are approaching their quota limits. Consider upgrading or optimizing usage.
              </span>
            </div>
          )}

          <div className="flex items-center space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Badge variant="default">Recommendation</Badge>
            <span className="text-sm">
              Enable caching for frequently accessed data to reduce API calls and costs.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 