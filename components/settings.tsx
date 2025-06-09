"use client"

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
import { useState, useEffect } from "react"
import Link from "next/link"
import { RuleDialog } from "@/components/rule-dialog"
import { EditRuleDialog } from "@/components/edit-rule-dialog"
import { ExternalLink } from "lucide-react"

export function Settings() {
  const [aiStudioKey, setAiStudioKey] = useState("")
  const [localLlmEndpoint, setLocalLlmEndpoint] = useState("http://localhost:11434")
  const { settings, updateSettings, updateRoutingRule, addRoutingRule, deleteRoutingRule } = useSettings()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const [editingRule, setEditingRule] = useState<any>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

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
          <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 via-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">M</span>
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
                            onValueChange={(value: "blue" | "green" | "purple" | "orange" | "red" | "teal") =>
                              updateSettings({ accentColor: value })
                            }
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
                        <Label>Compact Message Layout</Label>
                        <Switch
                          checked={settings.compactMessageLayout}
                          onCheckedChange={(checked) => updateSettings({ compactMessageLayout: checked })}
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
                        <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 via-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                          <span className="text-white font-bold text-xl">M</span>
                        </div>
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
                        <Button variant="outline" className="w-full">
                          Check for Updates
                        </Button>
                        <Button variant="outline" className="w-full">
                          View Documentation
                        </Button>
                        <Button variant="outline" className="w-full">
                          Report an Issue
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Other tabs content remains the same but with proper theming classes */}
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
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {[
                        {
                          name: "Gmail API",
                          connected: true,
                          scope: "Read/Write emails",
                          cost: "$0.05 per 1000 requests",
                          description: "Access and manage Gmail messages, labels, and settings",
                        },
                        {
                          name: "Google Drive",
                          connected: true,
                          scope: "Read/Write files",
                          cost: "$0.04 per 1000 requests",
                          description: "Upload, download, and manage files and folders in Google Drive",
                        },
                        {
                          name: "Google Calendar",
                          connected: true,
                          scope: "Read/Write events",
                          cost: "$0.03 per 1000 requests",
                          description: "Create, update, and manage calendar events and schedules",
                        },
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
                              <div className="text-xs text-muted-foreground">{api.scope}</div>
                              <div className="text-xs text-primary">{api.cost}</div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={api.connected ? "default" : "secondary"}>
                              {api.connected ? "Connected" : "Disconnected"}
                            </Badge>
                            <Button variant="outline" size="sm">
                              {api.connected ? "Reconnect" : "Connect"}
                            </Button>
                          </div>
                        </div>
                      ))}
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
                          name: "Gemini API",
                          enabled: true,
                          cost: "$0.0001 per 1K input tokens, $0.0002 per 1K output tokens",
                          description: "Advanced AI text generation, analysis, and reasoning",
                        },
                        {
                          name: "Cloud Vision API",
                          enabled: true,
                          cost: "$1.50 per 1000 images",
                          description: "Image analysis, object detection, and text extraction",
                        },
                        {
                          name: "Cloud Speech API",
                          enabled: false,
                          cost: "$0.006 per 15 seconds of audio",
                          description: "Speech-to-text transcription and audio analysis",
                        },
                        {
                          name: "Cloud Translation API",
                          enabled: false,
                          cost: "$20 per million characters",
                          description: "Text translation between 100+ languages",
                        },
                        {
                          name: "Document AI",
                          enabled: false,
                          cost: "$0.05 per page",
                          description: "Extract and classify data from documents",
                        },
                        {
                          name: "Vertex AI API",
                          enabled: false,
                          cost: "Varies by model",
                          description: "Custom ML models and AutoML capabilities",
                        },
                        {
                          name: "Cloud Natural Language API",
                          enabled: false,
                          cost: "$0.001 per text record",
                          description: "Sentiment analysis and entity recognition",
                        },
                        {
                          name: "Cloud Video Intelligence API",
                          enabled: false,
                          cost: "$0.10 per minute of video",
                          description: "Video content analysis and annotation",
                        },
                        {
                          name: "Dialogflow API",
                          enabled: false,
                          cost: "$0.002 per request",
                          description: "Build conversational interfaces and chatbots",
                        },
                        {
                          name: "Sensitive Data Protection (DLP)",
                          enabled: false,
                          cost: "$1.00 per 1000 units",
                          description: "Detect and protect sensitive information",
                        },
                        {
                          name: "Cloud AutoML API",
                          enabled: false,
                          cost: "Varies by model type",
                          description: "Train custom machine learning models",
                        },
                        {
                          name: "Places API",
                          enabled: false,
                          cost: "$0.017 per request",
                          description: "Location data and place information",
                        },
                        {
                          name: "Fact Check Tools API",
                          enabled: false,
                          cost: "Free",
                          description: "Verify claims against fact-checking sources",
                        },
                      ].map((api) => (
                        <div key={api.name} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <Switch checked={api.enabled} />
                            <div className="flex-1">
                              <div className="font-medium">{api.name}</div>
                              <div className="text-sm text-muted-foreground">{api.description}</div>
                              <div className="text-xs text-primary">{api.cost}</div>
                            </div>
                          </div>
                          <Badge variant={api.enabled ? "default" : "secondary"}>
                            {api.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </div>
                      ))}
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
                          name: "YouTube Data API v3",
                          enabled: false,
                          cost: "$0.01 per 100 units",
                          description: "Access YouTube videos, channels, and playlists",
                        },
                        {
                          name: "Google People API",
                          enabled: false,
                          cost: "$0.02 per 1000 requests",
                          description: "Access contact information and profiles",
                        },
                        {
                          name: "Blogger API",
                          enabled: false,
                          cost: "Free",
                          description: "Manage Blogger blogs and posts",
                        },
                        {
                          name: "Google Workspace Add-ons API",
                          enabled: false,
                          cost: "Free",
                          description: "Build add-ons for Workspace applications",
                        },
                        {
                          name: "Apps Script API",
                          enabled: false,
                          cost: "Free",
                          description: "Execute and manage Google Apps Script projects",
                        },
                        {
                          name: "Groups Settings API",
                          enabled: false,
                          cost: "Free",
                          description: "Manage Google Groups settings and membership",
                        },
                        {
                          name: "Google Drive Activity API",
                          enabled: false,
                          cost: "$0.02 per 1000 requests",
                          description: "Monitor file activity and changes in Drive",
                        },
                        {
                          name: "Google Custom Search API",
                          enabled: false,
                          cost: "$5 per 1000 queries",
                          description: "Perform custom web searches",
                        },
                      ].map((api) => (
                        <div key={api.name} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <Switch checked={api.enabled} />
                            <div className="flex-1">
                              <div className="font-medium">{api.name}</div>
                              <div className="text-sm text-muted-foreground">{api.description}</div>
                              <div className="text-xs text-primary">{api.cost}</div>
                            </div>
                          </div>
                          <Badge variant={api.enabled ? "default" : "secondary"}>
                            {api.enabled ? "Enabled" : "Disabled"}
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
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Local LLM Integration</CardTitle>
                      <CardDescription>Configure connection to your local LLM (e.g., Ollama)</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Switch />
                        <Label>Enable Local LLM as Primary Route</Label>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <Label htmlFor="local-llm-endpoint">Local LLM Endpoint URL</Label>
                        <div className="flex space-x-2">
                          <Input
                            id="local-llm-endpoint"
                            placeholder="http://localhost:11434"
                            value={localLlmEndpoint}
                            onChange={(e) => setLocalLlmEndpoint(e.target.value)}
                          />
                          <Button variant="outline">Test Connection</Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Enter the endpoint URL for your local LLM service
                        </p>
                      </div>

                      <div className="p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                          <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                            Local LLM Disconnected
                          </span>
                        </div>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                          Unable to connect to local LLM. Please ensure your local LLM service is running.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Supported Google LLM Models</Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {[
                            "Gemini 1.5 Pro",
                            "Gemini 1.5 Flash",
                            "Gemini 1.0 Pro",
                            "PaLM 2 for Text",
                            "Codey for Code Generation",
                            "Text Bison",
                          ].map((model) => (
                            <div key={model} className="p-2 border rounded-md text-sm">
                              {model}
                            </div>
                          ))}
                        </div>
                        <div className="mt-4">
                          <Button variant="outline" className="w-full" asChild>
                            <Link
                              href="https://ai.google.dev/models"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center space-x-2"
                            >
                              <span>Install Additional LLM Models</span>
                              <ExternalLink className="w-4 h-4" />
                            </Link>
                          </Button>
                          <p className="text-xs text-muted-foreground mt-2 text-center">
                            Launch installer for Ollama, LocalAI, and other local LLM providers
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Local LLM Performance</CardTitle>
                      <CardDescription>Monitor and optimize your local LLM performance</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Memory Usage Limit</Label>
                        <Input type="number" placeholder="8" />
                        <p className="text-xs text-muted-foreground">Memory limit in GB</p>
                      </div>

                      <div className="space-y-2">
                        <Label>Max Tokens</Label>
                        <Input type="number" placeholder="4096" />
                      </div>

                      <div className="space-y-2">
                        <Label>Temperature</Label>
                        <Input type="number" placeholder="0.7" min="0" max="1" step="0.1" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
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
    </div>
  )
}
