"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Search, BookOpen, FileText, Settings, Code, Globe, Zap } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

interface DocumentationViewerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface DocSection {
  id: string
  title: string
  icon: React.ComponentType<{ className?: string }>
  content: string
  category: string
}

export function DocumentationViewer({ open, onOpenChange }: DocumentationViewerProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeSection, setActiveSection] = useState("overview")

  const documentationSections: DocSection[] = [
    {
      id: "overview",
      title: "Overview",
      icon: BookOpen,
      category: "Getting Started",
      content: `# EvolveAI Overview

EvolveAI is a privacy‑focused assistant that runs locally on your desktop. It integrates open-source language models with a vector store and Google Workspace APIs to help automate everyday tasks while keeping control of your data.

## Key Features

- **Local LLM Integration**: Run AI models locally using Ollama
- **Google Workspace APIs**: Seamless integration with Gmail, Drive, Calendar, and more
- **Vector Memory**: Persistent conversation memory and context
- **Privacy-Focused**: Your data stays on your device
- **Customizable**: Extensive theming and configuration options
- **Real-time Dashboard**: Monitor usage, costs, and performance

## Architecture

EvolveAI uses a hybrid architecture that combines:
- **Local Processing**: Core AI operations run on your device
- **Cloud APIs**: External services for enhanced functionality
- **Vector Database**: Supabase for memory and context storage
- **Electron Shell**: Cross-platform desktop application`
    },
    {
      id: "installation",
      title: "Installation Guide",
      icon: FileText,
      category: "Getting Started",
      content: `# Installation Guide

## Quick Start

1. **Download**: Get the latest installer from the releases page
2. **Install**: Run the installer and follow the setup wizard
3. **Configure**: Set up your API keys and preferences
4. **Launch**: Start using EvolveAI immediately

## System Requirements

- **Operating System**: Windows 10/11, macOS 10.15+, or Linux
- **Memory**: 8GB RAM minimum (16GB recommended)
- **Storage**: 2GB free space for application and models
- **Network**: Internet connection for API access and updates

## First Launch

On first launch, EvolveAI will:
1. Perform a hardware compatibility check
2. Suggest optimal model configurations
3. Guide you through initial setup
4. Download required components automatically

## Development Setup

For developers wanting to contribute:

\`\`\`bash
# Clone the repository
git clone https://github.com/WulfForge/EvolveAI.git
cd EvolveAI

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
\`\`\``
    },
    {
      id: "local-llm",
      title: "Local LLM Setup",
      icon: Code,
      category: "Configuration",
      content: `# Local LLM Configuration

## Supported Models

EvolveAI supports various open-source models through Ollama:

- **TinyLlama**: Fast, lightweight model for basic tasks
- **Gemma 2B**: Google's efficient 2B parameter model
- **Llama 3**: Meta's latest open-source model
- **Mistral**: High-performance 7B parameter model
- **Custom Models**: Any Ollama-compatible model

## Setup Process

1. **Open Settings**: Navigate to Settings > Local LLM
2. **Select Model**: Choose from available models
3. **Download**: The app automatically downloads Ollama and your chosen model
4. **Configure**: Set memory limits and performance options
5. **Test**: Verify the model is working correctly

## Performance Optimization

- **Memory Allocation**: Adjust based on your system's capabilities
- **Model Selection**: Choose models that balance speed and quality
- **Context Length**: Configure based on your use case
- **Batch Processing**: Enable for multiple concurrent requests

## Troubleshooting

### Common Issues

- **Out of Memory**: Reduce model size or increase system RAM
- **Slow Performance**: Use smaller models or enable GPU acceleration
- **Download Failures**: Check internet connection and firewall settings
- **Model Not Found**: Ensure the model name is correct and available

### GPU Acceleration

For NVIDIA GPUs, install CUDA drivers and use models with GPU support:
\`\`\`bash
ollama run llama3:7b
\`\`\``
    },
    {
      id: "google-apis",
      title: "Google Workspace Integration",
      icon: Globe,
      category: "Configuration",
      content: `# Google Workspace Integration

## Available APIs

EvolveAI integrates with multiple Google services:

- **Gmail API**: Read, send, and manage emails
- **Google Drive**: Access and manage files
- **Google Calendar**: Create and manage events
- **Google Docs**: Create and edit documents
- **Google Sheets**: Manipulate spreadsheet data
- **Google Slides**: Create presentations
- **Google Meet**: Access meeting information

## Setup Process

1. **Google Cloud Console**: Create a new project
2. **Enable APIs**: Activate the services you need
3. **Create Credentials**: Generate OAuth 2.0 credentials
4. **Configure Redirect**: Set authorized redirect URIs
5. **Add to App**: Enter credentials in Settings > Google APIs

## OAuth Configuration

### Required Scopes

- \`https://www.googleapis.com/auth/gmail.readonly\`
- \`https://www.googleapis.com/auth/drive\`
- \`https://www.googleapis.com/auth/calendar\`
- \`https://www.googleapis.com/auth/documents\`

### Redirect URI

Set the authorized redirect URI to:
\`\`\`
http://localhost:3000/auth/callback
\`\`\`

## Usage Examples

Once configured, you can use commands like:
- "Summarize my latest emails"
- "Create a new document about AI trends"
- "Schedule a meeting for tomorrow at 2 PM"
- "Find all files related to project X"

## Security

- All tokens are stored locally
- No data is transmitted to external servers
- OAuth tokens can be revoked at any time
- Automatic token refresh handling`
    },
    {
      id: "api-setup",
      title: "API Setup Guide",
      icon: Settings,
      category: "Configuration",
      content: `# API Setup Guide

## Free API Services

EvolveAI integrates with several free API services to enhance functionality:

### Weather API (OpenWeatherMap)
- **Free Tier**: 1,000 calls/day
- **Setup**: Sign up at openweathermap.org
- **Usage**: Real-time weather data in dashboard

### News API (NewsAPI)
- **Free Tier**: 1,000 requests/day
- **Setup**: Register at newsapi.org
- **Usage**: Latest news headlines and updates

### Currency API (ExchangeRate-API)
- **Free Tier**: 1,500 requests/month
- **Setup**: Create account at exchangerate-api.com
- **Usage**: Live currency exchange rates

### Google AI Studio
- **Free Tier**: 60 requests/minute
- **Setup**: Access via aistudio.google.com
- **Usage**: Advanced AI text generation

## Environment Variables

Create a \`.env.local\` file in your project root:

\`\`\`env
# Weather API
OPENWEATHER_API_KEY=your_openweather_api_key

# News API
NEWS_API_KEY=your_news_api_key

# Currency API
CURRENCY_API_KEY=your_currency_api_key

# AI Studio
AI_STUDIO_API_KEY=your_ai_studio_api_key

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
\`\`\`

## Dashboard Features

With APIs configured, your dashboard shows:
- Real-time weather data
- Latest news headlines
- Live currency rates
- System performance metrics
- API connection status
- Usage statistics

## Troubleshooting

### Rate Limits
- Weather: 1,000 calls/day
- News: 1,000 requests/day
- Currency: 1,500 requests/month
- AI Studio: 60 requests/minute

### Fallback Behavior
If APIs are unavailable, the dashboard uses realistic mock data to maintain functionality.`
    },
    {
      id: "usage",
      title: "Usage & Monitoring",
      icon: Zap,
      category: "Features",
      content: `# Usage & Monitoring

## Dashboard Overview

The EvolveAI dashboard provides comprehensive monitoring of your system's performance and usage.

### Key Metrics

- **Token Usage**: Track AI model consumption
- **Cost Estimation**: Monitor API expenses
- **Success Rates**: Measure prompt effectiveness
- **Response Times**: Monitor system performance
- **Connection Status**: Check API availability

## Usage Monitoring

### Token Tracking
- Real-time token consumption
- Historical usage patterns
- Cost projections
- Efficiency metrics

### API Monitoring
- Request success rates
- Response time tracking
- Error rate monitoring
- Rate limit awareness

## Performance Optimization

### Routing Rules
Configure intelligent routing between different AI models:
- **Cost-based routing**: Use cheaper models when possible
- **Quality-based routing**: Route complex tasks to better models
- **Context-aware routing**: Choose models based on content type

### Memory Management
- Vector database optimization
- Context length management
- Cache utilization
- Storage optimization

## Cost Management

### Budget Controls
- Set monthly spending limits
- Receive alerts at 80% usage
- Automatic cost optimization
- Detailed expense breakdown

### Optimization Tips
- Use local models for simple tasks
- Batch similar requests
- Implement caching strategies
- Monitor and adjust routing rules

## Troubleshooting

### Common Issues
- **High Costs**: Review routing rules and model selection
- **Slow Performance**: Check system resources and model size
- **API Errors**: Verify credentials and rate limits
- **Memory Issues**: Adjust context length and cache settings

### Performance Tuning
- Optimize model selection
- Configure appropriate batch sizes
- Enable GPU acceleration
- Monitor resource usage`
    }
  ]

  const filteredSections = documentationSections.filter(section =>
    section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    section.content.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const categories = Array.from(new Set(documentationSections.map(section => section.category)))

  const renderMarkdown = (content: string) => {
    // Simple markdown rendering
    return content
      .split('\n')
      .map((line, index) => {
        if (line.startsWith('# ')) {
          return <h1 key={index} className="text-2xl font-bold mt-6 mb-4">{line.substring(2)}</h1>
        }
        if (line.startsWith('## ')) {
          return <h2 key={index} className="text-xl font-semibold mt-5 mb-3">{line.substring(3)}</h2>
        }
        if (line.startsWith('### ')) {
          return <h3 key={index} className="text-lg font-medium mt-4 mb-2">{line.substring(4)}</h3>
        }
        if (line.startsWith('- ')) {
          return <li key={index} className="ml-4">{line.substring(2)}</li>
        }
        if (line.startsWith('```')) {
          return null // Skip code block markers for now
        }
        if (line.trim() === '') {
          return <br key={index} />
        }
        return <p key={index} className="mb-2">{line}</p>
      })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <BookOpen className="h-5 w-5" />
            <span>EvolveAI Documentation</span>
          </DialogTitle>
          <DialogDescription>
            Complete guide to using and configuring EvolveAI
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex gap-4 min-h-0">
          {/* Sidebar */}
          <div className="w-80 border-r pr-4">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documentation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <ScrollArea className="h-full">
              <div className="space-y-4">
                {categories.map(category => (
                  <div key={category}>
                    <h3 className="font-semibold text-sm text-muted-foreground mb-2">{category}</h3>
                    <div className="space-y-1">
                      {filteredSections
                        .filter(section => section.category === category)
                        .map(section => (
                          <Button
                            key={section.id}
                            variant={activeSection === section.id ? "default" : "ghost"}
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => setActiveSection(section.id)}
                          >
                            <section.icon className="h-4 w-4 mr-2" />
                            {section.title}
                          </Button>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <ScrollArea className="h-full">
              <div className="prose prose-sm max-w-none">
                {filteredSections
                  .find(section => section.id === activeSection) && (
                  <div className="p-4">
                    {renderMarkdown(filteredSections.find(section => section.id === activeSection)!.content)}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 