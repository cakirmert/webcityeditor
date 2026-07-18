[CmdletBinding()]
param(
  [switch]$DryRun,
  [switch]$Rebuild,
  [switch]$RefreshOsm,
  [switch]$AllowLowDisk,
  [switch]$Serve
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Resolve-RequiredCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Names,
    [Parameter(Mandatory = $true)]
    [string]$InstallHint
  )

  foreach ($name in $Names) {
    $command = Get-Command $name -ErrorAction SilentlyContinue
    if ($command) {
      return $command.Source
    }
  }

  throw "Missing prerequisite: $($Names[0]). $InstallHint"
}

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command,
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments,
    [Parameter(Mandatory = $true)]
    [string]$Label
  )

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE."
  }
}

Write-Host 'Checking the fresh-PC prerequisites for Hamburg road conversion...'
$git = Resolve-RequiredCommand @('git.exe', 'git') 'Install Git from https://git-scm.com/download/win.'
$node = Resolve-RequiredCommand @('node.exe', 'node') 'Install Node.js 20 or newer from https://nodejs.org/.'
$npm = Resolve-RequiredCommand @('npm.cmd', 'npm') 'Reinstall Node.js 20 or newer from https://nodejs.org/.'
$cargo = Resolve-RequiredCommand @('cargo.exe', 'cargo') 'Install Rust with rustup from https://rustup.rs/.'

$nodeVersion = (& $node --version).Trim()
$nodeMajor = [int](($nodeVersion.TrimStart('v') -split '\.')[0])
if ($nodeMajor -lt 20) {
  throw "Node.js 20 or newer is required; found $nodeVersion."
}

Write-Host "  Git:   $((& $git --version).Trim())"
Write-Host "  Node:  $nodeVersion"
Write-Host "  npm:   $((& $npm --version).Trim())"
Write-Host "  Cargo: $((& $cargo --version).Trim())"

if (-not (Test-Path (Join-Path $projectRoot '.git'))) {
  throw 'This helper must run inside a Git clone of webcityeditor, not a downloaded source ZIP.'
}

$prepareArguments = @('run', 'data:hamburg-roads:prepare')
$forwardedArguments = @()
if ($DryRun) { $forwardedArguments += '--dry-run' }
if ($Rebuild) { $forwardedArguments += '--rebuild' }
if ($RefreshOsm) { $forwardedArguments += '--refresh-osm' }
if ($AllowLowDisk) { $forwardedArguments += '--allow-low-disk' }
if ($forwardedArguments.Count -gt 0) {
  $prepareArguments += '--'
  $prepareArguments += $forwardedArguments
}

Push-Location $projectRoot
try {
  Write-Host ''
  Write-Host 'Preparing the complete Hamburg road CityJSONSeq catalog...'
  Invoke-Checked $npm $prepareArguments 'Hamburg road catalog preparation'

  if (-not $DryRun) {
    Write-Host ''
    Write-Host 'The CityJSONSeq road catalog is ready.'
    Write-Host 'Later runs reuse the completed catalog unless -Rebuild is supplied.'
    Write-Host 'Start the road editor with:'
    Write-Host '  npm run dev:hamburg-roads'
  }

  if ($Serve -and -not $DryRun) {
    Write-Host ''
    Write-Host 'Starting the local road catalog and editor. Press Ctrl+C to stop both.'
    Invoke-Checked $npm @('run', 'dev:hamburg-roads') 'Hamburg road editor startup'
  }
}
finally {
  Pop-Location
}
