<#
.SYNOPSIS
    Generates the master IDTOKEN signing key for the HTCondor Central Manager on Windows.
    
.DESCRIPTION
    This script invokes the condor_token_create utility to generate the master cryptographic
    key that the Central Manager uses to sign IDTOKENS for execute nodes (lab computers) 
    and submit nodes (the web API).
#>

$ErrorActionPreference = "Stop"

# Default paths for a Windows HTCondor installation
$CondorBinDir = "C:\condor\bin"
$PasswordsDir = "C:\condor\local\passwords.d"

Write-Host "[*] Setting up HTCondor Master Token Issuer..." -ForegroundColor Cyan

# 1. Ensure the passwords directory exists
if (-not (Test-Path -Path $PasswordsDir)) {
    Write-Host "    Creating directory: $PasswordsDir"
    New-Item -ItemType Directory -Path $PasswordsDir -Force | Out-Null
}

# 2. Check if the master key already exists
$PoolKeyPath = Join-Path -Path $PasswordsDir -ChildPath "POOL"
if (Test-Path -Path $PoolKeyPath) {
    Write-Host "[!] Master POOL key already exists at $PoolKeyPath" -ForegroundColor Yellow
    Write-Host "    Skipping generation to avoid invalidating existing tokens."
    exit 0
}

# 3. Generate the key using the condor binary
$TokenCreateExe = Join-Path -Path $CondorBinDir -ChildPath "condor_token_create.exe"

if (-not (Test-Path -Path $TokenCreateExe)) {
    Write-Error "Could not find condor_token_create.exe at $TokenCreateExe. Is HTCondor installed?"
    exit 1
}

Write-Host "    Generating new Master POOL key..."
& $TokenCreateExe -setup

if ($LASTEXITCODE -eq 0) {
    Write-Host "[+] Master token key generated successfully." -ForegroundColor Green
    Write-Host "    Path: $PoolKeyPath"
} else {
    Write-Error "Failed to generate master token key. condor_token_create exited with code $LASTEXITCODE."
    exit 1
}
