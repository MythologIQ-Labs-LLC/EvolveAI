"use client"

import React, { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Bug, Plus, Send, AlertCircle, Lightbulb, Settings, FileText } from "lucide-react"
import { toast } from "react-hot-toast"

interface IssueReporterProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface IssueForm {
  type: "bug" | "feature" | "enhancement" | "question"
  title: string
  description: string
  steps: string
  expected: string
  actual: string
  systemInfo: string
  priority: "low" | "medium" | "high" | "critical"
  category: string
}

export function IssueReporter({ open, onOpenChange }: IssueReporterProps) {
  const [form, setForm] = useState<IssueForm>({
    type: "bug",
    title: "",
    description: "",
    steps: "",
    expected: "",
    actual: "",
    systemInfo: "",
    priority: "medium",
    category: "general"
  })

  const [isSubmitting, setIsSubmitting] = useState(false)

  const issueTypes = [
    { value: "bug", label: "Bug Report", icon: Bug, description: "Something isn't working" },
    { value: "feature", label: "Feature Request", icon: Plus, description: "Suggest a new feature" },
    { value: "enhancement", label: "Enhancement", icon: Lightbulb, description: "Improve existing functionality" },
    { value: "question", label: "Question", icon: FileText, description: "Ask a question" }
  ]

  const categories = [
    "general",
    "ui/ux",
    "performance",
    "api-integration",
    "local-llm",
    "google-workspace",
    "installation",
    "documentation"
  ]

  const priorities = [
    { value: "low", label: "Low", color: "bg-green-100 text-green-800" },
    { value: "medium", label: "Medium", color: "bg-yellow-100 text-yellow-800" },
    { value: "high", label: "High", color: "bg-orange-100 text-orange-800" },
    { value: "critical", label: "Critical", color: "bg-red-100 text-red-800" }
  ]

  const getSystemInfo = async () => {
    try {
      const response = await fetch('/api/system-info')
      const data = await response.json()
      return `OS: ${data.os}\nNode.js: ${data.nodeVersion}\nElectron: ${data.electronVersion}\nApp Version: ${data.appVersion}`
    } catch (error) {
      return "System info unavailable"
    }
  }

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error("Please fill in the title and description")
      return
    }

    setIsSubmitting(true)

    try {
      // Get system info if not provided
      if (!form.systemInfo) {
        form.systemInfo = await getSystemInfo()
      }

      // Create GitHub issue
      const issueData = {
        title: `[${form.type.toUpperCase()}] ${form.title}`,
        body: formatIssueBody(form),
        labels: [form.type, form.category, `priority-${form.priority}`]
      }

      const response = await fetch('/api/github/create-issue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(issueData),
      })

      if (response.ok) {
        const result = await response.json()
        toast.success("Issue submitted successfully!")
        console.log("Issue created:", result.html_url)
        
        // Reset form
        setForm({
          type: "bug",
          title: "",
          description: "",
          steps: "",
          expected: "",
          actual: "",
          systemInfo: "",
          priority: "medium",
          category: "general"
        })
        
        onOpenChange(false)
      } else {
        throw new Error("Failed to create issue")
      }
    } catch (error) {
      console.error("Error submitting issue:", error)
      toast.error("Failed to submit issue. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatIssueBody = (form: IssueForm) => {
    const selectedType = issueTypes.find(t => t.value === form.type)
    const selectedPriority = priorities.find(p => p.value === form.priority)

    return `## Issue Type
${selectedType?.label} - ${selectedType?.description}

## Priority
${selectedPriority?.label}

## Category
${form.category}

## Description
${form.description}

${form.steps ? `## Steps to Reproduce
${form.steps}` : ''}

${form.expected ? `## Expected Behavior
${form.expected}` : ''}

${form.actual ? `## Actual Behavior
${form.actual}` : ''}

## System Information
\`\`\`
${form.systemInfo}
\`\`\`

---
*This issue was submitted through the EvolveAI application.*`
  }

  const updateForm = (field: keyof IssueForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5" />
            <span>Report an Issue</span>
          </DialogTitle>
          <DialogDescription>
            Help us improve EvolveAI by reporting bugs or suggesting features
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Issue Type Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Issue Type</CardTitle>
              <CardDescription>What type of issue are you reporting?</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {issueTypes.map(type => (
                  <Button
                    key={type.value}
                    variant={form.type === type.value ? "default" : "outline"}
                    className="h-auto p-4 flex flex-col items-start space-y-2"
                    onClick={() => updateForm("type", type.value)}
                  >
                    <div className="flex items-center space-x-2">
                      <type.icon className="h-4 w-4" />
                      <span className="font-medium">{type.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{type.description}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Provide essential details about the issue</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="Brief description of the issue"
                  value={form.title}
                  onChange={(e) => updateForm("title", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Detailed description of the issue..."
                  value={form.description}
                  onChange={(e) => updateForm("description", e.target.value)}
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={form.category} onValueChange={(value) => updateForm("category", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(category => (
                        <SelectItem key={category} value={category}>
                          {category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={form.priority} onValueChange={(value) => updateForm("priority", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {priorities.map(priority => (
                        <SelectItem key={priority.value} value={priority.value}>
                          <div className="flex items-center space-x-2">
                            <Badge className={priority.color}>{priority.label}</Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional Details */}
          {(form.type === "bug" || form.type === "enhancement") && (
            <Card>
              <CardHeader>
                <CardTitle>Additional Details</CardTitle>
                <CardDescription>Help us understand and reproduce the issue</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="steps">Steps to Reproduce</Label>
                  <Textarea
                    id="steps"
                    placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."
                    value={form.steps}
                    onChange={(e) => updateForm("steps", e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expected">Expected Behavior</Label>
                    <Textarea
                      id="expected"
                      placeholder="What should happen?"
                      value={form.expected}
                      onChange={(e) => updateForm("expected", e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="actual">Actual Behavior</Label>
                    <Textarea
                      id="actual"
                      placeholder="What actually happens?"
                      value={form.actual}
                      onChange={(e) => updateForm("actual", e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* System Information */}
          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
              <CardDescription>Automatically collected system details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="systemInfo">System Details</Label>
                <Textarea
                  id="systemInfo"
                  placeholder="Loading system information..."
                  value={form.systemInfo}
                  onChange={(e) => updateForm("systemInfo", e.target.value)}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  This information helps us diagnose issues. You can edit it if needed.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Issue
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 