<#
.SYNOPSIS
    Installs and configures HTCondor natively on a Windows Server as the Central Manager.
    
.DESCRIPTION
    This script automates the full deployment of the HTCondor Control Plane on Windows.
    1. Downloads the HTCondor MSI.
    2. Installs it silently via msiexec.
    3. Copies the custom condor_config.local file into the C:\condor\local\config directory.
    4. Opens Windows Defender Firewall on port 9618 (TCP/UDP).
    5. Executes the token setup script.
    6. Restarts the condor service.
#>

$ErrorActionPreference = "Stop"

# Version to download (Using a standard long-term support release, usually v23.0.x)
# In production, replace with exact URL provided by HTCondor or your CDN.
$CondorVersion = "23.0.6"
$MsiUrl = "https://research.cs.wisc.edu/htcondor/tarball/23.0/23.0.6/release/condor-23.0.6-x86_64_Windows10-release.msi"
$DownloadPath = "$env:TEMP\condor-installer.msi"

$InstallDir = "C:\condor"
$LocalConfigDir = "C:\condor\local\config"

# Paths to the scripts we generated in the repo
$RepoConfigPath = Join-Path -Path $PSScriptRoot -ChildPath "config\condor_config.local"
$RepoTokenScriptPath = Join-Path -Path $PSScriptRoot -ChildPath "scripts\Setup-Tokens.ps1"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " HTCondor Central Manager Deployment (Windows Native)       " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Download HTCondor MSI
Write-Host "[1/6] Downloading HTCondor v$CondorVersion installer..."
if (-not (Test-Path -Path $DownloadPath)) {
    Invoke-WebRequest -Uri $MsiUrl -OutFile $DownloadPath
} else {
    Write-Host "      Installer already downloaded, skipping."
}

# 2. Install Silently
Write-Host "[2/6] Installing HTCondor silently (This may take a minute)..."
# The MSI properties tell it to install to C:\condor and set up the service, but we will overwrite config later
$InstallArgs = "/i `"$DownloadPath`" /qn INSTALLDIR=`"$InstallDir`" USE_HTCONDOR=True /L*V `"$env:TEMP\condor_install.log`""
Start-Process -FilePath "msiexec.exe" -ArgumentList $InstallArgs -Wait -NoNewWindow

if (-not (Test-Path -Path $InstallDir)) {
    Write-Error "HTCondor installation failed. See $env:TEMP\condor_install.log for details."
    exit 1
}

# 3. Configure the Central Manager
Write-Host "[3/6] Applying Central Manager Configuration..."
if (-not (Test-Path -Path $LocalConfigDir)) {
    New-Item -ItemType Directory -Path $LocalConfigDir -Force | Out-Null
}

if (Test-Path -Path $RepoConfigPath) {
    Copy-Item -Path $RepoConfigPath -Destination (Join-Path -Path $LocalConfigDir -ChildPath "condor_config.local") -Force
} else {
    Write-Error "Could not find condor_config.local at $RepoConfigPath"
    exit 1
}

# 4. Configure Windows Firewall
Write-Host "[4/6] Configuring Windows Defender Firewall for HTCondor (Port 9618)..."
$FirewallRuleName = "HTCondor-Central-Manager"
$ExistingRule = Get-NetFirewallRule -DisplayName $FirewallRuleName -ErrorAction SilentlyContinue

if (-not $ExistingRule) {
    New-NetFirewallRule -DisplayName $FirewallRuleName -Direction Inbound -LocalPort 9618 -Protocol TCP -Action Allow -Profile Any | Out-Null
    New-NetFirewallRule -DisplayName "$FirewallRuleName-UDP" -Direction Inbound -LocalPort 9618 -Protocol UDP -Action Allow -Profile Any | Out-Null
    Write-Host "      Firewall rules created."
} else {
    Write-Host "      Firewall rules already exist."
}

# 5. Setup IDTOKENS Cryptography
Write-Host "[5/6] Bootstrapping IDTOKEN Cryptography..."
if (Test-Path -Path $RepoTokenScriptPath) {
    & $RepoTokenScriptPath
} else {
    Write-Error "Could not find token setup script at $RepoTokenScriptPath"
    exit 1
}

# 6. Restart HTCondor Service
Write-Host "[6/6] Restarting HTCondor Windows Service..."
Restart-Service -Name "condor" -Force -ErrorAction Stop

Write-Host "============================================================" -ForegroundColor Green
Write-Host " Central Manager Deployment Complete!                       " -ForegroundColor Green
Write-Host " You can verify by running: condor_status -any              " -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
