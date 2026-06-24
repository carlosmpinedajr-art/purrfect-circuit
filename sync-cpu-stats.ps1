$txtPath = Join-Path $PSScriptRoot 'cpu-stats.txt'
$jsPath  = Join-Path $PSScriptRoot 'cpu-stats.js'

if (-not (Test-Path $txtPath)) {
    Write-Error "cpu-stats.txt not found."
    exit 1
}

$content = [System.IO.File]::ReadAllText($txtPath)
$json = ConvertTo-Json $content -Compress

$js = "// Auto-generated from cpu-stats.txt - run sync-cpu-stats.bat after editing.`r`nconst CPU_STATS_TEXT = $json;`r`n"

[System.IO.File]::WriteAllText($jsPath, $js, (New-Object System.Text.UTF8Encoding $false))
Write-Host "Updated cpu-stats.js from cpu-stats.txt"