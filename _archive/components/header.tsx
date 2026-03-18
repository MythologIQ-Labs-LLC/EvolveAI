import { Badge } from "@/components/ui/badge"

export function Header() {
  return (
    <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <h1 className="text-2xl font-semibold text-foreground">Evolve AI</h1>
        <Badge variant="secondary" className="bg-secondary text-secondary-foreground hover:bg-secondary/80">
          v1.0.0
        </Badge>
      </div>
      <div className="flex items-center space-x-2">
        <span className="text-sm text-muted-foreground">built by</span>
        <a
          href="https://www.mythologiq.studio"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold text-primary hover:underline"
        >
          MythologIQ
        </a>
      </div>
    </header>
  )
}
