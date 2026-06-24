# Push Purrfect Circuit to GitHub (run once after: gh auth login)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$gh = Get-Command gh -ErrorAction SilentlyContinue
if (-not $gh) {
    Write-Host "GitHub CLI not found. Install: winget install GitHub.cli"
    exit 1
}

gh auth status 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Not logged in. Run: gh auth login"
    Write-Host "Then run this script again."
    exit 1
}

$remote = git remote get-url origin 2>$null
if (-not $remote) {
    gh repo create purrfect-circuit --public `
        --description "Purrfect Circuit - browser catgirl racing game with multiplayer" `
        --source=. --remote=origin --push
} else {
    git push -u origin main
}

if ($LASTEXITCODE -eq 0) {
    gh repo view --web
    Write-Host "Done! Repo pushed to GitHub."
}