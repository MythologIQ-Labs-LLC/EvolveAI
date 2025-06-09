"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSettings } from "@/hooks/use-settings"
import { Send, Bot, User, Zap, Users } from "lucide-react"

interface Message {
  id: string
  content: string
  sender: "user" | "gemini" | "local-llm"
  timestamp: Date
  conversationMode?: boolean
}

type ChatMode = "gemini" | "local-llm" | "conversational"

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: "Hello! I'm connected to Google AI Studio. How can I help you today?",
      sender: "gemini",
      timestamp: new Date(Date.now() - 5000),
    },
  ])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [chatMode, setChatMode] = useState<ChatMode>("gemini")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { settings } = useSettings()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: "user",
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue("")
    setIsLoading(true)

    // Simulate API responses based on chat mode
    setTimeout(
      () => {
        if (chatMode === "conversational") {
          // In conversational mode, both AIs respond
          const geminiResponse: Message = {
            id: (Date.now() + 1).toString(),
            content: `Gemini: I can help with that! ${getGeminiResponse(inputValue)}`,
            sender: "gemini",
            timestamp: new Date(),
            conversationMode: true,
          }

          const localResponse: Message = {
            id: (Date.now() + 2).toString(),
            content: `Local LLM: Here's my perspective: ${getLocalLLMResponse(inputValue)}`,
            sender: "local-llm",
            timestamp: new Date(),
            conversationMode: true,
          }

          setMessages((prev) => [...prev, geminiResponse, localResponse])

          // Sometimes they respond to each other
          if (Math.random() > 0.7) {
            setTimeout(() => {
              const followUp: Message = {
                id: (Date.now() + 3).toString(),
                content: `Gemini: That's a great point from Local LLM! I'd also add that we could approach this differently by leveraging Google's APIs for additional context.`,
                sender: "gemini",
                timestamp: new Date(),
                conversationMode: true,
              }
              setMessages((prev) => [...prev, followUp])
            }, 2000)
          }
        } else {
          // Single AI response
          const response: Message = {
            id: (Date.now() + 1).toString(),
            content: chatMode === "gemini" ? getGeminiResponse(inputValue) : getLocalLLMResponse(inputValue),
            sender: chatMode,
            timestamp: new Date(),
          }
          setMessages((prev) => [...prev, response])
        }
        setIsLoading(false)
      },
      1000 + Math.random() * 2000,
    )
  }

  const getGeminiResponse = (input: string): string => {
    const responses = [
      "I can help you with that using Google's powerful AI capabilities. Let me analyze your request and provide a comprehensive response.",
      "Based on my training and access to Google's services, here's what I can tell you about that topic.",
      "That's an interesting question! I can leverage Google's APIs to provide you with detailed information and actionable insights.",
      "I'll process that request using my advanced language understanding. Here's my analysis and recommendations.",
      "Great question! I can access various Google services to help you accomplish that task efficiently.",
    ]
    return responses[Math.floor(Math.random() * responses.length)]
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
              <SelectItem value="local-llm" disabled>
                <div className="flex items-center space-x-2">
                  <Bot className="w-4 h-4" />
                  <span>Local LLM (Disconnected)</span>
                </div>
              </SelectItem>
              <SelectItem value="conversational" disabled>
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4" />
                  <span>Conversational Mode (Requires Local LLM)</span>
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
            disabled={isLoading}
            className="flex-1"
          />
          <Button onClick={handleSendMessage} disabled={isLoading || !inputValue.trim()}>
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
