"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSettings } from "@/hooks/use-settings"
import { useTheme } from "next-themes"
import Link from "next/link"
import { RuleDialog } from "@/components/rule-dialog"
import { EditRuleDialog } from "@/components/edit-rule-dialog"
import { ExternalLink } from "lucide-react"
import { LocalLLMInstaller } from "@/components/local-llm-installer"
import { toast } from "react-hot-toast"
import { apiRateManager } from '@/lib/api-rates'
import { RefreshCw } from "lucide-react"
import CustomAPIManager from './custom-api-manager'
import { getSystemSpecs, getInstalledModels, testGoogleAPIConnection, installLocalLLM } from '@/lib/settings-utils'
import { DocumentationViewer } from './documentation-viewer'
import { IssueReporter } from './issue-reporter'

export function Settings() {
  const [aiStudioKey, setAiStudioKey] = useState("")
  const [googleApiKey, setGoogleApiKey] = useState("")
  const [googleAccessToken, setGoogleAccessToken] = useState("")
  const [localLlmEndpoint, setLocalLlmEndpoint] = useState("http://localhost:11434")
  const [apiTestResults, setApiTestResults] = useState<Record<string, { success: boolean; error?: string }>>({})
  const [testingApi, setTestingApi] = useState<string | null>(null)
  const [apiRates, setApiRates] = useState<any>({})
  const [ratesLastUpdated, setRatesLastUpdated] = useState<number | null>(null)
  const { settings, updateSettings, updateRoutingRule, addRoutingRule, deleteRoutingRule } = useSettings()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const [editingRule, setEditingRule] = useState<any>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  const [systemSpecs, setSystemSpecs] = useState<any>(null)
  const [connectionStatus, setConnectionStatus] = useState<{
    gemini: boolean
    localLLM: boolean
    googleAPIs: boolean
  }>({
    gemini: false,
    localLLM: false,
    googleAPIs: false
  })

  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [isInstallingLLM, setIsInstallingLLM] = useState(false)
  const [installedModels, setInstalledModels] = useState<string[]>([])

  const [googleClientId, setGoogleClientId] = useState("")
  const [googleClientSecret, setGoogleClientSecret] = useState("")

  // New state for dialogs
  const [docsOpen, setDocsOpen] = useState(false)
  const [issueReporterOpen, setIssueReporterOpen] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<any>(null)
  const [checkingUpdates, setCheckingUpdates] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Load saved API keys
    const savedApiKey = localStorage.getItem("google-api-key")
    const savedAccessToken = localStorage.getItem("google-access-token")
    const savedClientId = localStorage.getItem("google-client-id")
    const savedClientSecret = localStorage.getItem("google-client-secret")
    if (savedApiKey) setGoogleApiKey(savedApiKey)
    if (savedAccessToken) setGoogleAccessToken(savedAccessToken)
    if (savedClientId) setGoogleClientId(savedClientId)
    if (savedClientSecret) setGoogleClientSecret(savedClientSecret)
    
    // Load API rates
    loadAPIRates()
    loadSystemSpecs()
    loadInstalledModels()
    testConnections()

    // Handle OAuth token from URL
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('access_token');
    const error = urlParams.get('error');
    
    if (accessToken) {
      setGoogleAccessToken(accessToken);
      // Clear the URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    if (error) {
      console.error('OAuth error:', error);
      // Clear the URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [])

  const loadAPIRates = async () => {
    try {
      const rates = apiRateManager.getRates()
      setApiRates(rates)
      
      const cacheInfo = apiRateManager.getCacheInfo()
      if (cacheInfo) {
        setRatesLastUpdated(new Date(cacheInfo.lastFetched).getTime())
      }
    } catch (error) {
      console.error('Failed to load API rates:', error)
    }
  }

  const updateAPIRates = async () => {
    try {
      const rates = await apiRateManager.updateRates()
      setApiRates(rates)
      
      const cacheInfo = apiRateManager.getCacheInfo()
      if (cacheInfo) {
        setRatesLastUpdated(new Date(cacheInfo.lastFetched).getTime())
      }
      
      toast.success('API rates updated successfully')
    } catch (error) {
      console.error('Failed to update API rates:', error)
      toast.error('Failed to update API rates')
    }
  }

  const getRateForAPI = (apiName: string) => {
    return apiRates.find((rate: any) => rate.apiName === apiName)
  }

  const formatCost = (rate: any) => {
    if (!rate) return "Unknown"
    return `$${rate.pricing.cost.toFixed(4)} per ${rate.pricing.unit}`
  }

  const testGoogleAPI = async (apiName: string) => {
    setTestingApi(apiName)
    try {
      const response = await fetch("/api/google/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: googleApiKey,
          accessToken: googleAccessToken,
          apiName,
        }),
      })

      const data = await response.json()
      setApiTestResults(prev => ({
        ...prev,
        [apiName]: {
          success: data.success,
          error: data.error,
        }
      }))

      if (data.success) {
        toast.success(`${apiName} API test successful!`)
        setConnectionStatus(prev => ({ ...prev, googleAPIs: true }))
      } else {
        toast.error(`${apiName} API test failed: ${data.error}`)
        setConnectionStatus(prev => ({ ...prev, googleAPIs: false }))
      }
    } catch (error) {
      setApiTestResults(prev => ({
        ...prev,
        [apiName]: {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        }
      }))
      toast.error(`Failed to test ${apiName} API`)
      setConnectionStatus(prev => ({ ...prev, googleAPIs: false }))
    } finally {
      setTestingApi(null)
    }
  }

  const handleApiKeyChange = (key: string) => {
    setGoogleApiKey(key)
    localStorage.setItem("google-api-key", key)
  }

  const handleAccessTokenChange = (token: string) => {
    setGoogleAccessToken(token)
    localStorage.setItem("google-access-token", token)
  }

  const loadSystemSpecs = async () => {
    try {
      const specs = await getSystemSpecs()
      setSystemSpecs(specs)
    } catch (error) {
      console.error('Failed to load system specs:', error)
    }
  }

  const loadInstalledModels = async () => {
    try {
      const models = await getInstalledModels()
      setInstalledModels(models)
    } catch (error) {
      console.error('Failed to load installed models:', error)
    }
  }

  const testConnections = async () => {
    // Test Gemini connection
    if (googleApiKey) {
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'test', model: 'gemini' })
        })
        setConnectionStatus(prev => ({ ...prev, gemini: response.ok }))
      } catch (error) {
        setConnectionStatus(prev => ({ ...prev, gemini: false }))
      }
    }

    // Test local LLM connection
    if (settings.localLLMEnabled) {
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'test', model: 'local' })
        })
        setConnectionStatus(prev => ({ ...prev, localLLM: response.ok }))
      } catch (error) {
        setConnectionStatus(prev => ({ ...prev, localLLM: false }))
      }
    }

    // Test Google APIs connection
    if (googleApiKey) {
      try {
        const result = await testGoogleAPIConnection()
        setConnectionStatus(prev => ({ ...prev, googleAPIs: result.success }))
      } catch (error) {
        setConnectionStatus(prev => ({ ...prev, googleAPIs: false }))
      }
    }
  }

  const handleTestConnection = async () => {
    setIsTestingConnection(true)
    try {
      const result = await testGoogleAPIConnection()
      if (result.success) {
        toast.success('Google API connection successful!')
        setConnectionStatus(prev => ({ ...prev, googleAPIs: true }))
      } else {
        toast.error(`Connection failed: ${result.error}`)
        setConnectionStatus(prev => ({ ...prev, googleAPIs: false }))
      }
    } catch (error) {
      toast.error('Connection test failed')
      setConnectionStatus(prev => ({ ...prev, googleAPIs: false }))
    } finally {
      setIsTestingConnection(false)
    }
  }

  const handleInstallLocalLLM = async (model: string) => {
    setIsInstallingLLM(true)
    try {
      const result = await installLocalLLM(model)
      if (result.success) {
        toast.success(`${model} installed successfully!`)
        await loadInstalledModels()
      } else {
        toast.error(`Installation failed: ${result.error}`)
      }
    } catch (error) {
      toast.error('Installation failed')
    } finally {
      setIsInstallingLLM(false)
    }
  }

  const getConnectionStatusColor = (status: boolean) => {
    return status ? 'bg-green-500' : 'bg-red-500'
  }

  const getConnectionStatusText = (status: boolean) => {
    return status ? 'Connected' : 'Disconnected'
  }

  // Save Google OAuth credentials
  const handleSaveGoogleOAuth = () => {
    localStorage.setItem("google-client-id", googleClientId)
    localStorage.setItem("google-client-secret", googleClientSecret)
    toast.success("Google OAuth credentials saved!")
  }

  // Test OAuth credentials
  const handleTestOAuth = async () => {
    if (!googleClientId || !googleClientSecret) {
      toast.error("Please enter both Client ID and Secret")
      return
    }
    try {
      // Try to start OAuth flow with these credentials
      const redirectUri = `${window.location.origin}/auth/callback`;
      const scope = encodeURIComponent([
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/calendar'
      ].join(' '));
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code&access_type=offline&prompt=consent`;
      window.open(authUrl, '_blank');
      toast.success("OAuth flow started. Complete the login in the new tab.")
    } catch (error) {
      toast.error("Failed to start OAuth flow")
    }
  }

  // Check for updates
  const handleCheckUpdates = async () => {
    setCheckingUpdates(true)
    try {
      const response = await fetch('/api/github/check-updates')
      const data = await response.json()
      setUpdateInfo(data)
      
      if (data.hasUpdate) {
        toast.success(`Update available! Latest version: ${data.latestVersion}`)
      } else {
        toast.success("You're running the latest version!")
      }
    } catch (error) {
      toast.error("Failed to check for updates")
    } finally {
      setCheckingUpdates(false)
    }
  }

  if (!mounted) {
    return null
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-6 border-b border-border">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Settings</h2>
          <p className="text-muted-foreground">Configure your Evolve AI</p>
        </div>
        <Link
          href="https://www.mythologiq.studio"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-4 hover:opacity-80 transition-opacity"
        >
          <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 via-blue-500 to-purple-600 rounded-lg flex items-center justify-center overflow-hidden">
            <img
              src="/mythologiq-logo.png"
              alt="MythologIQ Logo"
              className="object-contain w-8 h-8"
            />
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-foreground">MythologIQ</div>
            <div className="text-xs text-muted-foreground">built by MythologIQ</div>
          </div>
        </Link>
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="ai-studio" className="h-full flex flex-col">
          <div className="px-6 pt-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="ai-studio">AI Studio</TabsTrigger>
              <TabsTrigger value="google-apis">Google APIs</TabsTrigger>
              <TabsTrigger value="local-llm">Local LLM</TabsTrigger>
              <TabsTrigger value="routing">Routing</TabsTrigger>
              <TabsTrigger value="appearance">Appearance</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden px-6 pb-6">
            <TabsContent value="appearance" className="h-full mt-4">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Theme Settings</CardTitle>
                      <CardDescription>Customize the appearance of your Evolve AI</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Theme</Label>
                          <Select
                            value={settings.theme}
                            onValueChange={(value: "light" | "dark" | "system" | "midnight" | "forest" | "ocean") => {
                              updateSettings({ theme: value })
                              if (value === "light" || value === "dark" || value === "system") {
                                setTheme(value)
                              } else {
                                setTheme("dark") // Custom themes are based on dark mode
                                // Apply custom theme class
                                const root = document.documentElement
                                root.className = root.className.replace(/theme-\w+/g, "")
                                root.classList.add(`theme-${value}`)
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select theme" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="light">Light</SelectItem>
                              <SelectItem value="dark">Dark</SelectItem>
                              <SelectItem value="system">System</SelectItem>
                              <SelectItem value="midnight">Midnight Blue</SelectItem>
                              <SelectItem value="forest">Forest Green</SelectItem>
                              <SelectItem value="ocean">Ocean Teal</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Choose your preferred theme or follow system settings
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label>Accent Color</Label>
                          <Select
                            value={settings.accentColor}
                            onValueChange={(value: "blue" | "green" | "purple" | "orange" | "red" | "teal") => {
                              updateSettings({ accentColor: value })
                              // Apply accent color to document
                              const root = document.documentElement
                              root.setAttribute('data-accent', value)
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select accent color" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="blue">Google Blue</SelectItem>
                              <SelectItem value="green">Green</SelectItem>
                              <SelectItem value="purple">Purple</SelectItem>
                              <SelectItem value="orange">Orange</SelectItem>
                              <SelectItem value="red">Red</SelectItem>
                              <SelectItem value="teal">Teal</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Font Size</Label>
                          <Select
                            value={settings.fontSize}
                            onValueChange={(value: "small" | "medium" | "large") => updateSettings({ fontSize: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select font size" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="small">Small</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="large">Large</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Chat Interface</CardTitle>
                      <CardDescription>Customize the chat interface appearance</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>Show Timestamps</Label>
                        <Switch
                          checked={settings.showTimestamps}
                          onCheckedChange={(checked) => updateSettings({ showTimestamps: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label>Show Tool Call Badges</Label>
                        <Switch
                          checked={settings.showToolCallBadges}
                          onCheckedChange={(checked) => updateSettings({ showToolCallBadges: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label>Enable Sound Notifications</Label>
                        <Switch
                          checked={settings.enableSoundNotifications}
                          onCheckedChange={(checked) => updateSettings({ enableSoundNotifications: checked })}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>About</CardTitle>
                      <CardDescription>Information about Evolve AI</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center space-x-4">
                        <div>
                          <h3 className="font-semibold">Evolve AI</h3>
                          <p className="text-sm text-muted-foreground">Version 1.0.0</p>
                          <p className="text-sm text-muted-foreground">
                            Built by{" "}
                            <Link
                              href="https://www.mythologiq.studio"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              MythologIQ
                            </Link>
                          </p>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <Button 
                          variant="outline" 
                          className="w-full"
                          onClick={handleCheckUpdates}
                          disabled={checkingUpdates}
                        >
                          {checkingUpdates ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                              Checking for Updates...
                            </>
                          ) : (
                            "Check for Updates"
                          )}
                        </Button>
                        
                        {updateInfo && (
                          <div className="p-3 bg-muted rounded-lg">
                            <div className="text-sm">
                              <div className="font-medium">Current Version: {updateInfo.currentVersion}</div>
                              <div className="font-medium">Latest Version: {updateInfo.latestVersion}</div>
                              {updateInfo.hasUpdate && (
                                <div className="text-green-600 mt-1">
                                  Update available! Visit the releases page to download.
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <Button 
                          variant="outline" 
                          className="w-full"
                          onClick={() => setDocsOpen(true)}
                        >
                          View Documentation
                        </Button>
                        
                        <Button 
                          variant="outline" 
                          className="w-full"
                          onClick={() => setIssueReporterOpen(true)}
                        >
                          Report an Issue
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="ai-studio" className="h-full mt-4">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>AI Studio Configuration</CardTitle>
                      <CardDescription>Configure your Google AI Studio connection and agent settings</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="ai-studio-key">AI Studio API Key</Label>
                        <div className="flex space-x-2">
                          <Input
                            id="ai-studio-key"
                            type="password"
                            placeholder="Enter your AI Studio API key"
                            value={aiStudioKey}
                            onChange={(e) => setAiStudioKey(e.target.value)}
                          />
                          <Button variant="outline">Test Connection</Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="system-prompt">System Prompt</Label>
                        <Textarea
                          id="system-prompt"
                          placeholder="Paste your system prompt from AI Studio here..."
                          className="min-h-[100px]"
                          readOnly
                        />
                        <p className="text-xs text-muted-foreground">
                          Copy and paste your system prompt from Google AI Studio
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="tool-definitions">Tool Definitions (JSON)</Label>
                        <Textarea
                          id="tool-definitions"
                          placeholder="Paste your tool definitions JSON from AI Studio here..."
                          className="min-h-[150px] font-mono text-sm"
                          readOnly
                        />
                        <p className="text-xs text-muted-foreground">
                          Copy and paste your tool definitions from Google AI Studio
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="google-apis" className="h-full mt-4">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Google Workspace APIs</CardTitle>
                      <CardDescription>Configure access to Google Workspace services</CardDescription>
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          Rates last updated: {ratesLastUpdated ? new Date(ratesLastUpdated).toLocaleString() : 'Never'}
                        </div>
                        <Button variant="outline" size="sm" onClick={updateAPIRates}>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Update Rates
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* API Keys Input */}
                      <div className="space-y-4 p-4 bg-muted rounded-lg">
                        <div className="space-y-2">
                          <Label htmlFor="google-api-key">Google API Key</Label>
                          <Input
                            id="google-api-key"
                            type="password"
                            placeholder="Enter your Google API key"
                            value={googleApiKey}
                            onChange={(e) => handleApiKeyChange(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            Required for YouTube, Vision, Translation, Speech, Natural Language, and Places APIs
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="google-access-token">Google Access Token</Label>
                          <div className="flex space-x-2">
                            <Input
                              id="google-access-token"
                              type="password"
                              placeholder="Enter your Google OAuth access token"
                              value={googleAccessToken}
                              onChange={(e) => handleAccessTokenChange(e.target.value)}
                            />
                            <Button 
                              variant="outline"
                              onClick={() => {
                                // Use dynamic redirect URI
                                const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
                                const redirectUri = `${window.location.origin}/auth/callback`;
                                const scope = encodeURIComponent([
                                  'https://www.googleapis.com/auth/gmail.readonly',
                                  'https://www.googleapis.com/auth/drive',
                                  'https://www.googleapis.com/auth/calendar'
                                ].join(' '));
                                const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code&access_type=offline&prompt=consent`;
                                window.open(authUrl, '_blank');
                              }}
                            >
                              OAuth Login
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Required for Gmail, Drive, and Calendar APIs. Use OAuth Login for secure authentication.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="google-client-id">Google OAuth Client ID</Label>
                          <Input
                            id="google-client-id"
                            type="text"
                            placeholder="Enter your Google OAuth Client ID"
                            value={googleClientId}
                            onChange={(e) => setGoogleClientId(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="google-client-secret">Google OAuth Client Secret</Label>
                          <Input
                            id="google-client-secret"
                            type="password"
                            placeholder="Enter your Google OAuth Client Secret"
                            value={googleClientSecret}
                            onChange={(e) => setGoogleClientSecret(e.target.value)}
                          />
                        </div>
                        <div className="flex space-x-2 mt-2">
                          <Button variant="outline" onClick={handleSaveGoogleOAuth}>Save</Button>
                          <Button variant="outline" onClick={handleTestOAuth}>Test OAuth</Button>
                        </div>
                      </div>

                      {[
                        {
                          name: "Gmail API",
                          apiName: "gmail",
                          requiresToken: true,
                          scope: "Read/Write emails",
                          description: "Access and manage Gmail messages, labels, and settings",
                        },
                        {
                          name: "Google Drive",
                          apiName: "drive",
                          requiresToken: true,
                          scope: "Read/Write files",
                          description: "Upload, download, and manage files and folders in Google Drive",
                        },
                        {
                          name: "Google Calendar",
                          apiName: "calendar",
                          requiresToken: true,
                          scope: "Read/Write events",
                          description: "Create, update, and manage calendar events and schedules",
                        },
                        {
                          name: "YouTube Data API",
                          apiName: "youtube",
                          requiresKey: true,
                          scope: "Read video data",
                          description: "Access YouTube videos, channels, and playlists",
                        },
                      ].map((api) => {
                        const testResult = apiTestResults[api.apiName]
                        const isConnected = testResult?.success || false
                        const isTesting = testingApi === api.apiName
                        const canTest = (api.requiresToken && googleAccessToken) || (api.requiresKey && googleApiKey)
                        const rate = getRateForAPI(api.apiName)

                        return (
                          <div key={api.name} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center space-x-3">
                              <Switch checked={isConnected} disabled />
                              <div className="flex-1">
                                <div className="font-medium">{api.name}</div>
                                <div className="text-sm text-muted-foreground">{api.description}</div>
                                <div className="text-xs text-muted-foreground">{api.scope}</div>
                                <div className="text-xs text-primary">{formatCost(rate)}</div>
                                {rate?.pricing?.freeTier && (
                                  <div className="text-xs text-green-600">
                                    Free tier: {rate.pricing.freeTier.limit.toLocaleString()} {rate.pricing.freeTier.unit}
                                  </div>
                                )}
                                {testResult && (
                                  <div className={`text-xs ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                                    {testResult.error}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant={isConnected ? "default" : "secondary"}>
                                {isConnected ? "Connected" : "Disconnected"}
                              </Badge>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => testGoogleAPI(api.apiName)}
                                disabled={!canTest || isTesting}
                              >
                                {isTesting ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                ) : (
                                  isConnected ? "Reconnect" : "Connect"
                                )}
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Google AI/ML APIs</CardTitle>
                      <CardDescription>Configure access to Google AI and Machine Learning services</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {[
                        {
                          name: "Cloud Vision API",
                          apiName: "vision",
                          requiresKey: true,
                          description: "Image analysis, object detection, and text extraction",
                        },
                        {
                          name: "Cloud Translation API",
                          apiName: "translation",
                          requiresKey: true,
                          description: "Text translation between 100+ languages",
                        },
                        {
                          name: "Cloud Speech API",
                          apiName: "speech",
                          requiresKey: true,
                          description: "Speech-to-text transcription and audio analysis",
                        },
                        {
                          name: "Cloud Natural Language API",
                          apiName: "natural-language",
                          requiresKey: true,
                          description: "Sentiment analysis and entity recognition",
                        },
                        {
                          name: "Places API",
                          apiName: "places",
                          requiresKey: true,
                          description: "Location data and place information",
                        },
                      ].map((api) => {
                        const testResult = apiTestResults[api.apiName]
                        const isConnected = testResult?.success || false
                        const isTesting = testingApi === api.apiName
                        const canTest = api.requiresKey && googleApiKey
                        const rate = getRateForAPI(api.apiName)

                        return (
                          <div key={api.name} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center space-x-3">
                              <Switch checked={isConnected} disabled />
                              <div className="flex-1">
                                <div className="font-medium">{api.name}</div>
                                <div className="text-sm text-muted-foreground">{api.description}</div>
                                <div className="text-xs text-primary">{formatCost(rate)}</div>
                                {rate?.pricing?.freeTier && (
                                  <div className="text-xs text-green-600">
                                    Free tier: {rate.pricing.freeTier.limit.toLocaleString()} {rate.pricing.freeTier.unit}
                                  </div>
                                )}
                                {testResult && (
                                  <div className={`text-xs ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                                    {testResult.error}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant={isConnected ? "default" : "secondary"}>
                                {isConnected ? "Connected" : "Disconnected"}
                              </Badge>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => testGoogleAPI(api.apiName)}
                                disabled={!canTest || isTesting}
                              >
                                {isTesting ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                ) : (
                                  isConnected ? "Reconnect" : "Connect"
                                )}
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Other Google APIs</CardTitle>
                      <CardDescription>Configure access to additional Google services</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {[
                        {
                          name: "Google Contacts",
                          connected: false,
                          scope: "Read contacts",
                          cost: "$0.02 per 1000 requests",
                          description: "Access and manage contact information",
                        },
                        {
                          name: "Google Tasks",
                          connected: false,
                          scope: "Read/Write tasks",
                          cost: "$0.02 per 1000 requests",
                          description: "Create and manage task lists and to-do items",
                        },
                        {
                          name: "Google Docs API",
                          connected: false,
                          scope: "Read/Write documents",
                          cost: "$0.04 per 1000 requests",
                          description: "Create, edit, and format Google Docs documents",
                        },
                        {
                          name: "Google Sheets API",
                          connected: false,
                          scope: "Read/Write spreadsheets",
                          cost: "$0.04 per 1000 requests",
                          description: "Read, write, and manipulate spreadsheet data",
                        },
                        {
                          name: "Google Slides API",
                          connected: false,
                          scope: "Read/Write presentations",
                          cost: "$0.04 per 1000 requests",
                          description: "Create and edit presentation slides and content",
                        },
                        {
                          name: "Google Meet API",
                          connected: false,
                          scope: "Read meeting data",
                          cost: "$0.05 per 1000 requests",
                          description: "Access meeting information and participant data",
                        },
                        {
                          name: "Google Chat API",
                          connected: false,
                          scope: "Read/Write messages",
                          cost: "$0.03 per 1000 requests",
                          description: "Send messages and interact with Google Chat spaces",
                        },
                        {
                          name: "Google Keep API",
                          connected: false,
                          scope: "Read/Write notes",
                          cost: "$0.02 per 1000 requests",
                          description: "Create and manage notes and reminders",
                        },
                        {
                          name: "Google Forms API",
                          connected: false,
                          scope: "Read/Write forms",
                          cost: "$0.03 per 1000 requests",
                          description: "Create forms and collect responses",
                        },
                        {
                          name: "Google Vault API",
                          connected: false,
                          scope: "Read vault data",
                          cost: "$0.06 per 1000 requests",
                          description: "Access archived data for compliance and legal holds",
                        },
                        {
                          name: "Google Workspace Events API",
                          connected: false,
                          scope: "Read events",
                          cost: "$0.03 per 1000 requests",
                          description: "Monitor workspace activity and changes",
                        },
                      ].map((api) => (
                        <div key={api.name} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <Switch checked={api.connected} />
                            <div className="flex-1">
                              <div className="font-medium">{api.name}</div>
                              <div className="text-sm text-muted-foreground">{api.description}</div>
                              <div className="text-xs text-primary">{api.cost}</div>
                            </div>
                          </div>
                          <Badge variant={api.connected ? "default" : "secondary"}>
                            {api.connected ? "Connected" : "Disconnected"}
                          </Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="local-llm" className="h-full mt-4">
              <ScrollArea className="h-full pr-4">
                <LocalLLMInstaller />
              </ScrollArea>
            </TabsContent>

            <TabsContent value="routing" className="h-full mt-4">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Intelligent Routing Rules</CardTitle>
                      <CardDescription>
                        Configure how requests are routed between AI Studio and Local LLM. Rules are evaluated in
                        priority order.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-4">
                        {settings.routingRules.map((rule) => (
                          <div key={rule.id} className="p-4 border rounded-lg space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <Switch
                                  checked={rule.enabled}
                                  onCheckedChange={(checked) => updateRoutingRule(rule.id, { enabled: checked })}
                                />
                                <div>
                                  <div className="font-medium flex items-center space-x-2">
                                    <span>{rule.name}</span>
                                    <Badge variant="outline" className="text-xs">
                                      Priority {rule.priority}
                                    </Badge>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Last triggered: {rule.lastTriggered || "Never"}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-3">
                                <div className="text-right">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-sm font-medium">Effectiveness:</span>
                                    <Badge
                                      variant={
                                        rule.effectiveness >= 80
                                          ? "default"
                                          : rule.effectiveness >= 60
                                            ? "secondary"
                                            : "destructive"
                                      }
                                      className="text-xs"
                                    >
                                      {rule.effectiveness}%
                                    </Badge>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {rule.successes}/{rule.matches} successful
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingRule(rule)
                                    setEditDialogOpen(true)
                                  }}
                                >
                                  Edit
                                </Button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="font-medium text-muted-foreground">Condition:</span>
                                <div className="mt-1 p-2 bg-muted rounded text-xs font-mono">{rule.condition}</div>
                              </div>
                              <div>
                                <span className="font-medium text-muted-foreground">Action:</span>
                                <div className="mt-1 p-2 bg-muted rounded text-xs">
                                  {rule.action
                                    .replace(/_/g, " ")
                                    .toLowerCase()
                                    .replace(/\b\w/g, (l) => l.toUpperCase())}
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                              <div className="text-center">
                                <div className="text-lg font-semibold text-primary">{rule.matches}</div>
                                <div className="text-xs text-muted-foreground">Total Matches</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-semibold text-green-600">{rule.successes}</div>
                                <div className="text-xs text-muted-foreground">Successful Routes</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-semibold text-red-600">
                                  {rule.matches - rule.successes}
                                </div>
                                <div className="text-xs text-muted-foreground">Failed Routes</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <RuleDialog onAddRule={addRoutingRule} />

                      {/* Add the EditRuleDialog */}
                      <EditRuleDialog
                        rule={editingRule}
                        open={editDialogOpen}
                        onOpenChange={setEditDialogOpen}
                        onSaveRule={updateRoutingRule}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Rule Performance Analytics</CardTitle>
                      <CardDescription>Overall routing performance and optimization suggestions</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center p-4 border rounded-lg">
                          <div className="text-2xl font-bold text-primary">89.2%</div>
                          <div className="text-sm text-muted-foreground">Overall Success Rate</div>
                        </div>
                        <div className="text-center p-4 border rounded-lg">
                          <div className="text-2xl font-bold text-green-600">2,202</div>
                          <div className="text-sm text-muted-foreground">Total Requests Routed</div>
                        </div>
                        <div className="text-center p-4 border rounded-lg">
                          <div className="text-2xl font-bold text-orange-600">$12.34</div>
                          <div className="text-sm text-muted-foreground">Cost Savings This Month</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-medium">Optimization Suggestions</h4>
                        <div className="space-y-2">
                          <div className="p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <div className="flex items-start space-x-2">
                              <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                              <div>
                                <div className="text-sm font-medium">Low Effectiveness Rule Detected</div>
                                <div className="text-xs text-muted-foreground">
                                  "Local File Access - Local LLM" has only 45% effectiveness. Consider refining
                                  conditions or disabling.
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <div className="flex items-start space-x-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                              <div>
                                <div className="text-sm font-medium">High Traffic Pattern</div>
                                <div className="text-xs text-muted-foreground">
                                  Email-related requests are frequent. Consider creating more specific email routing
                                  rules.
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Cost Optimization</CardTitle>
                      <CardDescription>Configure settings to optimize API usage costs</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Monthly Budget Limit</Label>
                        <Input type="number" placeholder="50" />
                        <p className="text-xs text-muted-foreground">Set a monthly budget limit for API usage in USD</p>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch defaultChecked />
                        <Label>Enable Cost-Based Routing</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch defaultChecked />
                        <Label>Alert When 80% of Budget is Reached</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch />
                        <Label>Auto-disable Low Effectiveness Rules (&lt; 50%)</Label>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>API Budget Weights</CardTitle>
                      <CardDescription>
                        Assign priority weights to different APIs for routing decisions (1-10 scale)
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {[
                        {
                          id: "gmail-api",
                          name: "Gmail API",
                          baseCost: "$0.05 per 1000 requests",
                          description: "Read, send, and manage emails",
                        },
                        {
                          id: "google-drive",
                          name: "Google Drive API",
                          baseCost: "$0.04 per 1000 requests",
                          description: "Access and manage files and folders",
                        },
                        {
                          id: "google-calendar",
                          name: "Google Calendar API",
                          baseCost: "$0.03 per 1000 requests",
                          description: "Create and manage calendar events",
                        },
                        {
                          id: "gemini-api",
                          name: "Gemini API",
                          baseCost: "$0.0001 per 1K tokens",
                          description: "Advanced AI text generation and analysis",
                        },
                        {
                          id: "cloud-vision",
                          name: "Cloud Vision API",
                          baseCost: "$1.50 per 1000 images",
                          description: "Image analysis and object detection",
                        },
                        {
                          id: "cloud-speech",
                          name: "Cloud Speech API",
                          baseCost: "$0.006 per 15 seconds",
                          description: "Speech-to-text transcription",
                        },
                        {
                          id: "cloud-translation",
                          name: "Cloud Translation API",
                          baseCost: "$20 per million chars",
                          description: "Text translation between languages",
                        },
                      ].map((api) => (
                        <div key={api.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium">{api.name}</div>
                            <div className="text-sm text-muted-foreground">{api.description}</div>
                            <div className="text-xs text-muted-foreground">{api.baseCost}</div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2">
                              <Label className="text-sm">Weight:</Label>
                              <Input
                                type="number"
                                min="1"
                                max="10"
                                step="1"
                                value={settings.apiWeights[api.id] || 5}
                                onChange={(e) => {
                                  const newWeights = {
                                    ...settings.apiWeights,
                                    [api.id]: Number.parseInt(e.target.value) || 5,
                                  }
                                  updateSettings({ apiWeights: newWeights })
                                }}
                                className="w-20"
                              />
                            </div>
                            <div className="text-sm">
                              <Badge
                                variant={
                                  (settings.apiWeights[api.id] || 5) >= 8
                                    ? "default"
                                    : (settings.apiWeights[api.id] || 5) >= 6
                                      ? "secondary"
                                      : "outline"
                                }
                              >
                                {(settings.apiWeights[api.id] || 5) >= 8
                                  ? "High Priority"
                                  : (settings.apiWeights[api.id] || 5) >= 6
                                    ? "Medium Priority"
                                    : "Low Priority"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}

                      <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="text-sm font-medium mb-2">Weight Guide (1-10 scale):</div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div>
                            • <strong>1-3</strong> = Low Priority (avoid when possible, use only if necessary)
                          </div>
                          <div>
                            • <strong>4-5</strong> = Normal Priority (standard preference)
                          </div>
                          <div>
                            • <strong>6-7</strong> = Medium Priority (prefer this API)
                          </div>
                          <div>
                            • <strong>8-10</strong> = High Priority (strongly prefer this API)
                          </div>
                          <div>• Higher numbers make the routing system prefer this API over others</div>
                          <div>
                            • Use higher weights for APIs that provide better results or are more cost-effective
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Dialogs */}
      <DocumentationViewer open={docsOpen} onOpenChange={setDocsOpen} />
      <IssueReporter open={issueReporterOpen} onOpenChange={setIssueReporterOpen} />
    </div>
  )
}
