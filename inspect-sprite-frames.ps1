Add-Type -AssemblyName System.Drawing

$root = $PSScriptRoot
$path = Join-Path $root 'catgirl-yellow.jpg'
$bmp = New-Object System.Drawing.Bitmap($path)
$bg = $bmp.GetPixel(0, 0)
Write-Host "Size $($bmp.Width)x$($bmp.Height) bg=$($bg.R),$($bg.G),$($bg.B)"

$frames = @(
    @{ Name='run0'; sx=128; sy=434; sw=85; sh=122 },
    @{ Name='run2'; sx=405; sy=440; sw=114; sh=116 },
    @{ Name='run5'; sx=856; sy=440; sw=86; sh=116 },
    @{ Name='start0'; sx=128; sy=242; sw=80; sh=131 }
)

foreach ($f in $frames) {
    $opaque = 0
    $bottomY = -1
    for ($y = $f.sy; $y -lt ($f.sy + $f.sh); $y++) {
        for ($x = $f.sx; $x -lt ($f.sx + $f.sw); $x++) {
            $p = $bmp.GetPixel($x, $y)
            $diff = [Math]::Abs($p.R - $bg.R) + [Math]::Abs($p.G - $bg.G) + [Math]::Abs($p.B - $bg.B)
            if ($diff -ge 50) {
                $opaque++
                if ($y -gt $bottomY) { $bottomY = $y }
            }
        }
    }
    $cropBottom = $f.sy + $f.sh - 1
    Write-Host "$($f.Name) opaque=$opaque bottomOpaqueY=$bottomY cropBottom=$cropBottom gap=$((($f.sy + $f.sh - 1) - $bottomY))"
}

$bmp.Dispose()