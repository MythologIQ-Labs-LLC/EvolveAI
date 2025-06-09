"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { X } from "lucide-react"

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

interface Condition {
  id: string
  type: string
  operator: string
  value: string
}

interface EditRuleDialogProps {
  rule: RoutingRule | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaveRule: (ruleId: string, updates: Partial<RoutingRule>) => void
}

export function EditRuleDialog({ rule, open, onOpenChange, onSaveRule }: EditRuleDialogProps) {
  const [ruleName, setRuleName] = useState("")
  const [action, setAction] = useState("")
  const [priority, setPriority] = useState(5)
  const [enabled, setEnabled] = useState(true)
  const [conditions, setConditions] = useState<Condition[]>([])

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

  useEffect(() => {
    if (rule && open) {
      setRuleName(rule.name)
      setAction(rule.action)
      setPriority(rule.priority)
      setEnabled(rule.enabled)

      // Parse the condition string back into conditions array
      // This is a simplified parser - in a real app you'd want more robust parsing
      const conditionString = rule.condition
      if (conditionString === "TRUE") {
        setConditions([{ id: "1", type: "text_contains", operator: "AND", value: "TRUE" }])
      } else {
        // For demo purposes, create a single condition
        setConditions([{ id: "1", type: "text_contains", operator: "AND", value: conditionString }])
      }
    }
  }, [rule, open])

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
    if (!rule) return

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
          default:
            conditionText = condition.value
        }

        return prefix + conditionText
      })
      .join("")

    const updates = {
      name: ruleName,
      condition: conditionString,
      action,
      priority,
      enabled,
    }

    onSaveRule(rule.id, updates)
    onOpenChange(false)
  }

  const isFormValid = ruleName.trim() && action && conditions.every((c) => c.value.trim())

  if (!rule) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Routing Rule</DialogTitle>
          <DialogDescription>Modify the conditions and actions for this routing rule.</DialogDescription>
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
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Conditions</Label>
              <Button variant="outline" size="sm" onClick={addCondition}>
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
                    <Input
                      placeholder="Enter value..."
                      value={condition.value}
                      onChange={(e) => updateCondition(condition.id, "value", e.target.value)}
                    />
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
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Current Performance:</span>
                <div className="mt-1">
                  <div>Effectiveness: {rule.effectiveness}%</div>
                  <div>Matches: {rule.matches}</div>
                  <div>Successes: {rule.successes}</div>
                </div>
              </div>
              <div>
                <span className="font-medium">Last Activity:</span>
                <div className="mt-1">
                  <div>Created: {new Date(rule.created).toLocaleDateString()}</div>
                  <div>Last Triggered: {rule.lastTriggered || "Never"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isFormValid}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
