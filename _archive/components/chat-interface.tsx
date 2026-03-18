"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSettings } from "@/hooks/use-settings"
import { Send, Bot, User, Zap, Users } from "lucide-react"
import { toast } from "sonner"

interface Message {
  id: string
  content: string
  sender: "user" | "gemini" | "local-llm"
  timestamp: Date
  conversationMode?: boolean
}

type ChatMode = "gemini" | "local-llm" | "conversational"

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [chatMode, setChatMode] = useState<ChatMode>("gemini")
  const [aiStudioKey, setAiStudioKey] = useState("")
  const [aiStudioConnected, setAiStudioConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { settings } = useSettings()

  // Load API key from localStorage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem("ai-studio-api-key")
    if (savedKey) {
      setAiStudioKey(savedKey)
    }
  }, [])

  // Test connection whenever the API key changes
  useEffect(() => {
    if (!aiStudioKey) {
      setAiStudioConnected(false)
      setConnectionError(null)
      return
    }
    const testConnection = async () => {
      try {
        const response = await fetch("/api/ai-studio/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: aiStudioKey }),
        })
        const data = await response.json()
        if (data.success) {
          setAiStudioConnected(true)
          setConnectionError(null)
        } else {
          setAiStudioConnected(false)
          setConnectionError(data.error || "Connection failed")
        }
      } catch (error) {
        setAiStudioConnected(false)
        setConnectionError("Failed to test connection")
      }
    }
    testConnection()
  }, [aiStudioKey])

  useEffect(() => {
    localStorage.setItem("ai-studio-connected", aiStudioConnected ? "true" : "false")
  }, [aiStudioConnected])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || !aiStudioConnected) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: "user",
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue("")
    setIsLoading(true)

    try {
      if (chatMode === "gemini") {
        // Use real Google AI Studio API
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: [...messages, userMessage],
            apiKey: aiStudioKey,
            model: "gemini-1.5-flash",
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || `API Error: ${response.status}`)
        }

        const data = await response.json()

        if (data.success) {
          const aiResponse: Message = {
            id: (Date.now() + 1).toString(),
            content: data.data.content,
            sender: "gemini",
            timestamp: new Date(data.data.timestamp),
          }
          setMessages((prev) => [...prev, aiResponse])
        } else {
          throw new Error(data.error || "Failed to get response")
        }
      } else if (chatMode === "local-llm") {
        // For now, use mock response until local LLM is implemented
        setTimeout(() => {
          const response: Message = {
            id: (Date.now() + 1).toString(),
            content: getLocalLLMResponse(inputValue),
            sender: "local-llm",
            timestamp: new Date(),
          }
          setMessages((prev) => [...prev, response])
          setIsLoading(false)
        }, 1000)
        return
      } else if (chatMode === "conversational") {
        // Conversational mode - both AIs respond
        const geminiResponse = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: [...messages, userMessage],
            apiKey: aiStudioKey,
            model: "gemini-1.5-flash",
          }),
        })

        if (geminiResponse.ok) {
          const geminiData = await geminiResponse.json()
          if (geminiData.success) {
            const geminiMsg: Message = {
              id: (Date.now() + 1).toString(),
              content: `Gemini: ${geminiData.data.content}`,
              sender: "gemini",
              timestamp: new Date(geminiData.data.timestamp),
              conversationMode: true,
            }
            setMessages((prev) => [...prev, geminiMsg])
          }
        }

        // Local LLM response (mock for now)
        setTimeout(() => {
          const localResponse: Message = {
            id: (Date.now() + 2).toString(),
            content: `Local LLM: ${getLocalLLMResponse(inputValue)}`,
            sender: "local-llm",
            timestamp: new Date(),
            conversationMode: true,
          }
          setMessages((prev) => [...prev, localResponse])
        }, 2000)
      }
    } catch (error) {
      console.error("Chat error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to send message")
      
      // Add error message to chat
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        sender: "gemini",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const getLocalLLMResponse = (input: string): string => {
    const responses = [
      "I'm running locally on your machine, which means your data stays private. Here's my analysis of your request.",
      "As your local AI assistant, I can process this without sending data to external servers. Let me help you with that.",
      "Running locally gives me the advantage of privacy and speed. Here's what I think about your question.",
      "I'm processing this entirely on your local hardware. Here's my perspective on what you're asking.",
      "Since I'm running locally, I can provide quick responses while keeping your information secure. Here's my take.",
    ]
    return responses[Math.floor(Math.random() * responses.length)]
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  const getSenderIcon = (sender: Message["sender"]) => {
    switch (sender) {
      case "user":
        return <User className="w-4 h-4" />
      case "gemini":
        return <Zap className="w-4 h-4" />
      case "local-llm":
        return <Bot className="w-4 h-4" />
    }
  }

  const getSenderName = (sender: Message["sender"]) => {
    switch (sender) {
      case "user":
        return "You"
      case "gemini":
        return "Gemini (AI Studio)"
      case "local-llm":
        return "Local LLM"
    }
  }

  const getSenderColor = (sender: Message["sender"]) => {
    switch (sender) {
      case "user":
        return "bg-primary text-primary-foreground"
      case "gemini":
        return "bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100"
      case "local-llm":
        return "bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-100"
    }
  }

  const isLocalLLMEnabled = false // This will be updated when local LLM is connected

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Chat Interface</h2>
            <p className="text-sm text-muted-foreground">
              {chatMode === "conversational"
                ? "Conversational mode: Both AIs will respond and can interact with each other"
                : `Chatting with ${getSenderName(chatMode as "gemini" | "local-llm")}`}
            </p>
          </div>
        </div>

        {/* API Key Input */}
        {chatMode === "gemini" && (
          <div className="mb-4">
            <label className="text-sm font-medium">Google AI Studio API Key:</label>
            <div className="flex space-x-2 mt-1">
              <Input
                type="password"
                placeholder="Enter your AI Studio API key"
                value={aiStudioKey}
                onChange={(e) => {
                  setAiStudioKey(e.target.value)
                  localStorage.setItem("ai-studio-api-key", e.target.value)
                }}
                className="flex-1"
              />
              <Button 
                variant="outline" 
                onClick={async () => {
                  if (!aiStudioKey) {
                    toast.error("Please enter an API key first")
                    return
                  }
                  try {
                    const response = await fetch("/api/ai-studio/test", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ apiKey: aiStudioKey }),
                    })
                    const data = await response.json()
                    if (data.success) {
                      toast.success("Successfully connected to Google AI Studio!")
                    } else {
                      toast.error(data.error || "Connection failed")
                    }
                  } catch (error) {
                    toast.error("Failed to test connection")
                  }
                }}
              >
                Test Connection
              </Button>
            </div>
            {!aiStudioConnected && (
              <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
                ⚠️ {connectionError || "Please enter your Google AI Studio API key to start chatting"}
              </div>
            )}
          </div>
        )}

        {/* Chat Mode Selector */}
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium">Chat Mode:</label>
          <Select value={chatMode} onValueChange={(value: ChatMode) => setChatMode(value)}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gemini">
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4" />
                  <span>Gemini (AI Studio)</span>
                </div>
              </SelectItem>
              <SelectItem value="local-llm" disabled={!isLocalLLMEnabled}>
                <div className="flex items-center space-x-2">
                  <Bot className="w-4 h-4" />
                  <span>Local LLM {!isLocalLLMEnabled && "(Disconnected)"}</span>
                </div>
              </SelectItem>
              <SelectItem value="conversational" disabled={!isLocalLLMEnabled}>
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4" />
                  <span>Conversational Mode {!isLocalLLMEnabled && "(Requires Local LLM)"}</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4">
            {messages.map((message) => (
              <div key={message.id} className="flex flex-col space-y-2">
                <div
                  className={`flex ${
                    message.sender === "user" ? "justify-end" : "justify-start"
                  } ${message.conversationMode ? "ml-4" : ""}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.sender === "user" ? getSenderColor("user") : getSenderColor(message.sender)
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      {getSenderIcon(message.sender)}
                      <span className="text-xs font-medium">{getSenderName(message.sender)}</span>
                      {settings.showTimestamps && (
                        <span className="text-xs opacity-70">{formatTime(message.timestamp)}</span>
                      )}
                    </div>
                    <div className={`text-sm ${settings.compactMessageLayout ? "leading-tight" : "leading-relaxed"}`}>
                      {message.content}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-3 max-w-[80%]">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span className="text-sm text-muted-foreground">
                      {chatMode === "conversational" ? "Both AIs are thinking..." : "AI is thinking..."}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-border">
        <div className="flex space-x-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              chatMode === "conversational"
                ? "Message both AIs..."
                : `Message ${getSenderName(chatMode as "gemini" | "local-llm")}...`
            }
            disabled={isLoading || (chatMode === "gemini" && !aiStudioConnected)}
            className="flex-1"
          />
          <Button 
            onClick={handleSendMessage} 
            disabled={isLoading || !inputValue.trim() || (chatMode === "gemini" && !aiStudioConnected)}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>

        {chatMode === "conversational" && (
          <div className="mt-2 text-xs text-muted-foreground">
            💡 In conversational mode, both AIs will respond to your message and may interact with each other
          </div>
        )}
      </div>
    </div>
  )
}
