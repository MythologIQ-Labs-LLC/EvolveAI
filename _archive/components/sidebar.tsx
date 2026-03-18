"use client"

import { Button } from "@/components/ui/button"
import { MessageSquare, BarChart3, Settings, Workflow } from "lucide-react"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"

interface SidebarProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const tabs = [
    { id: "chat", label: "Chat", icon: MessageSquare },
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "settings", label: "Settings", icon: Settings },
  ]

  // Track AI Studio connection status from localStorage
  const [aiStudioConnected, setAiStudioConnected] = useState(false)

  useEffect(() => {
    // Read from localStorage (set by chat interface)
    const checkStatus = () => {
      const status = localStorage.getItem("ai-studio-connected")
      setAiStudioConnected(status === "true")
    }
    checkStatus()
    window.addEventListener("storage", checkStatus)
    return () => window.removeEventListener("storage", checkStatus)
  }, [])

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center space-x-2 mb-4">
          <div className={`w-3 h-3 rounded-full ${aiStudioConnected ? "bg-green-500" : "bg-red-500"}`}></div>
          <span className="text-sm font-medium text-foreground">
            AI Studio {aiStudioConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          <span className="text-sm font-medium text-foreground">Local LLM Disconnected</span>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <div className="space-y-2">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start text-foreground",
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "hover:bg-accent hover:text-accent-foreground",
                )}
                onClick={() => onTabChange(tab.id)}
              >
                <Icon className="mr-2 h-4 w-4" />
                {tab.label}
              </Button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
