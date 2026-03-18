"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Plus, X } from "lucide-react"

interface Condition {
  id: string
  type: string
  operator: string
  value: string
}

interface RuleDialogProps {
  onAddRule: (rule: Omit<RoutingRule, "id">) => void
}

export interface RoutingRule {
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
}

export function RuleDialog({ onAddRule }: RuleDialogProps) {
  const [open, setOpen] = useState(false)
  const [ruleName, setRuleName] = useState("")
  const [action, setAction] = useState("")
  const [priority, setPriority] = useState(5)
  const [enabled, setEnabled] = useState(true)
  const [conditions, setConditions] = useState<Condition[]>([
    { id: "1", type: "text_contains", operator: "AND", value: "" },
  ])

  const conditionTypes = [
    { value: "text_contains", label: "Text Contains" },
    { value: "text_matches_regex", label: "Text Matches Regex" },
    { value: "request_type", label: "Request Type" },
    { value: "task_type", label: "Task Type" },
    { value: "data_size_kb", label: "Data Size (KB)" },
    { value: "estimated_cost", label: "Estimated Cost" },
    { value: "has_local_tool", label: "Has Local Tool" },
    { value: "has_google_api_access", label: "Has Google API Access" },
    { value: "source_application", label: "Source Application" },
    { value: "user_context_tags", label: "User Context Tags" },
  ]

  const actionTypes = [
    { value: "ROUTE_TO_AI_STUDIO", label: "Route to AI Studio" },
    { value: "ROUTE_TO_LOCAL_LLM", label: "Route to Local LLM" },
    { value: "USE_GMAIL_API", label: "Use Gmail API" },
    { value: "USE_GOOGLE_DRIVE_API", label: "Use Google Drive API" },
    { value: "USE_GOOGLE_CALENDAR_API", label: "Use Google Calendar API" },
    { value: "USE_GEMINI_API", label: "Use Gemini API" },
    { value: "USE_CLOUD_VISION_API", label: "Use Cloud Vision API" },
    { value: "USE_CLOUD_SPEECH_API", label: "Use Cloud Speech API" },
    { value: "USE_CLOUD_TRANSLATION_API", label: "Use Cloud Translation API" },
    { value: "USE_DOCUMENT_AI", label: "Use Document AI" },
    { value: "USE_VERTEX_AI", label: "Use Vertex AI" },
    { value: "EXECUTE_TOOL_IMMEDIATELY", label: "Execute Tool Immediately" },
    { value: "DISPLAY_ERROR_MESSAGE", label: "Display Error Message" },
    { value: "FALLBACK_TO_AI_STUDIO", label: "Fallback to AI Studio" },
    { value: "FALLBACK_TO_LOCAL_LLM", label: "Fallback to Local LLM" },
  ]

  const addCondition = () => {
    const newCondition: Condition = {
      id: Date.now().toString(),
      type: "text_contains",
      operator: "AND",
      value: "",
    }
    setConditions([...conditions, newCondition])
  }

  const removeCondition = (id: string) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter((c) => c.id !== id))
    }
  }

  const updateCondition = (id: string, field: keyof Condition, value: string) => {
    setConditions(conditions.map((c) => (c.id === id ? { ...c, [field]: value } : c)))
  }

  const handleSave = () => {
    const conditionString = conditions
      .map((condition, index) => {
        const prefix = index > 0 ? ` ${condition.operator} ` : ""
        let conditionText = ""

        switch (condition.type) {
          case "text_contains":
            conditionText = `text_contains "${condition.value}"`
            break
          case "text_matches_regex":
            conditionText = `text_matches_regex "${condition.value}"`
            break
          case "request_type":
            conditionText = `request_type is "${condition.value}"`
            break
          case "task_type":
            conditionText = `task_type is "${condition.value}"`
            break
          case "data_size_kb":
            conditionText = `data_size_kb ${condition.value}`
            break
          case "estimated_cost":
            conditionText = `estimated_cost ${condition.value}`
            break
          case "has_local_tool":
            conditionText = `has_local_tool ${condition.value}`
            break
          case "has_google_api_access":
            conditionText = `has_google_api_access ${condition.value}`
            break
          case "source_application":
            conditionText = `source_application "${condition.value}"`
            break
          case "user_context_tags":
            conditionText = `user_context_tags contains "${condition.value}"`
            break
          default:
            conditionText = condition.value
        }

        return prefix + conditionText
      })
      .join("")

    const newRule = {
      name: ruleName,
      condition: conditionString,
      action,
      priority,
      enabled,
      effectiveness: 0, // New rules start with 0% effectiveness
      matches: 0,
      successes: 0,
      created: new Date().toISOString(),
    }

    onAddRule(newRule)

    // Reset form
    setRuleName("")
    setAction("")
    setPriority(5)
    setEnabled(true)
    setConditions([{ id: "1", type: "text_contains", operator: "AND", value: "" }])
    setOpen(false)
  }

  const isFormValid = ruleName.trim() && action && conditions.every((c) => c.value.trim())

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          Add New Rule
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Routing Rule</DialogTitle>
          <DialogDescription>
            Define conditions and actions for intelligent request routing between AI Studio and Local LLM.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rule-name">Rule Name</Label>
              <Input
                id="rule-name"
                placeholder="e.g., Personal Data - Local Processing"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority (1-10)</Label>
              <Input
                id="priority"
                type="number"
                min="1"
                max="10"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Higher numbers = higher priority</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Conditions</Label>
              <Button variant="outline" size="sm" onClick={addCondition}>
                <Plus className="w-3 h-3 mr-1" />
                Add Condition
              </Button>
            </div>

            {conditions.map((condition, index) => (
              <div key={condition.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {index > 0 && (
                      <Select
                        value={condition.operator}
                        onValueChange={(value) => updateCondition(condition.id, "operator", value)}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AND">AND</SelectItem>
                          <SelectItem value="OR">OR</SelectItem>
                          <SelectItem value="NOT">NOT</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <Badge variant="outline">Condition {index + 1}</Badge>
                  </div>
                  {conditions.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeCondition(condition.id)}>
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Condition Type</Label>
                    <Select
                      value={condition.type}
                      onValueChange={(value) => updateCondition(condition.id, "type", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {conditionTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Value</Label>
                    {condition.type === "request_type" ? (
                      <Select
                        value={condition.value}
                        onValueChange={(value) => updateCondition(condition.id, "value", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="image">Image</SelectItem>
                          <SelectItem value="audio">Audio</SelectItem>
                          <SelectItem value="document">Document</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : condition.type === "has_local_tool" || condition.type === "has_google_api_access" ? (
                      <Select
                        value={condition.value}
                        onValueChange={(value) => updateCondition(condition.id, "value", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select option" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TRUE">True</SelectItem>
                          <SelectItem value="FALSE">False</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : condition.type === "data_size_kb" || condition.type === "estimated_cost" ? (
                      <Input
                        placeholder="e.g., > 100 or < 0.05"
                        value={condition.value}
                        onChange={(e) => updateCondition(condition.id, "value", e.target.value)}
                      />
                    ) : (
                      <Input
                        placeholder="Enter value..."
                        value={condition.value}
                        onChange={(e) => updateCondition(condition.id, "value", e.target.value)}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="action">Action</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger>
                <SelectValue placeholder="Select action" />
              </SelectTrigger>
              <SelectContent>
                {actionTypes.map((actionType) => (
                  <SelectItem key={actionType.value} value={actionType.value}>
                    {actionType.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            <Label>Enable this rule</Label>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <Label className="text-sm font-medium">Preview</Label>
            <div className="mt-2 text-sm text-muted-foreground">
              <strong>Rule:</strong> {ruleName || "Unnamed Rule"}
              <br />
              <strong>Conditions:</strong>{" "}
              {conditions
                .map((c, i) => `${i > 0 ? ` ${c.operator} ` : ""}${c.type}${c.value ? ` "${c.value}"` : ""}`)
                .join("") || "No conditions"}
              <br />
              <strong>Action:</strong> {action || "No action selected"}
              <br />
              <strong>Priority:</strong> {priority}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isFormValid}>
            Create Rule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
