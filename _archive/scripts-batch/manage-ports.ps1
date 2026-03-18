# EvolveAI Port Management Script
# This script helps reserve and manage ports for EvolveAI

param(
    [string]$Action = "check",  # check, reserve, release, cleanup
    [int]$StartPort = 4000,
    [int]$EndPort = 4010
)

$AppName = "EvolveAI"
$ReservedPorts = @(4000..4010)

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Test-PortAvailable {
    param([int]$Port)
    try {
        $connection = New-Object System.Net.Sockets.TcpClient
        $connection.Connect("localhost", $Port)
        $connection.Close()
        return $false  # Port is in use
    }
    catch {
        return $true   # Port is available
    }
}

function Get-ProcessOnPort {
    param([int]$Port)
    try {
        $netstat = netstat -ano | Select-String ":$Port\s"
        if ($netstat) {
            $pid = ($netstat -split '\s+')[-1]
            $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
            return $process
        }
    }
    catch {
        return $null
    }
    return $null
}

function Check-Ports {
    Write-ColorOutput "=== Checking EvolveAI Reserved Ports ===" "Cyan"
    
    foreach ($port in $ReservedPorts) {
        $available = Test-PortAvailable -Port $port
        if ($available) {
            Write-ColorOutput "✓ Port $port is available" "Green"
        } else {
            $process = Get-ProcessOnPort -Port $port
            if ($process) {
                Write-ColorOutput "✗ Port $port is in use by: $($process.ProcessName) (PID: $($process.Id))" "Red"
            } else {
                Write-ColorOutput "✗ Port $port is in use (unknown process)" "Red"
            }
        }
    }
}

function Reserve-Ports {
    Write-ColorOutput "=== Attempting to Reserve Ports for EvolveAI ===" "Yellow"
    
    # Kill any existing EvolveAI processes
    $evolveAIProcesses = Get-Process | Where-Object { 
        $_.ProcessName -eq "node" -or $_.ProcessName -eq "electron" 
    } | Where-Object {
        $_.MainWindowTitle -like "*EvolveAI*" -or $_.ProcessName -eq "electron"
    }
    
    if ($evolveAIProcesses) {
        Write-ColorOutput "Found existing EvolveAI processes, stopping them..." "Yellow"
        $evolveAIProcesses | Stop-Process -Force
        Start-Sleep -Seconds 2
    }
    
    # Check if ports are available
    $availablePorts = @()
    foreach ($port in $ReservedPorts) {
        if (Test-PortAvailable -Port $port) {
            $availablePorts += $port
        }
    }
    
    if ($availablePorts.Count -eq $ReservedPorts.Count) {
        Write-ColorOutput "✓ All reserved ports are available!" "Green"
        return $true
    } else {
        Write-ColorOutput "✗ Some ports are still in use. Run cleanup first." "Red"
        return $false
    }
}

function Cleanup-Ports {
    Write-ColorOutput "=== Cleaning Up EvolveAI Ports ===" "Red"
    
    foreach ($port in $ReservedPorts) {
        $process = Get-ProcessOnPort -Port $port
        if ($process) {
            if ($process.ProcessName -eq "node" -or $process.ProcessName -eq "electron") {
                Write-ColorOutput "Stopping $($process.ProcessName) (PID: $($process.Id)) on port $port" "Yellow"
                Stop-Process -Id $process.Id -Force
            } else {
                Write-ColorOutput "Port $port is used by $($process.ProcessName) - not stopping (system process)" "Magenta"
            }
        }
    }
    
    Start-Sleep -Seconds 2
    Check-Ports
}

function Show-Help {
    Write-ColorOutput "=== EvolveAI Port Management ===" "Cyan"
    Write-ColorOutput "Usage: .\manage-ports.ps1 [-Action <action>]" "White"
    Write-ColorOutput ""
    Write-ColorOutput "Actions:" "White"
    Write-ColorOutput "  check    - Check port availability (default)" "Green"
    Write-ColorOutput "  reserve  - Attempt to reserve ports for EvolveAI" "Yellow"
    Write-ColorOutput "  cleanup  - Clean up EvolveAI processes and ports" "Red"
    Write-ColorOutput "  help     - Show this help message" "Blue"
    Write-ColorOutput ""
    Write-ColorOutput "Reserved Port Range: 4000-4010" "Cyan"
}

# Main execution
switch ($Action.ToLower()) {
    "check" { Check-Ports }
    "reserve" { Reserve-Ports }
    "cleanup" { Cleanup-Ports }
    "help" { Show-Help }
    default { 
        Write-ColorOutput "Unknown action: $Action" "Red"
        Show-Help
    }
} 