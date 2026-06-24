Add-Type -AssemblyName System.Drawing
$root = $PSScriptRoot

function Get-JumpFrames($path) {
    $bmp = New-Object System.Drawing.Bitmap($path)
    $bg = $bmp.GetPixel(0, 0)
    $sy = 626
    $colCounts = @()
    for ($x = 0; $x -lt $bmp.Width; $x++) {
        $count = 0
        for ($y = $sy; $y -lt [Math]::Min($bmp.Height, $sy + 130); $y++) {
            $p = $bmp.GetPixel($x, $y)
            $diff = [Math]::Abs($p.R - $bg.R) + [Math]::Abs($p.G - $bg.G) + [Math]::Abs($p.B - $bg.B)
            if ($diff -ge 40) { $count++ }
        }
        $colCounts += $count
    }
    $threshold = 6
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
    Write-Host "== $([IO.Path]::GetFileName($path)) $($bmp.Width)x$($bmp.Height) frames=$($segments.Count) =="
    $i = 0
    foreach ($s in $segments) {
        $top = 9999; $bottom = 0
        for ($y = $sy; $y -lt [Math]::Min($bmp.Height, $sy + 130); $y++) {
            for ($x = $s.sx; $x -lt ($s.sx + $s.sw); $x++) {
                $p = $bmp.GetPixel($x, $y)
                $diff = [Math]::Abs($p.R - $bg.R) + [Math]::Abs($p.G - $bg.G) + [Math]::Abs($p.B - $bg.B)
                if ($diff -ge 40) {
                    if ($y -lt $top) { $top = $y }
                    if ($y -gt $bottom) { $bottom = $y }
                }
            }
        }
        Write-Host "  frame$i sx=$($s.sx) sw=$($s.sw) sy=$top sh=$(( $bottom - $top + 1 )) feet=$bottom"
        $i++
    }
    $bmp.Dispose()
}

Get-JumpFrames (Join-Path $root 'catgirl-yellow.jpg')
Get-JumpFrames (Join-Path $root 'catgirl-purple.jpg')
Get-JumpFrames (Join-Path $root 'catgirl-orange.jpg')