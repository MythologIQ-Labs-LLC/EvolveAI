# .gitignore for Evolve AI

## Overview

EvolveAI is a privacy‑focused assistant that runs locally on your desktop. It integrates open-source language models with a vector store and Google Workspace APIs to help automate everyday tasks while keeping control of your data.

## User Guide

1. **Installation**
   - Download the latest `EvolveAISetup.exe` from the [releases page](https://github.com/WulfForge/EvolveAI/releases/latest).
   - Run the installer and follow the prompts. On first launch the app performs a hardware check and suggests a compatible model.

2. **Local LLM Setup**
   - Open the **Settings > Local LLM** tab.
   - Select a model (e.g. `tinyllama`, `gemma:2b`, `llama3`). The application downloads Ollama, prepares vector memory, and launches a Supabase container automatically.
   - When setup finishes you can start chatting using the built‑in interface.

3. **Google Workspace Integration**
   - From **Settings > Google API**, connect your Google account. The app will request permission to access Gmail, Drive, Calendar, Docs and other services.
   - Once connected you can issue commands like "summarize my latest email" or "create a new document" directly from the chat window.

4. **Usage Monitoring**
   - Navigate to **Stats** to view token usage, estimated costs and success rates for your prompts.

## Developer Guide

### Prerequisites

- Node.js 18+ and npm
- Docker (for Supabase)

### Local Development

```bash
# Clone repository
git clone https://github.com/WulfForge/EvolveAI.git
cd EvolveAI

# Install dependencies
npm install

# Start the development server
npm run dev
```

This launches the Next.js web UI on `http://localhost:3000` and starts the Electron shell.

### Production Build

```bash
npm run build
npm start
```

### LLM Setup Script (optional)

Windows users can run `scripts\setup-llm.bat` to download Ollama, install Docker Desktop and initialize Supabase automatically.

## License

EvolveAI is released under the MIT License.

