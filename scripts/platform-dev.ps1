$ErrorActionPreference = "Stop"

function ConvertTo-PowerShellLiteral {
  param([Parameter(Mandatory = $true)][string]$Value)

  return "'" + $Value.Replace("'", "''") + "'"
}

$RootPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$BizApiPath = Join-Path $RootPath "apps\biz-api"
$RootLiteral = ConvertTo-PowerShellLiteral $RootPath
$BizApiLiteral = ConvertTo-PowerShellLiteral $BizApiPath
$WebCommand = "`$env:PORT = '3003'; Set-Location -LiteralPath $RootLiteral; npm run dev"
$BizApiCommand = "Set-Location -LiteralPath $BizApiLiteral; python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
$WebEncodedCommand = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($WebCommand))
$BizApiEncodedCommand = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($BizApiCommand))

Write-Host "Starting Next.js shell on :3003"
Start-Process powershell -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-EncodedCommand",
  $WebEncodedCommand
)

Write-Host "Starting biz-api on 127.0.0.1:8000"
Start-Process powershell -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-EncodedCommand",
  $BizApiEncodedCommand
)
