import { apiRateManager } from './api-rates';
import { customAPIManager } from './custom-api-manager';

export interface ConversationParticipant {
  id: string;
  name: string;
  type: 'gemini' | 'local-llm' | 'custom-ai';
  avatar?: string;
  capabilities: string[];
  personality: string;
  isActive: boolean;
  customAgentId?: string; // For custom AI agents
}

export interface ConversationMessage {
  id: string;
  participantId: string;
  content: string;
  timestamp: Date;
  type: 'user' | 'ai' | 'system' | 'collaboration';
  metadata?: {
    model?: string;
    tokens?: number;
    confidence?: number;
    reasoning?: string;
    collaboration?: {
      participants: string[];
      strategy: string;
    };
  };
}

export interface CollaborationSession {
  id: string;
  participants: ConversationParticipant[];
  messages: ConversationMessage[];
  topic: string;
  strategyName: string;
  mode: 'parallel' | 'sequential' | 'debate' | 'brainstorm' | 'round-robin' | 'expert-panel';
  status: 'active' | 'paused' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

export interface CollaborationStrategy {
  name: string;
  description: string;
  participantRoles: Record<string, string>;
  interactionPattern: 'parallel' | 'sequential' | 'debate' | 'brainstorm' | 'round-robin' | 'expert-panel';
  prompts: {
    system: string;
    user: string;
    collaboration: string;
  };
}

class ConversationalModeManager {
  private sessions: Map<string, CollaborationSession> = new Map();
  private participants: ConversationParticipant[] = [
    {
      id: 'gemini',
      name: 'Gemini',
      type: 'gemini',
      avatar: '🤖',
      capabilities: ['Advanced reasoning', 'Real-time knowledge', 'Multi-modal', 'Fast response'],
      personality: 'Analytical, knowledgeable, and efficient. Excels at complex problem-solving and up-to-date information.',
      isActive: true
    },
    {
      id: 'local-llm',
      name: 'Local AI',
      type: 'local-llm',
      avatar: '🏠',
      capabilities: ['Privacy-focused', 'Offline operation', 'Custom training', 'Deep analysis'],
      personality: 'Privacy-conscious, thorough, and methodical. Prefers deep analysis and maintains user confidentiality.',
      isActive: true
    }
  ];

  private strategies: CollaborationStrategy[] = [
    {
      name: 'Brainstorming',
      description: 'All AIs generate ideas and build upon each other',
      participantRoles: {
        gemini: 'Idea generator with broad knowledge',
        'local-llm': 'Critical evaluator and refinement specialist',
        'custom-ai': 'Specialized domain expert'
      },
      interactionPattern: 'parallel',
      prompts: {
        system: 'You are participating in a collaborative brainstorming session. Generate creative ideas and build upon suggestions from your AI partners.',
        user: 'Let\'s brainstorm about: {topic}',
        collaboration: 'My AI partners suggested: {partner_ideas}. I think we could enhance this by: {enhancement}'
      }
    },
    {
      name: 'Debate',
      description: 'AIs take different viewpoints and debate the topic',
      participantRoles: {
        gemini: 'Proponent of the main argument',
        'local-llm': 'Critical challenger and counter-argument provider',
        'custom-ai': 'Specialized perspective provider'
      },
      interactionPattern: 'debate',
      prompts: {
        system: 'You are participating in a structured debate. Present your viewpoint clearly and respond to your opponents\' arguments.',
        user: 'Let\'s debate: {topic}',
        collaboration: 'My opponents argued: {opponent_arguments}. My counter-argument is: {counter_argument}'
      }
    },
    {
      name: 'Sequential Analysis',
      description: 'AIs work in sequence, each building on the previous analysis',
      participantRoles: {
        gemini: 'Initial analysis and framework provider',
        'local-llm': 'Deep dive specialist and implementation planner',
        'custom-ai': 'Specialized domain analysis'
      },
      interactionPattern: 'sequential',
      prompts: {
        system: 'You are part of a sequential analysis team. Build upon the previous analysis and add your specialized insights.',
        user: 'Let\'s analyze: {topic}',
        collaboration: 'Based on the previous analysis: {previous_analysis}, I will now: {next_step}'
      }
    },
    {
      name: 'Parallel Processing',
      description: 'AIs work simultaneously on different aspects of the problem',
      participantRoles: {
        gemini: 'High-level strategy and overview specialist',
        'local-llm': 'Detailed implementation and technical specialist',
        'custom-ai': 'Specialized domain expert'
      },
      interactionPattern: 'parallel',
      prompts: {
        system: 'You are working in parallel with other AIs. Focus on your specialized area while coordinating with your partners.',
        user: 'Let\'s work on: {topic}',
        collaboration: 'I\'m focusing on: {my_focus}. My partners are working on: {partner_focus}. Together we can: {combined_approach}'
      }
    },
    {
      name: 'Round Robin',
      description: 'Each AI takes turns contributing to the discussion',
      participantRoles: {
        gemini: 'General knowledge and synthesis expert',
        'local-llm': 'Deep analysis and critical thinking specialist',
        'custom-ai': 'Domain-specific knowledge provider'
      },
      interactionPattern: 'round-robin',
      prompts: {
        system: 'You are participating in a round-robin discussion. Take your turn to contribute your unique perspective.',
        user: 'Let\'s discuss: {topic}',
        collaboration: 'Following the previous contributions: {previous_contributions}, my turn to add: {my_contribution}'
      }
    },
    {
      name: 'Expert Panel',
      description: 'AIs act as expert panelists with specialized knowledge',
      participantRoles: {
        gemini: 'General AI and technology expert',
        'local-llm': 'Privacy and security expert',
        'custom-ai': 'Domain-specific expert'
      },
      interactionPattern: 'expert-panel',
      prompts: {
        system: 'You are an expert panelist with specialized knowledge. Provide expert insights and respond to questions in your area of expertise.',
        user: 'Expert panel discussion on: {topic}',
        collaboration: 'As an expert in my field, I would like to address: {expert_insight}'
      }
    }
  ];

  async createSession(
    topic: string,
    strategyName: string,
    participantIds: string[] = ['gemini', 'local-llm']
  ): Promise<CollaborationSession> {
    const strategy = this.strategies.find(s => s.name === strategyName);
    if (!strategy) {
      throw new Error(`Unknown strategy: ${strategyName}`);
    }

    // Get all available participants (including custom AI agents)
    const allParticipants = await this.getAllParticipants();
    const selectedParticipants = allParticipants.filter(p => participantIds.includes(p.id));

    if (selectedParticipants.length < 2) {
      throw new Error('At least 2 participants are required for collaboration');
    }

    const session: CollaborationSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      participants: selectedParticipants,
      messages: [],
      topic,
      strategyName,
      mode: strategy.interactionPattern,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.sessions.set(session.id, session);
    return session;
  }

  async addUserMessage(sessionId: string, content: string): Promise<ConversationMessage[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const userMessage: ConversationMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      participantId: 'user',
      content,
      timestamp: new Date(),
      type: 'user'
    };

    session.messages.push(userMessage);
    session.updatedAt = new Date();

    // Generate AI responses based on the collaboration strategy
    const aiResponses = await this.generateCollaborativeResponses(session, content);
    session.messages.push(...aiResponses);

    return aiResponses;
  }

  private async generateCollaborativeResponses(
    session: CollaborationSession,
    userContent: string
  ): Promise<ConversationMessage[]> {
    const strategy = this.strategies.find(s => s.interactionPattern === session.mode);
    if (!strategy) return [];

    const responses: ConversationMessage[] = [];

    if (session.mode === 'parallel') {
      // All AIs respond simultaneously
      const promises = session.participants.map(participant =>
        this.generateAIResponse(participant, session, userContent, strategy)
      );
      
      const aiResponses = await Promise.all(promises);
      responses.push(...aiResponses);
    } else if (session.mode === 'sequential') {
      // AIs respond in sequence, building on each other
      for (const participant of session.participants) {
        const response = await this.generateAIResponse(participant, session, userContent, strategy);
        responses.push(response);
        
        // Add a brief pause for natural conversation flow
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } else if (session.mode === 'debate') {
      // AIs take different viewpoints
      for (let i = 0; i < session.participants.length; i++) {
        const participant = session.participants[i];
        const previousResponses = responses.slice(-session.participants.length + 1);
        
        const response = await this.generateAIResponse(participant, session, userContent, strategy, previousResponses);
        responses.push(response);
      }
    } else if (session.mode === 'brainstorm') {
      // Collaborative brainstorming
      for (const participant of session.participants) {
        const response = await this.generateAIResponse(participant, session, userContent, strategy);
        responses.push(response);
      }
    } else if (session.mode === 'round-robin') {
      // Each AI takes turns
      for (const participant of session.participants) {
        const response = await this.generateAIResponse(participant, session, userContent, strategy);
        responses.push(response);
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    } else if (session.mode === 'expert-panel') {
      // Expert panel discussion
      for (const participant of session.participants) {
        const response = await this.generateAIResponse(participant, session, userContent, strategy);
        responses.push(response);
      }
    }

    return responses;
  }

  private async generateAIResponse(
    participant: ConversationParticipant,
    session: CollaborationSession,
    content: string,
    strategy: CollaborationStrategy,
    previousResponses: ConversationMessage[] = []
  ): Promise<ConversationMessage> {
    const role = strategy.participantRoles[participant.id] || strategy.participantRoles['custom-ai'] || 'Specialized AI';
    const recentMessages = session.messages.slice(-5); // Last 5 messages for context
    
    const systemPrompt = `${strategy.prompts.system}

You are ${participant.name}, a ${participant.type} AI with the following capabilities: ${participant.capabilities.join(', ')}.

Your personality: ${participant.personality}

Your role in this collaboration: ${role}

Current topic: ${session.topic}
Collaboration mode: ${session.mode}

Recent conversation context:
${recentMessages.map(msg => `${msg.participantId}: ${msg.content}`).join('\n')}

${previousResponses.length > 0 ? `Previous AI responses to consider:
${previousResponses.map(msg => `${msg.participantId}: ${msg.content}`).join('\n')}` : ''}

Remember to stay in character and collaborate effectively with your AI partners.`;

    const userPrompt = strategy.prompts.user.replace('{topic}', session.topic);

    let aiResponse: string;
    let metadata: any = {};

    try {
      if (participant.type === 'gemini') {
        // Placeholder for Gemini API call
        aiResponse = `[${participant.name}] I understand your message: "${content}". Here's my response based on the context.`;
        metadata = {
          model: 'gemini',
          tokens: 150,
          confidence: 0.9
        };
      } else if (participant.type === 'local-llm') {
        // Placeholder for local LLM call
        aiResponse = `[${participant.name}] As a local AI, I'm processing this privately: "${content}".`;
        metadata = {
          model: 'local-llm',
          tokens: 120,
          confidence: 0.85
        };
      } else if (participant.type === 'custom-ai' && participant.customAgentId) {
        // Use custom AI agent
        const result = await customAPIManager.generateAIAgentResponse(
          participant.customAgentId,
          systemPrompt + '\n\n' + userPrompt + '\n\nUser: ' + content
        );
        aiResponse = result;
        metadata = {
          model: 'custom-ai',
          agentId: participant.customAgentId,
          confidence: 0.8
        };
      } else {
        throw new Error(`Unsupported AI type: ${participant.type}`);
      }
    } catch (error) {
      aiResponse = `I apologize, but I'm having trouble responding right now. (${error instanceof Error ? error.message : 'Unknown error'})`;
      metadata = { error: true };
    }

    const message: ConversationMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      participantId: participant.id,
      content: aiResponse,
      timestamp: new Date(),
      type: 'ai',
      metadata: {
        ...metadata,
        collaboration: {
          participants: session.participants.map(p => p.id),
          strategy: strategy.name
        }
      }
    };

    session.messages.push(message);
    session.updatedAt = new Date();

    return message;
  }

  async getAllParticipants(): Promise<ConversationParticipant[]> {
    // Get built-in participants
    const allParticipants = [...this.participants];

    // Add custom AI agents
    try {
      const customAgents = customAPIManager.getAIAgents();
      const customParticipants = customAgents.map(agent => ({
        id: agent.id,
        name: agent.name,
        type: 'custom-ai' as const,
        avatar: agent.avatar || '🤖',
        capabilities: agent.capabilities,
        personality: agent.personality,
        isActive: agent.isActive,
        customAgentId: agent.id
      }));

      allParticipants.push(...customParticipants);
    } catch (error) {
      console.warn('Failed to load custom AI agents:', error);
    }

    return allParticipants;
  }

  async addCustomAIParticipant(agentId: string): Promise<ConversationParticipant> {
    const agent = customAPIManager.getAPI(agentId) as any;
    if (!agent || agent.type !== 'ai-agent') {
      throw new Error(`Custom AI agent not found: ${agentId}`);
    }

    const participant: ConversationParticipant = {
      id: agent.id,
      name: agent.name,
      type: 'custom-ai',
      avatar: agent.avatar || '🤖',
      capabilities: agent.capabilities,
      personality: agent.personality,
      isActive: agent.isActive,
      customAgentId: agent.id
    };

    // Add to participants list
    this.participants.push(participant);
    return participant;
  }

  getSession(sessionId: string): CollaborationSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): CollaborationSession[] {
    return Array.from(this.sessions.values());
  }

  getStrategies(): CollaborationStrategy[] {
    return this.strategies;
  }

  getParticipants(): ConversationParticipant[] {
    return this.participants;
  }

  updateParticipantStatus(participantId: string, isActive: boolean): void {
    const participant = this.participants.find(p => p.id === participantId);
    if (participant) {
      participant.isActive = isActive;
    }
  }

  async pauseSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'paused';
      session.updatedAt = new Date();
    }
  }

  async resumeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'active';
      session.updatedAt = new Date();
    }
  }

  async completeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'completed';
      session.updatedAt = new Date();
    }
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  getSessionAnalytics(sessionId: string): {
    totalMessages: number;
    participantActivity: Record<string, number>;
    averageResponseTime: number;
    collaborationScore: number;
  } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const participantActivity: Record<string, number> = {};
    let totalResponseTime = 0;
    let responseCount = 0;

    session.messages.forEach((message, index) => {
      if (message.type === 'ai') {
        participantActivity[message.participantId] = (participantActivity[message.participantId] || 0) + 1;
        
        if (index > 0) {
          const prevMessage = session.messages[index - 1];
          const responseTime = message.timestamp.getTime() - prevMessage.timestamp.getTime();
          totalResponseTime += responseTime;
          responseCount++;
        }
      }
    });

    return {
      totalMessages: session.messages.length,
      participantActivity,
      averageResponseTime: responseCount > 0 ? totalResponseTime / responseCount : 0,
      collaborationScore: this.calculateCollaborationScore(session)
    };
  }

  private calculateCollaborationScore(session: CollaborationSession): number {
    const aiMessages = session.messages.filter(m => m.type === 'ai');
    const participantCount = session.participants.length;
    
    if (aiMessages.length === 0 || participantCount === 0) return 0;

    // Calculate interaction diversity
    const interactions = new Set<string>();
    aiMessages.forEach(message => {
      if (message.metadata?.collaboration?.participants) {
        interactions.add(message.metadata.collaboration.participants.sort().join('-'));
      }
    });

    const diversityScore = interactions.size / (participantCount * (participantCount - 1) / 2);
    const activityScore = aiMessages.length / Math.max(1, session.messages.length - aiMessages.length);
    
    return Math.min(1, (diversityScore + activityScore) / 2);
  }

  private async generateLocalResponse(participant: ConversationParticipant, message: string, context: string): Promise<string> {
    try {
      // Check if Ollama is available
      const ollamaResponse = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama2:7b', // Default model, can be configured
          prompt: `You are ${participant.name}, a ${participant.type} AI. Respond to this message: "${message}". Context: ${context}`,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
            max_tokens: 500
          }
        })
      });

      if (ollamaResponse.ok) {
        const data = await ollamaResponse.json();
        return data.response || `[${participant.name}] I'm processing this locally: "${message}"`;
      } else {
        // Fallback to local processing simulation
        const responses = [
          `[${participant.name}] I understand your message: "${message}". Let me process this locally.`,
          `[${participant.name}] Processing locally: "${message}". This is being handled privately.`,
          `[${participant.name}] Local AI response: I've analyzed "${message}" and here's my private assessment.`,
          `[${participant.name}] Running local analysis on: "${message}". Results are processed privately.`
        ];
        
        return responses[Math.floor(Math.random() * responses.length)];
      }
    } catch (error) {
      console.error(`Error generating local response for ${participant.name}:`, error);
      
      // Fallback response when Ollama is not available
      return `[${participant.name}] I'm processing "${message}" locally. (Local AI service not available - using fallback mode)`;
    }
  }
}

// Singleton instance
export const conversationalModeManager = new ConversationalModeManager(); 