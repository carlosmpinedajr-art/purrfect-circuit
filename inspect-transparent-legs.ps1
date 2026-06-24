Add-Type -AssemblyName System.Drawing

$root = $PSScriptRoot
$files = @('catgirl-yellow.jpg','catgirl-yellow-transparent.png','cpu-mint.png','cpu-rose.png','cpu-sky.png','cpu-lime.png','cpu-violet.png','cpu-coral.png','catgirl-purple-transparent.png')

$frame = @{ sx=405; sy=440; sw=114; sh=116 }

foreach ($file in $files) {
    $path = Join-Path $root $file
    if (-not (Test-Path $path)) { continue }
    $bmp = New-Object System.Drawing.Bitmap($path)
    $opaque = 0
    $bottomY = -1
    for ($y = $frame.sy; $y -lt ($frame.sy + $frame.sh); $y++) {
        for ($x = $frame.sx; $x -lt ($frame.sx + $frame.sw); $x++) {
            $p = $bmp.GetPixel($x, $y)
            if ($p.A -gt 20) {
                $opaque++
                if ($y -gt $bottomY) { $bottomY = $y }
            }
        }
    }
    $cropBottom = $frame.sy + $frame.sh - 1
    Write-Host "$file opaque=$opaque bottomY=$bottomY cropBottom=$cropBottom gap=$(( $cropBottom - $bottomY ))"
    $bmp.Dispose()
}