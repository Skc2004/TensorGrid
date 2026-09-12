# HTCondor Execute Node Agent - Enterprise Mass Deployment Script
# Intended for deployment via Active Directory GPO or SCCM

$ErrorActionPreference = "Stop"

# Configuration
param(
    [Parameter(Mandatory=$true)]
    [string]$AuthToken
)

$AgentDir = "C:\Program Files\HTCondorAgent"
$AgentExePath = "$AgentDir\execute-node-agent.exe"
$ServiceName = "HTCondorGridAgent"
$SourceExe = ".\execute-node-agent.exe"

Write-Host "Starting HTCondor Agent Installation..."

# 1. Ensure Directory Exists
if (-not (Test-Path $AgentDir)) {
    Write-Host "Creating directory $AgentDir"
    New-Item -ItemType Directory -Force -Path $AgentDir | Out-Null
}

# 2. Copy the compiled silent executable
Write-Host "Copying executable..."
Copy-Item -Path $SourceExe -Destination $AgentExePath -Force

# 3. Stop service if it already exists
$ServiceStatus = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($ServiceStatus) {
    Write-Host "Stopping existing service..."
    Stop-Service -Name $ServiceName -Force
}

# 4. Create the Windows Service using sc.exe
Write-Host "Registering official Windows Service: $ServiceName"
if (-not $ServiceStatus) {
    # Note: For production Go binaries to run flawlessly as Windows Services without NSSM wrappers, 
    # the Go source code should import golang.org/x/sys/windows/svc
    $scArgs = @("create", $ServiceName, "binPath=", "`"$AgentExePath`" --token=$AuthToken", "start=", "auto", "DisplayName=", "HTCondor Grid Execute Node")
    & sc.exe $scArgs
} else {
    # Update binary path if it changed
    $scArgs = @("config", $ServiceName, "binPath=", "`"$AgentExePath`" --token=$AuthToken")
    & sc.exe $scArgs
}

# Configure Recovery Options (Restart on failure)
& sc.exe failure $ServiceName reset= 86400 actions= restart/60000/restart/60000/restart/60000

# 5. Start the Service
Write-Host "Starting $ServiceName..."
Start-Service -Name $ServiceName

Write-Host "HTCondor Agent successfully deployed and running in the background as SYSTEM!"
