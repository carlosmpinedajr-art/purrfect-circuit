Add-Type -AssemblyName System.Drawing

$root = $PSScriptRoot
$inputPath = Join-Path $root 'training-jumping-jacks.jpg'
$outputPath = Join-Path $root 'training-jumping-jacks.png'

if (-not (Test-Path $inputPath)) {
    Write-Error "Missing training-jumping-jacks.jpg"
    exit 1
}

$src = New-Object System.Drawing.Bitmap($inputPath)
$dst = New-Object System.Drawing.Bitmap($src.Width, $src.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$bg = $src.GetPixel(0, 0)

for ($y = 0; $y -lt $src.Height; $y++) {
    for ($x = 0; $x -lt $src.Width; $x++) {
        $p = $src.GetPixel($x, $y)
        $diff = [Math]::Abs($p.R - $bg.R) + [Math]::Abs($p.G - $bg.G) + [Math]::Abs($p.B - $bg.B)
        if ($diff -lt 28) {
            $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } else {
            $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $p.R, $p.G, $p.B))
        }
    }
}

$dst.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$src.Dispose()
$dst.Dispose()
Write-Host "Wrote $outputPath"