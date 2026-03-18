"use client"

import { useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { ChatInterface } from "@/components/chat-interface"
import { Dashboard } from "@/components/dashboard"
import { Settings } from "@/components/settings"
import { Header } from "@/components/header"
import { SettingsProvider } from "@/hooks/use-settings"

export default function Home() {
  const [activeTab, setActiveTab] = useState("chat")

  const renderContent = () => {
    switch (activeTab) {
      case "chat":
        return <ChatInterface />
      case "dashboard":
        return <Dashboard />
      case "settings":
        return <Settings />
      default:
        return <ChatInterface />
    }
  }

  return (
    <SettingsProvider>
      <div className="flex h-screen bg-background">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-hidden">{renderContent()}</main>
        </div>
      </div>
    </SettingsProvider>
  )
}
