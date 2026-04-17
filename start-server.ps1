param(
  [int]$PreferredPort = 3333,
  [int]$MaxPort = 3340,
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$startPage   = 'index.html'
$appMarker   = '<title>LifeguardOrders</title>'

function Get-ListeningPids {
  param([int]$Port)

  $lines = netstat -ano -p TCP | Select-String ":$Port\s"
  $pids = @()

  foreach ($match in $lines) {
    $parts = $match.Line.Trim() -split '\s+'
    if ($parts.Count -lt 5) { continue }

    $localEndpoint  = $parts[1]
    $remoteEndpoint = $parts[2]
    $pidText        = $parts[-1]

    $localPortText = $localEndpoint -replace '^.*:', ''
    if ($localPortText -ne "$Port") { continue }
    if ($remoteEndpoint -notmatch ':0$') { continue }
    if ($pidText -notmatch '^\d+$') { continue }
    if ([int]$pidText -le 0) { continue }

    $pids += [int]$pidText
  }

  return $pids | Sort-Object -Unique
}

function Test-AppServer {
  param([int]$Port)

  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/$startPage" -TimeoutSec 2
    return $response.StatusCode -eq 200 -and $response.Content.Contains($appMarker)
  } catch {
    return $false
  }
}

function Wait-AppServer {
  param(
    [int]$Port,
    [int]$TimeoutSec = 8
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    if (Test-AppServer -Port $Port) {
      return $true
    }
    Start-Sleep -Milliseconds 300
  }

  return $false
}

function Open-App {
  param([int]$Port)

  $url = "http://127.0.0.1:$Port/$startPage"
  Write-Host "App: $url"
  if (-not $NoBrowser) {
    Start-Process $url | Out-Null
  }
}

function Request-YesNo {
  param([string]$Prompt)

  $answer = Read-Host "$Prompt [J/N]"
  return $answer -match '^(?i:j|ja|y|yes)$'
}

foreach ($port in $PreferredPort..$MaxPort) {
  if (Test-AppServer -Port $port) {
    Write-Host "Verwende bereits laufenden LifeguardOrders-Server auf Port $port."
    Open-App -Port $port
    exit 0
  }
}

$preferredPids = @(Get-ListeningPids -Port $PreferredPort)
if ($preferredPids.Count -gt 0) {
  Write-Warning "Port $PreferredPort ist belegt, aber dort antwortet kein passender LifeguardOrders-Server."
  if (Request-YesNo -Prompt "Soll(en) die Prozesse $($preferredPids -join ', ') beendet und Port $PreferredPort wiederverwendet werden?") {
    foreach ($pid in $preferredPids) {
      taskkill /PID $pid /F | Out-Null
    }
    Start-Sleep -Seconds 1
  }
}

$portToUse = $null
foreach ($port in $PreferredPort..$MaxPort) {
  if ((@(Get-ListeningPids -Port $port)).Count -eq 0) {
    $portToUse = $port
    break
  }
}

if (-not $portToUse) {
  Write-Error "Kein freier Port zwischen $PreferredPort und $MaxPort gefunden."
  exit 1
}

Write-Host "Starte LifeguardOrders auf Port $portToUse ..."
try {
  $process = Start-Process python `
    -ArgumentList '-m', 'http.server', $portToUse, '--directory', $projectRoot `
    -WorkingDirectory $projectRoot `
    -WindowStyle Minimized `
    -PassThru
} catch {
  Write-Error "Python konnte nicht gestartet werden: $($_.Exception.Message)"
  exit 1
}

if (-not (Wait-AppServer -Port $portToUse)) {
  Write-Warning "Der neu gestartete Server auf Port $portToUse antwortet nicht korrekt."
  if (Request-YesNo -Prompt "Soll Prozess $($process.Id) beendet werden?") {
    taskkill /PID $process.Id /F | Out-Null
  }
  exit 1
}

Write-Host "Server gestartet (PID $($process.Id))."
Open-App -Port $portToUse
exit 0
