"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Plus, 
  Play, 
  Pause, 
  Settings, 
  Trash2, 
  Copy, 
  Download, 
  Upload,
  Workflow,
  Clock,
  Mail,
  Globe,
  Zap,
  Eye,
  Edit,
  BarChart3
} from 'lucide-react'
import { 
  Workflow as WorkflowType, 
  workflowAutomationManager 
} from '@/lib/workflow-automation'
import WorkflowBuilder from '@/components/workflow-builder'

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowType[]>([])
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowType | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid')

  useEffect(() => {
    loadWorkflows()
  }, [])

  const loadWorkflows = () => {
    const allWorkflows = workflowAutomationManager.getAllWorkflows()
    setWorkflows(allWorkflows)
  }

  const handleCreateWorkflow = () => {
    setIsCreating(true)
    setSelectedWorkflow(null)
  }

  const handleEditWorkflow = (workflow: WorkflowType) => {
    setSelectedWorkflow(workflow)
    setIsCreating(false)
  }

  const handleWorkflowSaved = (workflow: WorkflowType) => {
    loadWorkflows()
    setIsCreating(false)
    setSelectedWorkflow(null)
  }

  const handleDeleteWorkflow = (workflowId: string) => {
    if (confirm('Are you sure you want to delete this workflow?')) {
      workflowAutomationManager.deleteWorkflow(workflowId)
      loadWorkflows()
    }
  }

  const handleToggleWorkflow = async (workflow: WorkflowType) => {
    try {
      await workflowAutomationManager.updateWorkflow(workflow.id, {
        isActive: !workflow.isActive
      })
      loadWorkflows()
    } catch (error) {
      console.error('Failed to toggle workflow:', error)
    }
  }

  const handleExecuteWorkflow = async (workflow: WorkflowType) => {
    if (workflow.triggers.length === 0) {
      alert('No triggers configured for this workflow')
      return
    }

    try {
      const trigger = workflow.triggers[0]
      await workflowAutomationManager.executeWorkflow(workflow.id, trigger, {})
      loadWorkflows()
    } catch (error) {
      console.error('Failed to execute workflow:', error)
    }
  }

  const getWorkflowIcon = (workflow: WorkflowType) => {
    if (workflow.triggers.length > 0) {
      const triggerType = workflow.triggers[0].type
      switch (triggerType) {
        case 'schedule': return <Clock className="h-5 w-5" />
        case 'email': return <Mail className="h-5 w-5" />
        case 'webhook': return <Globe className="h-5 w-5" />
        case 'manual': return <Zap className="h-5 w-5" />
        default: return <Workflow className="h-5 w-5" />
      }
    }
    return <Workflow className="h-5 w-5" />
  }

  const getStatusColor = (workflow: WorkflowType) => {
    if (!workflow.isActive) return 'secondary'
    if (workflow.errorCount > 0 && workflow.runCount > 0) return 'destructive'
    if (workflow.successCount > 0) return 'default'
    return 'outline'
  }

  const getStatusText = (workflow: WorkflowType) => {
    if (!workflow.isActive) return 'Inactive'
    if (workflow.errorCount > 0 && workflow.runCount > 0) return 'Error'
    if (workflow.successCount > 0) return 'Active'
    return 'Ready'
  }

  const filteredWorkflows = workflows.filter(workflow => {
    const matchesSearch = workflow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         workflow.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || workflow.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const categories = Array.from(new Set(workflows.map(w => w.category)))

  if (isCreating || selectedWorkflow) {
    return (
      <div className="h-full">
        <WorkflowBuilder 
          workflowId={selectedWorkflow?.id}
          onWorkflowSaved={handleWorkflowSaved}
        />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Workflow className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Workflows</h1>
          <Badge variant="outline">{workflows.length} total</Badge>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          >
            {viewMode === 'grid' ? 'List View' : 'Grid View'}
          </Button>
          <Button onClick={handleCreateWorkflow} className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>New Workflow</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="flex-1">
          <Input
            placeholder="Search workflows..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Label htmlFor="category-filter">Category:</Label>
          <select
            id="category-filter"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="all">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Workflows */}
      <Tabs defaultValue="all" className="flex-1 flex flex-col">
        <TabsList>
          <TabsTrigger value="all">All Workflows</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="flex-1">
          <ScrollArea className="h-full">
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                {filteredWorkflows.map((workflow) => (
                  <Card key={workflow.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {getWorkflowIcon(workflow)}
                          <div>
                            <CardTitle className="text-lg">{workflow.name}</CardTitle>
                            <CardDescription>{workflow.description}</CardDescription>
                          </div>
                        </div>
                        <Badge variant={getStatusColor(workflow)}>
                          {getStatusText(workflow)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span>Category:</span>
                          <Badge variant="outline">{workflow.category}</Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Runs:</span>
                          <span>{workflow.runCount}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Success Rate:</span>
                          <span>
                            {workflow.runCount > 0 
                              ? `${((workflow.successCount / workflow.runCount) * 100).toFixed(1)}%`
                              : 'N/A'
                            }
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Last Run:</span>
                          <span>
                            {workflow.lastRun 
                              ? new Date(workflow.lastRun).toLocaleDateString()
                              : 'Never'
                            }
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditWorkflow(workflow)}
                            className="flex-1"
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleWorkflow(workflow)}
                            className="flex-1"
                          >
                            {workflow.isActive ? (
                              <>
                                <Pause className="h-4 w-4 mr-1" />
                                Pause
                              </>
                            ) : (
                              <>
                                <Play className="h-4 w-4 mr-1" />
                                Activate
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleExecuteWorkflow(workflow)}
                            disabled={!workflow.isActive || workflow.triggers.length === 0}
                          >
                            <Zap className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteWorkflow(workflow.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-2 p-4">
                {filteredWorkflows.map((workflow) => (
                  <Card key={workflow.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          {getWorkflowIcon(workflow)}
                          <div>
                            <h3 className="font-semibold">{workflow.name}</h3>
                            <p className="text-sm text-muted-foreground">{workflow.description}</p>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant="outline">{workflow.category}</Badge>
                              <Badge variant={getStatusColor(workflow)}>
                                {getStatusText(workflow)}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {workflow.runCount} runs
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditWorkflow(workflow)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleWorkflow(workflow)}
                          >
                            {workflow.isActive ? (
                              <>
                                <Pause className="h-4 w-4 mr-1" />
                                Pause
                              </>
                            ) : (
                              <>
                                <Play className="h-4 w-4 mr-1" />
                                Activate
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleExecuteWorkflow(workflow)}
                            disabled={!workflow.isActive || workflow.triggers.length === 0}
                          >
                            <Zap className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteWorkflow(workflow.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="active" className="flex-1">
          <ScrollArea className="h-full">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {filteredWorkflows.filter(w => w.isActive).map((workflow) => (
                <Card key={workflow.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getWorkflowIcon(workflow)}
                        <div>
                          <CardTitle className="text-lg">{workflow.name}</CardTitle>
                          <CardDescription>{workflow.description}</CardDescription>
                        </div>
                      </div>
                      <Badge variant="default">Active</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span>Category:</span>
                        <Badge variant="outline">{workflow.category}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Runs:</span>
                        <span>{workflow.runCount}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Success Rate:</span>
                        <span>
                          {workflow.runCount > 0 
                            ? `${((workflow.successCount / workflow.runCount) * 100).toFixed(1)}%`
                            : 'N/A'
                          }
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditWorkflow(workflow)}
                          className="flex-1"
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleExecuteWorkflow(workflow)}
                          disabled={workflow.triggers.length === 0}
                          className="flex-1"
                        >
                          <Zap className="h-4 w-4 mr-1" />
                          Run
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="templates" className="flex-1">
          <ScrollArea className="h-full">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {filteredWorkflows.filter(w => w.isTemplate).map((workflow) => (
                <Card key={workflow.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getWorkflowIcon(workflow)}
                        <div>
                          <CardTitle className="text-lg">{workflow.name}</CardTitle>
                          <CardDescription>{workflow.description}</CardDescription>
                        </div>
                      </div>
                      <Badge variant="secondary">Template</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span>Category:</span>
                        <Badge variant="outline">{workflow.category}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Uses:</span>
                        <span>{workflow.runCount}</span>
                      </div>
                      <div className="flex items-center space-x-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditWorkflow(workflow)}
                          className="flex-1"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Use Template
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {filteredWorkflows.length === 0 && (
        <div className="text-center text-muted-foreground py-12">
          <Workflow className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2">No workflows found</h3>
          <p className="mb-4">
            {searchTerm || selectedCategory !== 'all' 
              ? 'Try adjusting your search or filter criteria'
              : 'Get started by creating your first workflow'
            }
          </p>
          {!searchTerm && selectedCategory === 'all' && (
            <Button onClick={handleCreateWorkflow}>
              <Plus className="h-4 w-4 mr-2" />
              Create Workflow
            </Button>
          )}
        </div>
      )}
    </div>
  )
} 