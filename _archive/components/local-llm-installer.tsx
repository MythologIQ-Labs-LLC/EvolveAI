"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, Download, Cpu, HardDrive, AlertTriangle, Play, Zap } from "lucide-react"
import { toast } from "sonner"

interface SystemSpecs {
  os: 'windows' | 'macos' | 'linux'
  architecture: 'x64' | 'arm64'
  ram: number
  cpu: {
    cores: number
    model: string
    hasAVX2: boolean
  }
  gpu?: {
    model: string
    vram: number
    hasCUDA: boolean
  }
  diskSpace: number
  drives: {
    mount: string
    label?: string
    type: string
    fs: string
    size: number
    used: number
    free: number
  }[]
  gpus: {
    model: string
    vendor: string
    vram: number
    hasCUDA: boolean
  }[]
}

interface LLMModel {
  name: string
  size: number
  minRAM: number
  recommendedRAM: number
  supportsGPU: boolean
  description: string
  downloadUrl: string
  ollamaModel: string
  tags: string[]
}

export function LocalLLMInstaller() {
  const [systemSpecs, setSystemSpecs] = useState<SystemSpecs | null>(null)
  const [recommendedModels, setRecommendedModels] = useState<LLMModel[]>([])
  const [bestModel, setBestModel] = useState<LLMModel | null>(null)
  const [allModels, setAllModels] = useState<LLMModel[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [installProgress, setInstallProgress] = useState(0)
  const [installingModel, setInstallingModel] = useState<string | null>(null)
  const [ollamaInstalled, setOllamaInstalled] = useState(false)
  const [selectedModel, setSelectedModel] = useState<LLMModel | null>(null)

  useEffect(() => {
    loadSystemSpecs()
  }, [])

  const loadSystemSpecs = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/local-llm/system-specs")
      const data = await response.json()

      if (data.success) {
        setSystemSpecs(data.data.systemSpecs)
        setRecommendedModels(data.data.recommendedModels)
        setBestModel(data.data.bestModel)
        setAllModels(data.data.allModels)
      } else {
        toast.error("Failed to load system specifications")
      }
    } catch (error) {
      toast.error("Failed to load system specifications")
    } finally {
      setIsLoading(false)
    }
  }

  const installOllama = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/local-llm/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "install-ollama" }),
      })

      const data = await response.json()

      if (data.success) {
        setOllamaInstalled(true)
        toast.success("Ollama installed successfully!")
      } else {
        toast.error(data.error || "Failed to install Ollama")
      }
    } catch (error) {
      toast.error("Failed to install Ollama")
    } finally {
      setIsLoading(false)
    }
  }

  const installModel = async (model: LLMModel) => {
    try {
      setInstallingModel(model.name)
      setInstallProgress(0)

      const response = await fetch("/api/local-llm/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "install-model", 
          modelName: model.ollamaModel 
        }),
      })

      const data = await response.json()

      if (data.success) {
        setInstallProgress(100)
        toast.success(`${model.name} installed successfully!`)
        setSelectedModel(model)
      } else {
        toast.error(data.error || `Failed to install ${model.name}`)
      }
    } catch (error) {
      toast.error(`Failed to install ${model.name}`)
    } finally {
      setInstallingModel(null)
      setInstallProgress(0)
    }
  }

  const testModel = async (model: LLMModel) => {
    try {
      const response = await fetch("/api/local-llm/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "test-model", 
          modelName: model.ollamaModel 
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success(`${model.name} is working correctly!`)
      } else {
        toast.error(data.error || `Failed to test ${model.name}`)
      }
    } catch (error) {
      toast.error(`Failed to test ${model.name}`)
    }
  }

  const getCompatibilityStatus = (model: LLMModel) => {
    if (!systemSpecs) return "unknown"

    if (systemSpecs.ram < model.minRAM) return "incompatible"
    if (model.supportsGPU && !systemSpecs.gpu?.hasCUDA) return "no-gpu"
    if (systemSpecs.diskSpace < model.size + 5) return "no-space"
    
    return "compatible"
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "compatible":
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case "incompatible":
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      case "no-gpu":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />
      case "no-space":
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusText = (status: string, model: LLMModel) => {
    switch (status) {
      case "compatible":
        return "Compatible"
      case "incompatible":
        return `Requires ${model.minRAM}GB RAM`
      case "no-gpu":
        return "GPU acceleration recommended"
      case "no-space":
        return "Insufficient disk space"
      default:
        return "Unknown"
    }
  }

  if (isLoading && !systemSpecs) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Analyzing your system...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* System Specifications */}
      {systemSpecs && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Cpu className="w-5 h-5" />
              <span>System Specifications</span>
            </CardTitle>
            <CardDescription>Your system capabilities for local AI models</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium">RAM</span>
                </div>
                <div className="text-2xl font-bold">{systemSpecs.ram} GB</div>
                <div className="text-xs text-muted-foreground">
                  {systemSpecs.ram >= 16 ? "Excellent for large models" : 
                   systemSpecs.ram >= 8 ? "Good for medium models" : 
                   "Suitable for small models"}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Cpu className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium">CPU</span>
                </div>
                <div className="text-sm font-medium">{systemSpecs.cpu.model}</div>
                <div className="text-xs text-muted-foreground">
                  {systemSpecs.cpu.cores} cores, {systemSpecs.cpu.hasAVX2 ? "AVX2 supported" : "No AVX2"}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <HardDrive className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium">Total Disk Space</span>
                </div>
                <div className="text-2xl font-bold">{systemSpecs.diskSpace} GB</div>
                <div className="text-xs text-muted-foreground">Sum of all drives</div>
              </div>
            </div>
            {/* Drives Table */}
            <div className="mt-6">
              <div className="font-semibold mb-2">Drives</div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs border">
                  <thead>
                    <tr className="bg-muted">
                      <th className="px-2 py-1">Mount</th>
                      <th className="px-2 py-1">Label</th>
                      <th className="px-2 py-1">Type</th>
                      <th className="px-2 py-1">FS</th>
                      <th className="px-2 py-1">Size (GB)</th>
                      <th className="px-2 py-1">Used (GB)</th>
                      <th className="px-2 py-1">Free (GB)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {systemSpecs.drives.map((d, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1">{d.mount}</td>
                        <td className="px-2 py-1">{d.label || '-'}</td>
                        <td className="px-2 py-1">{d.type}</td>
                        <td className="px-2 py-1">{d.fs}</td>
                        <td className="px-2 py-1">{d.size}</td>
                        <td className="px-2 py-1">{d.used}</td>
                        <td className="px-2 py-1">{d.free}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {/* GPUs Table */}
            <div className="mt-6">
              <div className="font-semibold mb-2">GPUs</div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs border">
                  <thead>
                    <tr className="bg-muted">
                      <th className="px-2 py-1">Model</th>
                      <th className="px-2 py-1">Vendor</th>
                      <th className="px-2 py-1">VRAM (GB)</th>
                      <th className="px-2 py-1">CUDA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {systemSpecs.gpus.map((g, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1">{g.model}</td>
                        <td className="px-2 py-1">{g.vendor}</td>
                        <td className="px-2 py-1">{g.vram}</td>
                        <td className="px-2 py-1">{g.hasCUDA ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ollama Installation */}
      <Card>
        <CardHeader>
          <CardTitle>Ollama Installation</CardTitle>
          <CardDescription>Install the Ollama runtime for local AI models</CardDescription>
        </CardHeader>
        <CardContent>
          {ollamaInstalled ? (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Ollama is installed and ready to use. You can now install AI models.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Ollama is required to run local AI models. It will be downloaded and installed automatically.
              </p>
              <Button 
                onClick={installOllama} 
                disabled={isLoading}
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Install Ollama
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommended Models */}
      {bestModel && (
        <Card>
          <CardHeader>
            <CardTitle>Recommended Model</CardTitle>
            <CardDescription>Best model for your system specifications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="font-semibold">{bestModel.name}</h3>
                    <Badge variant="secondary">{bestModel.size}GB</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{bestModel.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {bestModel.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex space-x-2">
                  {ollamaInstalled && (
                    <Button 
                      onClick={() => installModel(bestModel)}
                      disabled={installingModel === bestModel.name}
                      size="sm"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Install
                    </Button>
                  )}
                  {selectedModel?.name === bestModel.name && (
                    <Button 
                      onClick={() => testModel(bestModel)}
                      variant="outline"
                      size="sm"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Test
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Available Models */}
      <Card>
        <CardHeader>
          <CardTitle>All Available Models</CardTitle>
          <CardDescription>Browse and install any compatible model</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {allModels.map((model) => {
                const status = getCompatibilityStatus(model)
                const isInstalling = installingModel === model.name
                const isSelected = selectedModel?.name === model.name

                return (
                  <div key={model.name} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        {getStatusIcon(status)}
                        <h3 className="font-semibold">{model.name}</h3>
                        <Badge variant="secondary">{model.size}GB</Badge>
                        <Badge variant={status === "compatible" ? "default" : "destructive"}>
                          {getStatusText(status, model)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{model.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {model.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      {isInstalling && (
                        <div className="mt-2">
                          <Progress value={installProgress} className="h-2" />
                          <p className="text-xs text-muted-foreground mt-1">
                            Installing {model.name}... {installProgress}%
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      {ollamaInstalled && status === "compatible" && (
                        <Button 
                          onClick={() => installModel(model)}
                          disabled={isInstalling}
                          size="sm"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Install
                        </Button>
                      )}
                      {isSelected && (
                        <Button 
                          onClick={() => testModel(model)}
                          variant="outline"
                          size="sm"
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Test
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
} 