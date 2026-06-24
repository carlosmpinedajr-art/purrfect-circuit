Add-Type -AssemblyName System.Drawing

$path = Join-Path $PSScriptRoot 'catgirl-lilac-sprites.jpg'
$bmp = New-Object System.Drawing.Bitmap($path)
$bg = $bmp.GetPixel(0, 0)
Write-Host "Size $($bmp.Width)x$($bmp.Height) bg=$($bg.R),$($bg.G),$($bg.B)"

function IsOpaque($p, $bg) {
    $diff = [Math]::Abs($p.R - $bg.R) + [Math]::Abs($p.G - $bg.G) + [Math]::Abs($p.B - $bg.B)
    return $diff -ge 40
}

# Row boundaries by scanning y for content density
$bands = @()
for ($y = 0; $y -lt $bmp.Height; $y++) {
    $count = 0
    for ($x = 0; $x -lt $bmp.Width; $x += 2) {
        if (IsOpaque $bmp.GetPixel($x, $y) $bg) { $count++ }
    }
    if ($count -gt 20) { $bands += $y }
}
$groups = @()
$start = $bands[0]
$prev = $bands[0]
foreach ($y in $bands) {
    if ($y - $prev -gt 3) {
        $groups += ,@($start, $prev)
        $start = $y
    }
    $prev = $y
}
$groups += ,@($start, $prev)
Write-Host "Row groups:"
$ri = 0
foreach ($g in $groups) {
    Write-Host "  row $ri y=$($g[0])-$($g[1]) h=$($g[1]-$g[0]+1)"
    $ri++
}

$frameCounts = @(10, 10, 10, 10, 7)
$labels = @('idle', 'runStart', 'runFull', 'jump', 'finish')
for ($i = 0; $i -lt [Math]::Min($groups.Count, 5); $i++) {
    $sy = $groups[$i][0]
    $sh = $groups[$i][1] - $groups[$i][0] + 1
    $fc = $frameCounts[$i]
    $fw = [Math]::Floor($bmp.Width / $fc)
    $bottoms = @()
    for ($fi = 0; $fi -lt $fc; $fi++) {
        $sx = $fi * $fw
        $bottom = -1
        for ($y = $sy; $y -lt ($sy + $sh); $y++) {
            for ($x = $sx; $x -lt ($sx + $fw); $x++) {
                if (IsOpaque $bmp.GetPixel($x, $y) $bg) {
                    if ($y -gt $bottom) { $bottom = $y }
                }
            }
        }
        $bottoms += $bottom
    }
    $avgBottom = [Math]::Round(($bottoms | Measure-Object -Average).Average)
    $feet = $avgBottom + 1
    Write-Host "$($labels[$i]): sy=$sy sh=$sh fw=$fw feet=$feet"
    Write-Host "  frame0: sx=0 sy=$sy sw=$fw sh=$sh feet=$feet"
    if ($fc -ge 4) {
        Write-Host "  sample frames 0,1,2,3 bottoms: $($bottoms[0..3] -join ',')"
    }
}

$bmp.Dispose()