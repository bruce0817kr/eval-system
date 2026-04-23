$ErrorActionPreference = "Stop"

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments
  )

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$FilePath $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
  }
}

Write-Host "Running web lint/build"
Invoke-Checked npm run lint
Invoke-Checked npm run build

Write-Host "Running eval regression"
Invoke-Checked npx playwright test tests/integration-api.spec.ts tests/eval-api-coverage.spec.ts tests/eval-full-simulation.spec.ts --workers=1

Write-Host "Running biz-api regression"
Push-Location apps/biz-api
try {
  Invoke-Checked python -m pytest -q
}
finally {
  Pop-Location
}
