"use client"

import React, { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { 
  MessageSquare, 
  Users, 
  Brain, 
  Play, 
  Pause, 
  Square, 
  Trash2, 
  Settings,
  Sparkles,
  Home,
  Zap
} from "lucide-react"
import { toast } from "react-hot-toast"
import { conversationalModeManager, ConversationParticipant, CollaborationSession, CollaborationStrategy } from '@/lib/conversational-mode'

interface ConversationalModeProps {
  onSessionCreated?: (session: CollaborationSession) => void
}

export default function ConversationalMode({ onSessionCreated }: ConversationalModeProps) {
  const [sessions, setSessions] = useState<CollaborationSession[]>([])
  const [currentSession, setCurrentSession] = useState<CollaborationSession | null>(null)
  const [strategies, setStrategies] = useState<CollaborationStrategy[]>([])
  const [participants, setParticipants] = useState<ConversationParticipant[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showNewSessionDialog, setShowNewSessionDialog] = useState(false)
  const [newSessionData, setNewSessionData] = useState({
    topic: "",
    strategyName: "",
    selectedParticipants: ['gemini', 'local-llm'] as string[]
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [currentSession?.messages])

  const loadData = async () => {
    try {
      // Load strategies and participants
      const strategiesResponse = await fetch('/api/conversational-mode/strategies')
      const strategiesData = await strategiesResponse.json()
      if (strategiesData.success) {
        setStrategies(strategiesData.data.strategies)
        setParticipants(strategiesData.data.participants)
      }

      // Load existing sessions
      const sessionsResponse = await fetch('/api/conversational-mode/sessions')
      const sessionsData = await sessionsResponse.json()
      if (sessionsData.success) {
        setSessions(sessionsData.data)
      }
    } catch (error) {
      console.error('Failed to load conversational mode data:', error)
      toast.error('Failed to load data')
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const createNewSession = async () => {
    if (!newSessionData.topic || !newSessionData.strategyName || newSessionData.selectedParticipants.length < 2) {
      toast.error('Please fill in all required fields and select at least 2 participants')
      return
    }

    try {
      setIsLoading(true)
      const response = await fetch('/api/conversational-mode/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: newSessionData.topic,
          strategyName: newSessionData.strategyName,
          participantIds: newSessionData.selectedParticipants
        })
      })

      const data = await response.json()
      if (data.success) {
        const newSession = data.data
        setSessions(prev => [...prev, newSession])
        setCurrentSession(newSession)
        setShowNewSessionDialog(false)
        setNewSessionData({ topic: "", strategyName: "", selectedParticipants: ['gemini', 'local-llm'] })
        onSessionCreated?.(newSession)
        toast.success('Collaboration session created!')
      } else {
        toast.error(data.error || 'Failed to create session')
      }
    } catch (error) {
      console.error('Failed to create session:', error)
      toast.error('Failed to create session')
    } finally {
      setIsLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!currentSession || !newMessage.trim()) return

    try {
      setIsLoading(true)
      const response = await fetch('/api/conversational-mode/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSession.id,
          content: newMessage
        })
      })

      const data = await response.json()
      if (data.success) {
        // Update the current session with new messages
        const updatedSession = {
          ...currentSession,
          messages: [...currentSession.messages, 
            {
              id: `user_${Date.now()}`,
              participantId: 'user',
              content: newMessage,
              timestamp: new Date(),
              type: 'user'
            },
            ...data.data
          ]
        }
        setCurrentSession(updatedSession)
        setSessions(prev => prev.map(s => s.id === currentSession.id ? updatedSession : s))
        setNewMessage("")
        toast.success('AI collaboration in progress...')
      } else {
        toast.error(data.error || 'Failed to send message')
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      toast.error('Failed to send message')
    } finally {
      setIsLoading(false)
    }
  }

  const pauseSession = async () => {
    if (!currentSession) return
    toast('Session paused')
  }

  const resumeSession = async () => {
    if (!currentSession) return
    toast('Session resumed')
  }

  const deleteSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/conversational-mode/sessions?sessionId=${sessionId}`, {
        method: 'DELETE'
      })

      const data = await response.json()
      if (data.success) {
        setSessions(prev => prev.filter(s => s.id !== sessionId))
        if (currentSession?.id === sessionId) {
          setCurrentSession(null)
        }
        toast.success('Session deleted')
      } else {
        toast.error(data.error || 'Failed to delete session')
      }
    } catch (error) {
      console.error('Failed to delete session:', error)
      toast.error('Failed to delete session')
    }
  }

  const getParticipantAvatar = (participant: ConversationParticipant) => {
    return participant.avatar || '🤖'
  }

  const getParticipantName = (participantId: string) => {
    const participant = participants.find(p => p.id === participantId)
    return participant?.name || participantId
  }

  const getStrategyDescription = (strategyName: string) => {
    const strategy = strategies.find(s => s.name === strategyName)
    return strategy?.description || ''
  }

  const handleParticipantToggle = (participantId: string) => {
    setNewSessionData(prev => ({
      ...prev,
      selectedParticipants: prev.selectedParticipants.includes(participantId)
        ? prev.selectedParticipants.filter(id => id !== participantId)
        : [...prev.selectedParticipants, participantId]
    }))
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Conversational Mode</h2>
          <Badge variant="secondary" className="ml-2">
            <Zap className="h-3 w-3 mr-1" />
            AI Collaboration
          </Badge>
        </div>
        <Button 
          onClick={() => setShowNewSessionDialog(true)}
          className="flex items-center space-x-2"
        >
          <MessageSquare className="h-4 w-4" />
          <span>New Session</span>
        </Button>
      </div>

      <div className="flex-1 flex space-x-4">
        {/* Sessions Sidebar */}
        <Card className="w-80 flex-shrink-0">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Sessions</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      currentSession?.id === session.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => setCurrentSession(session)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{session.topic}</h4>
                        <p className="text-sm text-muted-foreground truncate">
                          {getStrategyDescription(session.strategyName)}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {session.strategyName}
                          </Badge>
                          <Badge 
                            variant={session.status === 'active' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {session.status}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteSession(session.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {sessions.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No sessions yet</p>
                    <p className="text-sm">Create your first AI collaboration session</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Main Chat Area */}
        <Card className="flex-1 flex flex-col">
          {currentSession ? (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{currentSession.topic}</CardTitle>
                    <CardDescription>
                      {getStrategyDescription(currentSession.strategyName)} • {currentSession.participants.length} participants
                    </CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    {currentSession.status === 'active' ? (
                      <Button variant="outline" size="sm" onClick={pauseSession}>
                        <Pause className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={resumeSession}>
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col">
                {/* Messages */}
                <ScrollArea className="flex-1 pr-4">
                  <div className="space-y-4">
                    {currentSession.messages.map((message) => (
                      <div key={message.id} className="flex space-x-3">
                        {message.type === 'user' ? (
                          <div className="flex-1 flex justify-end">
                            <div className="bg-primary text-primary-foreground rounded-lg px-4 py-2 max-w-[80%]">
                              <p>{message.content}</p>
                              <p className="text-xs opacity-70 mt-1">
                                {new Date(message.timestamp).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1">
                            <div className="flex items-start space-x-2">
                              <div className="text-2xl">
                                {getParticipantAvatar(currentSession.participants.find(p => p.id === message.participantId)!)}
                              </div>
                              <div className="flex-1">
                                <div className="bg-muted rounded-lg px-4 py-2">
                                  <div className="flex items-center space-x-2 mb-2">
                                    <span className="font-medium">
                                      {getParticipantName(message.participantId)}
                                    </span>
                                    {message.metadata?.model && (
                                      <Badge variant="outline" className="text-xs">
                                        {message.metadata.model}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="whitespace-pre-wrap">{message.content}</p>
                                  <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                                    <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
                                    {message.metadata?.tokens && (
                                      <span>{message.metadata.tokens} tokens</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                <Separator className="my-4" />

                {/* Input */}
                <div className="flex space-x-2">
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message... (Press Enter to send)"
                    className="flex-1"
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        sendMessage()
                      }
                    }}
                  />
                  <Button 
                    onClick={sendMessage} 
                    disabled={!newMessage.trim() || isLoading}
                    className="self-end"
                  >
                    {isLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    ) : (
                      <MessageSquare className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Brain className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No Session Selected</h3>
                <p className="text-muted-foreground mb-4">
                  Choose a session from the sidebar or create a new one to start AI collaboration
                </p>
                <Button onClick={() => setShowNewSessionDialog(true)}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Create New Session
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* New Session Dialog */}
      {showNewSessionDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardHeader>
              <CardTitle>Create New Collaboration Session</CardTitle>
              <CardDescription>
                Start a conversation where multiple AIs can collaborate
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Topic</label>
                <Input
                  value={newSessionData.topic}
                  onChange={(e) => setNewSessionData(prev => ({ ...prev, topic: e.target.value }))}
                  placeholder="What would you like the AIs to discuss?"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Collaboration Strategy</label>
                <Select
                  value={newSessionData.strategyName}
                  onValueChange={(value) => setNewSessionData(prev => ({ ...prev, strategyName: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    {strategies.map((strategy) => (
                      <SelectItem key={strategy.name} value={strategy.name}>
                        <div>
                          <div className="font-medium">{strategy.name}</div>
                          <div className="text-xs text-muted-foreground">{strategy.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Select Participants</label>
                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                  {participants.map((participant) => (
                    <div
                      key={participant.id}
                      onClick={() => handleParticipantToggle(participant.id)}
                      className={`p-3 border rounded cursor-pointer transition-colors ${
                        newSessionData.selectedParticipants.includes(participant.id)
                          ? 'bg-blue-100 border-blue-300'
                          : 'bg-white border hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{getParticipantAvatar(participant)}</span>
                        <div>
                          <div className="font-medium">{participant.name}</div>
                          <div className="text-xs text-gray-600">{participant.type}</div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {participant.capabilities.slice(0, 2).join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-sm text-gray-600 mt-2">
                  Selected: {newSessionData.selectedParticipants.length} participants
                </div>
              </div>

              <div className="flex space-x-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setShowNewSessionDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={createNewSession}
                  disabled={!newSessionData.topic || !newSessionData.strategyName || newSessionData.selectedParticipants.length < 2 || isLoading}
                  className="flex-1"
                >
                  {isLoading ? 'Creating...' : 'Create Session'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
} 