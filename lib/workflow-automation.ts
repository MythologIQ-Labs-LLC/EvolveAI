export interface WorkflowTrigger {
  id: string;
  type: 'schedule' | 'webhook' | 'email' | 'manual';
  name: string;
  description: string;
  config: Record<string, any>;
  enabled: boolean;
}

export interface WorkflowAction {
  id: string;
  type: 'send_email' | 'create_document' | 'update_calendar' | 'api_call' | 'notification' | 'delay';
  name: string;
  description: string;
  config: Record<string, any>;
  position: { x: number; y: number };
  connections: string[];
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  version: string;
  triggers: WorkflowTrigger[];
  actions: WorkflowAction[];
  isActive: boolean;
  isTemplate: boolean;
  category: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  lastRun?: Date;
  runCount: number;
  successCount: number;
  errorCount: number;
  averageExecutionTime: number;
  createdBy: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  trigger: WorkflowTrigger;
  input: Record<string, any>;
  output: Record<string, any>;
  logs: WorkflowLog[];
  error?: string;
  variables: Record<string, any>;
}

export interface WorkflowLog {
  id: string;
  executionId: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  actionId?: string;
  data?: any;
}

// Pre-built action templates
export const ACTION_TEMPLATES = {
  sendEmail: {
    type: 'send_email',
    name: 'Send Email',
    description: 'Send an email using Gmail API',
    config: {
      to: '',
      subject: '',
      body: ''
    }
  },
  createDocument: {
    type: 'create_document',
    name: 'Create Google Doc',
    description: 'Create a new Google Document',
    config: {
      title: '',
      content: '',
      folderId: ''
    }
  },
  updateCalendar: {
    type: 'update_calendar',
    name: 'Create Calendar Event',
    description: 'Create or update Google Calendar event',
    config: {
      summary: '',
      description: '',
      startTime: '',
      endTime: '',
      attendees: []
    }
  },
  apiCall: {
    type: 'api_call',
    name: 'API Call',
    description: 'Make an HTTP request to any API',
    config: {
      method: 'GET',
      url: '',
      headers: {},
      body: ''
    }
  },
  notification: {
    type: 'notification',
    name: 'Send Notification',
    description: 'Send a notification to the user',
    config: {
      title: '',
      message: '',
      type: 'info'
    }
  },
  delay: {
    type: 'delay',
    name: 'Delay',
    description: 'Wait for a specified time',
    config: {
      duration: 1000,
      unit: 'milliseconds'
    }
  }
};

// Pre-built trigger templates
export const TRIGGER_TEMPLATES = {
  schedule: {
    type: 'schedule',
    name: 'Scheduled Trigger',
    description: 'Trigger workflow at specific times',
    config: {
      cronExpression: '',
      timezone: 'UTC'
    }
  },
  webhook: {
    type: 'webhook',
    name: 'Webhook Trigger',
    description: 'Trigger workflow via HTTP webhook',
    config: {
      method: 'POST',
      path: '',
      secret: ''
    }
  },
  email: {
    type: 'email',
    name: 'Email Trigger',
    description: 'Trigger workflow when email is received',
    config: {
      from: '',
      subject: '',
      bodyContains: ''
    }
  },
  manual: {
    type: 'manual',
    name: 'Manual Trigger',
    description: 'Trigger workflow manually',
    config: {
      requiresConfirmation: false
    }
  }
};

class WorkflowAutomationManager {
  private workflows: Map<string, Workflow> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();
  private readonly STORAGE_KEY = 'evolveai-workflows';
  private readonly EXECUTIONS_STORAGE_KEY = 'evolveai-workflow-executions';

  constructor() {
    this.loadWorkflows();
    this.loadExecutions();
  }

  private loadWorkflows(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const workflows = JSON.parse(stored);
        workflows.forEach((workflow: any) => {
          workflow.createdAt = new Date(workflow.createdAt);
          workflow.updatedAt = new Date(workflow.updatedAt);
          if (workflow.lastRun) {
            workflow.lastRun = new Date(workflow.lastRun);
          }
          this.workflows.set(workflow.id, workflow);
        });
      }
    } catch (error) {
      console.error('Failed to load workflows:', error);
    }
  }

  private saveWorkflows(): void {
    try {
      const workflows = Array.from(this.workflows.values());
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(workflows));
    } catch (error) {
      console.error('Failed to save workflows:', error);
    }
  }

  private loadExecutions(): void {
    try {
      const stored = localStorage.getItem(this.EXECUTIONS_STORAGE_KEY);
      if (stored) {
        const executions = JSON.parse(stored);
        executions.forEach((execution: any) => {
          execution.startedAt = new Date(execution.startedAt);
          if (execution.completedAt) {
            execution.completedAt = new Date(execution.completedAt);
          }
          execution.logs.forEach((log: any) => {
            log.timestamp = new Date(log.timestamp);
          });
          this.executions.set(execution.id, execution);
        });
      }
    } catch (error) {
      console.error('Failed to load workflow executions:', error);
    }
  }

  private saveExecutions(): void {
    try {
      const executions = Array.from(this.executions.values());
      localStorage.setItem(this.EXECUTIONS_STORAGE_KEY, JSON.stringify(executions));
    } catch (error) {
      console.error('Failed to save workflow executions:', error);
    }
  }

  async createWorkflow(config: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt' | 'runCount' | 'successCount' | 'errorCount' | 'averageExecutionTime'>): Promise<Workflow> {
    const workflow: Workflow = {
      ...config,
      id: `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      runCount: 0,
      successCount: 0,
      errorCount: 0,
      averageExecutionTime: 0
    };

    this.workflows.set(workflow.id, workflow);
    this.saveWorkflows();
    return workflow;
  }

  async updateWorkflow(id: string, updates: Partial<Workflow>): Promise<Workflow> {
    const workflow = this.workflows.get(id);
    if (!workflow) {
      throw new Error(`Workflow not found: ${id}`);
    }

    const updatedWorkflow = {
      ...workflow,
      ...updates,
      updatedAt: new Date()
    };

    this.workflows.set(id, updatedWorkflow);
    this.saveWorkflows();
    return updatedWorkflow;
  }

  deleteWorkflow(id: string): void {
    this.workflows.delete(id);
    this.saveWorkflows();
  }

  getWorkflow(id: string): Workflow | undefined {
    return this.workflows.get(id);
  }

  getAllWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  getActiveWorkflows(): Workflow[] {
    return Array.from(this.workflows.values()).filter(w => w.isActive);
  }

  getWorkflowsByCategory(category: string): Workflow[] {
    return Array.from(this.workflows.values()).filter(w => w.category === category);
  }

  getTemplateWorkflows(): Workflow[] {
    return Array.from(this.workflows.values()).filter(w => w.isTemplate);
  }

  async executeWorkflow(workflowId: string, trigger: WorkflowTrigger, input: Record<string, any> = {}): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    if (!workflow.isActive) {
      throw new Error(`Workflow is not active: ${workflowId}`);
    }

    const execution: WorkflowExecution = {
      id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      workflowId,
      status: 'running',
      startedAt: new Date(),
      trigger,
      input,
      output: {},
      logs: [],
      variables: {}
    };

    this.executions.set(execution.id, execution);
    this.saveExecutions();

    try {
      const result = await this.executeWorkflowLogic(workflow, execution);
      
      execution.status = 'completed';
      execution.completedAt = new Date();
      execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();
      execution.output = result;

      workflow.runCount++;
      workflow.successCount++;
      workflow.lastRun = new Date();
      workflow.averageExecutionTime = (workflow.averageExecutionTime * (workflow.runCount - 1) + execution.duration) / workflow.runCount;
      
      this.workflows.set(workflowId, workflow);
      this.saveWorkflows();

    } catch (error) {
      execution.status = 'failed';
      execution.completedAt = new Date();
      execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();
      execution.error = error instanceof Error ? error.message : 'Unknown error';

      workflow.runCount++;
      workflow.errorCount++;
      workflow.lastRun = new Date();

      this.workflows.set(workflowId, workflow);
      this.saveWorkflows();
    }

    this.executions.set(execution.id, execution);
    this.saveExecutions();

    return execution;
  }

  private async executeWorkflowLogic(workflow: Workflow, execution: WorkflowExecution): Promise<Record<string, any>> {
    const variables = { ...execution.input };
    const output: Record<string, any> = {};

    for (const action of workflow.actions) {
      try {
        const result = await this.executeAction(action, variables);
        variables[`action_${action.id}`] = result;
        output[action.id] = result;

        execution.logs.push({
          id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          executionId: execution.id,
          timestamp: new Date(),
          level: 'info',
          message: `Executed action: ${action.name}`,
          actionId: action.id,
          data: result
        });

      } catch (error) {
        execution.logs.push({
          id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          executionId: execution.id,
          timestamp: new Date(),
          level: 'error',
          message: `Failed to execute action: ${action.name}`,
          actionId: action.id,
          data: error instanceof Error ? error.message : 'Unknown error'
        });

        throw error;
      }
    }

    execution.variables = variables;
    return output;
  }

  private async executeAction(action: WorkflowAction, variables: Record<string, any>): Promise<any> {
    switch (action.type) {
      case 'send_email':
        return await this.executeSendEmail(action, variables);
      case 'create_document':
        return await this.executeCreateDocument(action, variables);
      case 'update_calendar':
        return await this.executeUpdateCalendar(action, variables);
      case 'api_call':
        return await this.executeApiCall(action, variables);
      case 'notification':
        return await this.executeNotification(action, variables);
      case 'delay':
        return await this.executeDelay(action, variables);
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private async executeSendEmail(action: WorkflowAction, variables: Record<string, any>): Promise<any> {
    const { to, subject, body } = action.config;
    
    const response = await fetch('/api/google/gmail/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, body })
    });

    if (!response.ok) {
      throw new Error('Failed to send email');
    }

    return await response.json();
  }

  private async executeCreateDocument(action: WorkflowAction, variables: Record<string, any>): Promise<any> {
    const { title, content, folderId } = action.config;
    
    const response = await fetch('/api/google/drive/create-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, folderId })
    });

    if (!response.ok) {
      throw new Error('Failed to create document');
    }

    return await response.json();
  }

  private async executeUpdateCalendar(action: WorkflowAction, variables: Record<string, any>): Promise<any> {
    const { summary, description, startTime, endTime, attendees } = action.config;
    
    const response = await fetch('/api/google/calendar/create-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary, description, startTime, endTime, attendees })
    });

    if (!response.ok) {
      throw new Error('Failed to create calendar event');
    }

    return await response.json();
  }

  private async executeApiCall(action: WorkflowAction, variables: Record<string, any>): Promise<any> {
    const { method, url, headers, body } = action.config;
    
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.statusText}`);
    }

    return await response.json();
  }

  private async executeNotification(action: WorkflowAction, variables: Record<string, any>): Promise<any> {
    const { title, message, type } = action.config;
    
    return { success: true, message: 'Notification sent' };
  }

  private async executeDelay(action: WorkflowAction, variables: Record<string, any>): Promise<any> {
    const { duration, unit } = action.config;
    
    let delayMs = duration;
    if (unit === 'seconds') delayMs *= 1000;
    if (unit === 'minutes') delayMs *= 60000;
    if (unit === 'hours') delayMs *= 3600000;
    
    await new Promise(resolve => setTimeout(resolve, delayMs));
    return { success: true, message: `Delayed for ${duration} ${unit}` };
  }

  getExecution(id: string): WorkflowExecution | undefined {
    return this.executions.get(id);
  }

  getWorkflowExecutions(workflowId: string, limit: number = 50): WorkflowExecution[] {
    return Array.from(this.executions.values())
      .filter(e => e.workflowId === workflowId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit);
  }

  getAllExecutions(limit: number = 100): WorkflowExecution[] {
    return Array.from(this.executions.values())
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit);
  }

  getWorkflowAnalytics(workflowId: string): {
    totalRuns: number;
    successRate: number;
    averageExecutionTime: number;
    lastRun?: Date;
    recentExecutions: WorkflowExecution[];
  } {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const executions = this.getWorkflowExecutions(workflowId, 10);

    return {
      totalRuns: workflow.runCount,
      successRate: workflow.runCount > 0 ? (workflow.successCount / workflow.runCount) * 100 : 0,
      averageExecutionTime: workflow.averageExecutionTime,
      lastRun: workflow.lastRun,
      recentExecutions: executions
    };
  }
}

// Singleton instance
export const workflowAutomationManager = new WorkflowAutomationManager(); 