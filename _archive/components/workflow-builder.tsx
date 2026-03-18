"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  Play, 
  Pause, 
  Save, 
  Plus, 
  Trash2, 
  Settings, 
  Clock, 
  Mail, 
  FileText, 
  Calendar,
  Globe,
  Bell,
  Timer,
  Zap,
  Workflow,
  Eye
} from 'lucide-react'
import { 
  Workflow as WorkflowType, 
  WorkflowAction, 
  WorkflowTrigger, 
  ACTION_TEMPLATES, 
  TRIGGER_TEMPLATES,
  workflowAutomationManager 
} from '@/lib/workflow-automation'

interface WorkflowBuilderProps {
  workflowId?: string;
  onWorkflowSaved?: (workflow: WorkflowType) => void;
}

export default function WorkflowBuilder({ workflowId, onWorkflowSaved }: WorkflowBuilderProps) {
  const [workflow, setWorkflow] = useState<WorkflowType | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedAction, setSelectedAction] = useState<WorkflowAction | null>(null)
  const [selectedTrigger, setSelectedTrigger] = useState<WorkflowTrigger | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)

  useEffect(() => {
    if (workflowId) {
      const existingWorkflow = workflowAutomationManager.getWorkflow(workflowId)
      if (existingWorkflow) {
        setWorkflow(existingWorkflow)
      }
    } else {
      const newWorkflow: WorkflowType = {
        id: '',
        name: 'New Workflow',
        description: '',
        version: '1.0.0',
        triggers: [],
        actions: [],
        isActive: false,
        isTemplate: false,
        category: 'General',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        runCount: 0,
        successCount: 0,
        errorCount: 0,
        averageExecutionTime: 0,
        createdBy: 'user'
      }
      setWorkflow(newWorkflow)
    }
  }, [workflowId])

  const handleSaveWorkflow = async () => {
    if (!workflow) return

    try {
      let savedWorkflow: WorkflowType
      
      if (workflow.id) {
        savedWorkflow = await workflowAutomationManager.updateWorkflow(workflow.id, workflow)
      } else {
        savedWorkflow = await workflowAutomationManager.createWorkflow(workflow)
      }

      setWorkflow(savedWorkflow)
      onWorkflowSaved?.(savedWorkflow)
    } catch (error) {
      console.error('Failed to save workflow:', error)
    }
  }

  const handleAddTrigger = (triggerType: string) => {
    if (!workflow) return

    const template = TRIGGER_TEMPLATES[triggerType as keyof typeof TRIGGER_TEMPLATES]
    if (!template) return

    const newTrigger: WorkflowTrigger = {
      id: `trigger_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: template.type as 'schedule' | 'webhook' | 'email' | 'manual',
      name: template.name,
      description: template.description,
      config: { ...template.config },
      enabled: true
    }

    setWorkflow({
      ...workflow,
      triggers: [...workflow.triggers, newTrigger]
    })
  }

  const handleAddAction = (actionType: string) => {
    if (!workflow) return

    const template = ACTION_TEMPLATES[actionType as keyof typeof ACTION_TEMPLATES]
    if (!template) return

    const newAction: WorkflowAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: template.type as 'send_email' | 'create_document' | 'update_calendar' | 'api_call' | 'notification' | 'delay',
      name: template.name,
      description: template.description,
      config: { ...template.config },
      position: { x: 100, y: 100 + workflow.actions.length * 120 },
      connections: []
    }

    setWorkflow({
      ...workflow,
      actions: [...workflow.actions, newAction]
    })
  }

  const handleUpdateAction = (actionId: string, updates: Partial<WorkflowAction>) => {
    if (!workflow) return

    setWorkflow({
      ...workflow,
      actions: workflow.actions.map(action =>
        action.id === actionId ? { ...action, ...updates } : action
      )
    })
  }

  const handleDeleteAction = (actionId: string) => {
    if (!workflow) return

    setWorkflow({
      ...workflow,
      actions: workflow.actions.filter(action => action.id !== actionId)
    })
  }

  const handleExecuteWorkflow = async () => {
    if (!workflow || workflow.triggers.length === 0) return

    setIsExecuting(true)
    try {
      const trigger = workflow.triggers[0]
      await workflowAutomationManager.executeWorkflow(workflow.id, trigger, {})
    } catch (error) {
      console.error('Failed to execute workflow:', error)
    } finally {
      setIsExecuting(false)
    }
  }

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'send_email': return <Mail className="h-4 w-4" />
      case 'create_document': return <FileText className="h-4 w-4" />
      case 'update_calendar': return <Calendar className="h-4 w-4" />
      case 'api_call': return <Globe className="h-4 w-4" />
      case 'notification': return <Bell className="h-4 w-4" />
      case 'delay': return <Timer className="h-4 w-4" />
      default: return <Zap className="h-4 w-4" />
    }
  }

  const getTriggerIcon = (type: string) => {
    switch (type) {
      case 'schedule': return <Clock className="h-4 w-4" />
      case 'webhook': return <Globe className="h-4 w-4" />
      case 'email': return <Mail className="h-4 w-4" />
      case 'manual': return <Play className="h-4 w-4" />
      default: return <Zap className="h-4 w-4" />
    }
  }

  if (!workflow) {
    return <div>Loading workflow...</div>
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Workflow className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Workflow Builder</h2>
          <Badge variant={workflow.isActive ? "default" : "secondary"}>
            {workflow.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center space-x-2"
          >
            <Settings className="h-4 w-4" />
            <span>{isEditing ? "View" : "Edit"}</span>
          </Button>
          <Button
            onClick={handleExecuteWorkflow}
            disabled={isExecuting || workflow.triggers.length === 0}
            className="flex items-center space-x-2"
          >
            {isExecuting ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            <span>{isExecuting ? "Running..." : "Run"}</span>
          </Button>
          <Button
            onClick={handleSaveWorkflow}
            className="flex items-center space-x-2"
          >
            <Save className="h-4 w-4" />
            <span>Save</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 flex space-x-4">
        {/* Sidebar */}
        <Card className="w-80 flex-shrink-0">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Plus className="h-5 w-5" />
              <span>Components</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="triggers">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="triggers">Triggers</TabsTrigger>
                <TabsTrigger value="actions">Actions</TabsTrigger>
              </TabsList>
              
              <TabsContent value="triggers" className="space-y-2">
                <ScrollArea className="h-64">
                  {Object.entries(TRIGGER_TEMPLATES).map(([key, template]) => (
                    <div
                      key={key}
                      className="p-3 border rounded-lg cursor-pointer hover:border-primary transition-colors mb-2"
                      onClick={() => handleAddTrigger(key)}
                    >
                      <div className="flex items-center space-x-2">
                        {getTriggerIcon(template.type)}
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{template.name}</h4>
                          <p className="text-xs text-muted-foreground">{template.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="actions" className="space-y-2">
                <ScrollArea className="h-64">
                  {Object.entries(ACTION_TEMPLATES).map(([key, template]) => (
                    <div
                      key={key}
                      className="p-3 border rounded-lg cursor-pointer hover:border-primary transition-colors mb-2"
                      onClick={() => handleAddAction(key)}
                    >
                      <div className="flex items-center space-x-2">
                        {getActionIcon(template.type)}
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{template.name}</h4>
                          <p className="text-xs text-muted-foreground">{template.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Main Canvas */}
        <Card className="flex-1 flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{workflow.name}</CardTitle>
                <CardDescription>{workflow.description || "No description"}</CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline">{workflow.category}</Badge>
                <Badge variant="outline">v{workflow.version}</Badge>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="flex-1">
            <div className="space-y-6">
              {/* Triggers Section */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center space-x-2">
                  <Zap className="h-5 w-5" />
                  <span>Triggers</span>
                </h3>
                <div className="space-y-2">
                  {workflow.triggers.map((trigger) => (
                    <div
                      key={trigger.id}
                      className="p-4 border rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {getTriggerIcon(trigger.type)}
                          <div>
                            <h4 className="font-medium">{trigger.name}</h4>
                            <p className="text-sm text-muted-foreground">{trigger.description}</p>
                          </div>
                        </div>
                        <Badge variant={trigger.enabled ? "default" : "secondary"}>
                          {trigger.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {workflow.triggers.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No triggers added</p>
                      <p className="text-sm">Add a trigger to start your workflow</p>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Actions Section */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center space-x-2">
                  <Workflow className="h-5 w-5" />
                  <span>Actions</span>
                </h3>
                <div className="space-y-2">
                  {workflow.actions.map((action, index) => (
                    <div
                      key={action.id}
                      className="p-4 border rounded-lg hover:border-primary transition-colors cursor-pointer"
                      onClick={() => setSelectedAction(action)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {getActionIcon(action.type)}
                          <div>
                            <h4 className="font-medium">{action.name}</h4>
                            <p className="text-sm text-muted-foreground">{action.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">#{index + 1}</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteAction(action.id)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {workflow.actions.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      <Workflow className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No actions added</p>
                      <p className="text-sm">Add actions to define what your workflow does</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Properties Panel */}
        {selectedAction && (
          <Card className="w-80 flex-shrink-0">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Properties</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedAction(null)}
                >
                  ×
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="action-name">Name</Label>
                    <Input
                      id="action-name"
                      value={selectedAction.name}
                      onChange={(e) => handleUpdateAction(selectedAction.id, { name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="action-description">Description</Label>
                    <Input
                      id="action-description"
                      value={selectedAction.description}
                      onChange={(e) => handleUpdateAction(selectedAction.id, { description: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Configuration</Label>
                    <div className="space-y-2 mt-2">
                      {Object.entries(selectedAction.config).map(([key, value]) => (
                        <div key={key}>
                          <Label htmlFor={`config-${key}`} className="text-sm">{key}</Label>
                          <Input
                            id={`config-${key}`}
                            value={value as string}
                            onChange={(e) => handleUpdateAction(selectedAction.id, {
                              config: { ...selectedAction.config, [key]: e.target.value }
                            })}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
} 