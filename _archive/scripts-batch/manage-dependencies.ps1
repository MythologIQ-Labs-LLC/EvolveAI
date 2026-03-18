# EvolveAI Dependency Management Script
# This script helps manage dependencies and resolve lock file conflicts

param(
    [string]$Action = "check",  # check, fix, update, audit, clean
    [switch]$Force = $false
)

$AppName = "EvolveAI"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Test-LockFileConflicts {
    Write-ColorOutput "=== Checking for Lock File Conflicts ===" "Cyan"
    
    $conflicts = @()
    
    if (Test-Path "package-lock.json") {
        Write-ColorOutput "✓ Found package-lock.json (npm)" "Green"
    } else {
        Write-ColorOutput "✗ No package-lock.json found" "Red"
    }
    
    if (Test-Path "pnpm-lock.yaml") {
        Write-ColorOutput "✗ Found pnpm-lock.yaml (conflict!)" "Red"
        $conflicts += "pnpm-lock.yaml"
    }
    
    if (Test-Path "yarn.lock") {
        Write-ColorOutput "✗ Found yarn.lock (conflict!)" "Red"
        $conflicts += "yarn.lock"
    }
    
    if ($conflicts.Count -eq 0) {
        Write-ColorOutput "✓ No lock file conflicts detected" "Green"
        return $true
    } else {
        Write-ColorOutput "✗ Found $($conflicts.Count) conflicting lock files" "Red"
        return $false
    }
}

function Remove-ConflictingLockFiles {
    Write-ColorOutput "=== Removing Conflicting Lock Files ===" "Yellow"
    
    $filesToRemove = @("pnpm-lock.yaml", "yarn.lock")
    
    foreach ($file in $filesToRemove) {
        if (Test-Path $file) {
            Remove-Item $file -Force
            Write-ColorOutput "✓ Removed $file" "Green"
        }
    }
}

function Clean-Dependencies {
    Write-ColorOutput "=== Cleaning Dependencies ===" "Yellow"
    
    # Clean npm cache
    Write-ColorOutput "Cleaning NPM cache..." "Yellow"
    npm cache clean --force
    
    # Remove node_modules and package-lock.json
    if (Test-Path "node_modules") {
        Write-ColorOutput "Removing node_modules..." "Yellow"
        Remove-Item "node_modules" -Recurse -Force
    }
    
    if (Test-Path "package-lock.json") {
        Write-ColorOutput "Removing package-lock.json..." "Yellow"
        Remove-Item "package-lock.json" -Force
    }
    
    Write-ColorOutput "✓ Cleanup completed" "Green"
}

function Install-Dependencies {
    Write-ColorOutput "=== Installing Dependencies ===" "Yellow"
    
    $result = npm install
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✓ Dependencies installed successfully" "Green"
        return $true
    } else {
        Write-ColorOutput "✗ Failed to install dependencies" "Red"
        return $false
    }
}

function Test-SecurityVulnerabilities {
    Write-ColorOutput "=== Security Audit ===" "Cyan"
    
    # Run npm audit and capture output
    $auditOutput = npm audit 2>&1
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -eq 0) {
        Write-ColorOutput "✓ No security vulnerabilities found" "Green"
        return $true
    } else {
        Write-ColorOutput "✗ Security vulnerabilities detected:" "Red"
        Write-ColorOutput $auditOutput "Yellow"
        return $false
    }
}

function Fix-SecurityIssues {
    Write-ColorOutput "=== Fixing Security Issues ===" "Yellow"
    
    if ($Force) {
        Write-ColorOutput "Running with --force (may include breaking changes)..." "Yellow"
        npm audit fix --force
    } else {
        Write-ColorOutput "Running safe fixes only..." "Yellow"
        npm audit fix
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✓ Security fixes applied" "Green"
        return $true
    } else {
        Write-ColorOutput "⚠ Some issues may require manual attention" "Yellow"
        return $false
    }
}

function Show-OutdatedPackages {
    Write-ColorOutput "=== Outdated Packages ===" "Cyan"
    
    # Run npm outdated and capture output
    $outdatedOutput = npm outdated 2>&1
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -eq 0) {
        Write-ColorOutput "✓ All packages are up to date" "Green"
    } else {
        Write-ColorOutput "Found outdated packages:" "Yellow"
        Write-ColorOutput $outdatedOutput "White"
    }
}

function Show-Help {
    Write-ColorOutput "=== EvolveAI Dependency Management ===" "Cyan"
    Write-ColorOutput "Usage: .\manage-dependencies.ps1 [-Action <action>] [-Force]" "White"
    Write-ColorOutput ""
    Write-ColorOutput "Actions:" "White"
    Write-ColorOutput "  check    - Check for lock file conflicts and security issues (default)" "Green"
    Write-ColorOutput "  fix      - Fix lock file conflicts and security issues" "Yellow"
    Write-ColorOutput "  update   - Update dependencies (use -Force for breaking changes)" "Blue"
    Write-ColorOutput "  audit    - Run security audit only" "Magenta"
    Write-ColorOutput "  clean    - Clean and reinstall dependencies" "Red"
    Write-ColorOutput "  help     - Show this help message" "Cyan"
    Write-ColorOutput ""
    Write-ColorOutput "Options:" "White"
    Write-ColorOutput "  -Force   - Include breaking changes in updates" "Yellow"
}

# Main execution
switch ($Action.ToLower()) {
    "check" { 
        $lockOk = Test-LockFileConflicts
        Show-OutdatedPackages
        $securityOk = Test-SecurityVulnerabilities
        
        if ($lockOk -and $securityOk) {
            Write-ColorOutput "✓ All checks passed!" "Green"
        } else {
            Write-ColorOutput "✗ Issues detected. Run 'fix' action to resolve." "Red"
        }
    }
    "fix" { 
        Remove-ConflictingLockFiles
        Clean-Dependencies
        $installOk = Install-Dependencies
        if ($installOk) {
            Fix-SecurityIssues
        }
    }
    "update" { 
        if ($Force) {
            Write-ColorOutput "Updating with breaking changes..." "Yellow"
            npm update
        } else {
            Write-ColorOutput "Updating within current major versions..." "Yellow"
            npm update
        }
    }
    "audit" { Test-SecurityVulnerabilities }
    "clean" { 
        Clean-Dependencies
        Install-Dependencies
    }
    "help" { Show-Help }
    default { 
        Write-ColorOutput "Unknown action: $Action" "Red"
        Show-Help
    }
} 