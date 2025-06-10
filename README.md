# EvolveAI

**EvolveAI** is a privacy-focused local-first desktop application that combines conversational AI, vector memory, and Google Workspace integration to augment productivity while keeping users in full control of their data.

---

## 🚀 Features

- 🧠 **Local AI** via Ollama & models like Mistral, LLaMA3, Gemma
- 🧾 **Contextual Memory** using vector store (Supabase/PostgreSQL)
- 🔌 **Google API Integration**: Gmail, Drive, Calendar, Docs, Sheets, and 30+ more
- 📊 **Usage Monitoring**: token usage, estimated costs, and success rates
- ⚙️ **Rules Engine**: automatic response logic for trigger phrases or routines
- 🖥️ **Electron-based UI**: runs in a self-contained desktop window
- 📚 **Built-in Help System** with detailed documentation

---

## 📦 Installation

### 1. Download Installer

- [EvolveAISetup.exe](https://github.com/WulfForge/EvolveAI/releases/latest)

### 2. System Requirements

| Requirement        | Minimum                   | Recommended             |
|--------------------|---------------------------|--------------------------|
| OS                 | Windows 10 64-bit         | Windows 11 64-bit       |
| RAM                | 8 GB                      | 16 GB or higher         |
| CPU                | 4 cores                   | 8 cores (with AVX2)     |
| Disk               | 10 GB free                | SSD with 20 GB+         |
| Network            | Required for APIs         | Required                |
| GPU (Optional)     | CUDA support for LLMs     | NVIDIA RTX 30xx+        |

---

## 🧠 Local LLM Integration

From the app’s **Settings > Local LLM** tab:

1. Choose a supported model (`tinyllama`, `gemma:2b`, `llama3`, etc.)
2. EvolveAI will:
   - Download and install Ollama
   - Create vector memory storage
   - Launch Supabase in Docker
   - Connect everything to form a hybrid Vector/RAG system

✔️ A system check recommends models that fit your RAM/CPU automatically.

---

## 🔧 Developer Setup

### Clone and Run in Dev Mode

```bash
git clone https://github.com/WulfForge/EvolveAI.git
cd EvolveAI
npm install
npm run start
npm run dev
```

The application starts at http://localhost:3000 and opens an Electron window.

### Production Build

```bash
npm run build
npm start
```

For an automated LLM setup on Windows you can run scripts\setup-llm.bat.

See [docs/EvolveAI_Documentation.md](docs/EvolveAI_Documentation.md) for detailed user and developer documentation.
