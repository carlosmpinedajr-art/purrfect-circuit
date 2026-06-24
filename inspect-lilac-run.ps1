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
        sx = $left
        sy = $top
        sw = $right - $left + 1
        sh = $bottom - $top + 1
        feet = $bottom + 1
        cell = $cellX
        opaqueH = $bottom - $top + 1
    }
}

$runStartSy = 138; $runStartH = 84; $fw = 102
$runFullSy = 243; $runFullH = 85

Write-Host 'runStart frames:'
for ($i = 0; $i -lt 10; $i++) {
    $m = Measure-Cell ($i * $fw) $runStartSy $fw $runStartH
    if ($m) { Write-Host ("  [{0}] sx:{1} sy:{2} sw:{3} sh:{4} feet:{5}" -f $i, $m.sx, $m.sy, $m.sw, $m.sh, $m.feet) }
}

Write-Host 'runFull frames:'
for ($i = 0; $i -lt 10; $i++) {
    $m = Measure-Cell ($i * $fw) $runFullSy $fw $runFullH
    if ($m) { Write-Host ("  [{0}] sx:{1} sy:{2} sw:{3} sh:{4} feet:{5}" -f $i, $m.sx, $m.sy, $m.sw, $m.sh, $m.feet) }
}

$bmp.Dispose()