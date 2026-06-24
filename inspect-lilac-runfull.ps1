Add-Type -AssemblyName System.Drawing

$path = Join-Path $PSScriptRoot 'catgirl-lilac-sprites.jpg'
$bmp = New-Object System.Drawing.Bitmap($path)
$bg = $bmp.GetPixel(0, 0)

function IsOpaque($p, $bg) {
    $diff = [Math]::Abs($p.R - $bg.R) + [Math]::Abs($p.G - $bg.G) + [Math]::Abs($p.B - $bg.B)
    return $diff -ge 40
}

function Measure-Cell($cellX, $sy, $cellW, $rowH) {
    $left = $cellX + $cellW
    $right = -1
    $top = $sy + $rowH
    $bottom = -1
    for ($y = $sy; $y -lt ($sy + $rowH); $y++) {
        for ($x = $cellX; $x -lt ($cellX + $cellW); $x++) {
            if ($x -ge $bmp.Width) { continue }
            if (IsOpaque $bmp.GetPixel($x, $y) $bg) {
                if ($x -lt $left) { $left = $x }
                if ($x -gt $right) { $right = $x }
                if ($y -lt $top) { $top = $y }
                if ($y -gt $bottom) { $bottom = $y }
            }
        }
    }
    if ($bottom -lt 0) { return $null }
    return [PSCustomObject]@{
        sx = $left; sy = $top; sw = $right - $left + 1; sh = $bottom - $top + 1; feet = $bottom + 1
    }
}

# detect run full row
$runFullSy = 243
$runFullH = 85

foreach ($count in @(10, 11, 12, 13)) {
    $fw = [math]::Floor($bmp.Width / $count)
    $valid = 0
    $frames = @()
    for ($i = 0; $i -lt $count; $i++) {
        $m = Measure-Cell ($i * $fw) $runFullSy $fw $runFullH
        if ($m -and $m.sw -gt 30) { $valid++; $frames += $m }
    }
    Write-Host "count=$count fw=$fw valid=$valid"
}

Write-Host "`nUsing 12 frames:"
$fw12 = [math]::Floor(1024 / 12)
for ($i = 0; $i -lt 12; $i++) {
    $m = Measure-Cell ($i * $fw12) $runFullSy $fw12 $runFullH
    if ($m) { Write-Host ("  [{0}] sx:{1} sy:{2} sw:{3} sh:{4} feet:{5}" -f $i, $m.sx, $m.sy, $m.sw, $m.sh, $m.feet) }
}

Write-Host "`nUsing 10 frames:"
$fw10 = [math]::Floor(1024 / 10)
for ($i = 0; $i -lt 10; $i++) {
    $m = Measure-Cell ($i * $fw10) $runFullSy $fw10 $runFullH
    if ($m) { Write-Host ("  [{0}] sx:{1} sy:{2} sw:{3} sh:{4} feet:{5}" -f $i, $m.sx, $m.sy, $m.sw, $m.sh, $m.feet) }
}

# find best contiguous cycle with stable feet
Write-Host "`nStable-feet groups (12-frame grid):"
$fw = [math]::Floor(1024 / 12)
$all = @()
for ($i = 0; $i -lt 12; $i++) {
    $m = Measure-Cell ($i * $fw) $runFullSy $fw $runFullH
    if ($m) { $all += ,@($i, $m) }
}
foreach ($entry in $all) {
    $i = $entry[0]; $m = $entry[1]
    Write-Host "  i=$i feet=$($m.feet) sy=$($m.sy) sh=$($m.sh)"
}

$bmp.Dispose()