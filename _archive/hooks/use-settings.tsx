"use client"

import React from "react"
import { createContext, useContext, useEffect, useState } from "react"

interface Settings {
  theme: "light" | "dark" | "system" | "midnight" | "forest" | "ocean"
  accentColor: "blue" | "green" | "purple" | "orange" | "red" | "teal"
  fontSize: "small" | "medium" | "large"
  showTimestamps: boolean
  showToolCallBadges: boolean
  compactMessageLayout: boolean
  enableSoundNotifications: boolean
  localLLMEnabled: boolean
  routingRules: RoutingRule[]
  apiWeights: Record<string, number>
}

interface RoutingRule {
  id: string
  name: string
  condition: string
  action: string
  priority: number
  enabled: boolean
  effectiveness: number
  matches: number
  successes: number
  created: string
  lastTriggered?: string
}

interface SettingsContextType {
  settings: Settings
  updateSettings: (newSettings: Partial<Settings>) => void
  updateRoutingRule: (ruleId: string, updates: Partial<RoutingRule>) => void
  addRoutingRule: (newRule: Omit<RoutingRule, "id">) => void
  deleteRoutingRule: (ruleId: string) => void
}

const defaultSettings: Settings = {
  theme: "system",
  accentColor: "blue",
  fontSize: "medium",
  showTimestamps: true,
  showToolCallBadges: true,
  compactMessageLayout: false,
  enableSoundNotifications: false,
  localLLMEnabled: true,
  routingRules: [
    {
      id: "1",
      name: "Personal Data - Local RAG",
      condition: "text_contains 'personal' OR text_contains 'private'",
      action: "ROUTE_TO_LOCAL_LLM",
      enabled: true,
      priority: 9,
      effectiveness: 87,
      matches: 156,
      successes: 136,
      created: "2024-01-15T10:00:00Z",
      lastTriggered: "2 hours ago",
    },
    {
      id: "2",
      name: "Email Analysis - Gmail API",
      condition: "text_contains 'email' OR text_contains 'gmail' OR text_contains 'inbox'",
      action: "USE_GMAIL_API",
      enabled: true,
      priority: 8,
      effectiveness: 94,
      matches: 342,
      successes: 321,
      created: "2024-01-15T10:00:00Z",
      lastTriggered: "15 minutes ago",
    },
    {
      id: "3",
      name: "Image Processing - Vision API",
      condition: "request_type is 'image' OR text_contains 'analyze image'",
      action: "USE_CLOUD_VISION_API",
      enabled: true,
      priority: 7,
      effectiveness: 98,
      matches: 89,
      successes: 87,
      created: "2024-01-15T10:00:00Z",
      lastTriggered: "1 hour ago",
    },
    {
      id: "4",
      name: "Document Processing - Drive API",
      condition: "text_contains 'document' OR text_contains 'file' OR text_contains 'drive'",
      action: "USE_GOOGLE_DRIVE_API",
      enabled: true,
      priority: 6,
      effectiveness: 89,
      matches: 156,
      successes: 139,
      created: "2024-01-15T10:00:00Z",
      lastTriggered: "45 minutes ago",
    },
    {
      id: "5",
      name: "Calendar Management - Calendar API",
      condition: "text_contains 'calendar' OR text_contains 'schedule' OR text_contains 'meeting'",
      action: "USE_GOOGLE_CALENDAR_API",
      enabled: true,
      priority: 5,
      effectiveness: 91,
      matches: 278,
      successes: 253,
      created: "2024-01-15T10:00:00Z",
      lastTriggered: "5 minutes ago",
    },
    {
      id: "6",
      name: "Translation Tasks - Translation API",
      condition: "text_contains 'translate' OR text_contains 'language'",
      action: "USE_CLOUD_TRANSLATION_API",
      enabled: true,
      priority: 4,
      effectiveness: 96,
      matches: 67,
      successes: 64,
      created: "2024-01-15T10:00:00Z",
      lastTriggered: "30 minutes ago",
    },
    {
      id: "7",
      name: "Complex Analysis - Gemini API",
      condition: "text_contains 'analyze' OR text_contains 'summarize' OR text_contains 'complex'",
      action: "USE_GEMINI_API",
      enabled: true,
      priority: 3,
      effectiveness: 93,
      matches: 445,
      successes: 414,
      created: "2024-01-15T10:00:00Z",
      lastTriggered: "8 minutes ago",
    },
    {
      id: "8",
      name: "Cost Optimization - Local LLM",
      condition: "estimated_cost > $0.10",
      action: "ROUTE_TO_LOCAL_LLM",
      enabled: true,
      priority: 2,
      effectiveness: 73,
      matches: 67,
      successes: 49,
      created: "2024-01-15T10:00:00Z",
      lastTriggered: "30 minutes ago",
    },
    {
      id: "9",
      name: "Default Route - AI Studio",
      condition: "TRUE",
      action: "ROUTE_TO_AI_STUDIO",
      enabled: true,
      priority: 1,
      effectiveness: 89,
      matches: 1247,
      successes: 1110,
      created: "2024-01-15T10:00:00Z",
      lastTriggered: "1 minute ago",
    },
  ],
  apiWeights: {
    "gmail-api": 3,
    "google-drive": 3,
    "google-calendar": 3,
    "gemini-api": 7,
    "cloud-vision": 8,
    "cloud-speech": 4,
    "cloud-translation": 6,
  },
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings)

  useEffect(() => {
    const savedSettings = localStorage.getItem("google-ai-bridge-settings")
    if (savedSettings) {
      setSettings({ ...defaultSettings, ...JSON.parse(savedSettings) })
    }
  }, [])

  // Apply settings to document root
  useEffect(() => {
    const root = document.documentElement

    // Apply accent color
    root.setAttribute("data-accent", settings.accentColor)

    // Apply font size
    root.setAttribute("data-font-size", settings.fontSize)

    // Apply theme classes
    root.className = root.className.replace(/theme-\w+/g, "")
    if (settings.theme !== "system" && settings.theme !== "light" && settings.theme !== "dark") {
      root.classList.add(`theme-${settings.theme}`)
    }
  }, [settings])

  const updateSettings = (newSettings: Partial<Settings>) => {
    const updatedSettings = { ...settings, ...newSettings }
    setSettings(updatedSettings)
    localStorage.setItem("google-ai-bridge-settings", JSON.stringify(updatedSettings))
  }

  const updateRoutingRule = (ruleId: string, updates: Partial<RoutingRule>) => {
    const updatedRules = settings.routingRules.map((rule) => (rule.id === ruleId ? { ...rule, ...updates } : rule))
    updateSettings({ routingRules: updatedRules })
  }

  const addRoutingRule = (newRule: Omit<RoutingRule, "id">) => {
    const ruleWithId = {
      ...newRule,
      id: Date.now().toString(),
    }
    updateSettings({ routingRules: [...settings.routingRules, ruleWithId] })
  }

  const deleteRoutingRule = (ruleId: string) => {
    const updatedRules = settings.routingRules.filter((rule) => rule.id !== ruleId)
    updateSettings({ routingRules: updatedRules })
  }

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        updateRoutingRule,
        addRoutingRule,
        deleteRoutingRule,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider")
  }
  return context
}
