Add-Type -AssemblyName System.Drawing
$path = Join-Path $PSScriptRoot 'training-jumping-jacks.jpg'
if (-not (Test-Path $path)) {
    Write-Error "Missing training-jumping-jacks.jpg"
    exit 1
}

$bmp = New-Object System.Drawing.Bitmap($path)
Write-Host "Size $($bmp.Width)x$($bmp.Height)"
$bg = $bmp.GetPixel(0, 0)
Write-Host "BG $($bg.R),$($bg.G),$($bg.B)"

$startY = [Math]::Floor($bmp.Height * 0.2)
$endY = [Math]::Floor($bmp.Height * 0.9)
$colCounts = @()

for ($x = 0; $x -lt $bmp.Width; $x++) {
    $count = 0
    for ($y = $startY; $y -lt $endY; $y++) {
        $p = $bmp.GetPixel($x, $y)
        $diff = [Math]::Abs($p.R - $bg.R) + [Math]::Abs($p.G - $bg.G) + [Math]::Abs($p.B - $bg.B)
        if ($diff -ge 40) { $count++ }
    }
    $colCounts += $count
}

$threshold = 8
$in = $false
$segments = @()
$segStart = 0
for ($x = 0; $x -lt $colCounts.Count; $x++) {
    $active = $colCounts[$x] -ge $threshold
    if ($active -and -not $in) { $segStart = $x; $in = $true }
    elseif (-not $active -and $in) {
        $segments += @{ sx = $segStart; sw = ($x - $segStart) }
        $in = $false
    }
}
if ($in) { $segments += @{ sx = $segStart; sw = ($colCounts.Count - $segStart) } }

$segments = $segments | Where-Object { $_.sw -ge 20 }
Write-Host "Frames found: $($segments.Count)"
$i = 0
foreach ($s in $segments) {
    $top = 9999
    $bottom = 0
    for ($y = $startY; $y -lt $endY; $y++) {
        for ($x = $s.sx; $x -lt ($s.sx + $s.sw); $x++) {
            $p = $bmp.GetPixel($x, $y)
            $diff = [Math]::Abs($p.R - $bg.R) + [Math]::Abs($p.G - $bg.G) + [Math]::Abs($p.B - $bg.B)
            if ($diff -ge 40) {
                if ($y -lt $top) { $top = $y }
                if ($y -gt $bottom) { $bottom = $y }
            }
        }
    }
    Write-Host "frame$i sx=$($s.sx) sw=$($s.sw) sy=$top sh=$(( $bottom - $top + 1 )) feet=$bottom"
    $i++
}
$bmp.Dispose()