Add-Type -AssemblyName System.Drawing

$path = Join-Path $PSScriptRoot 'catgirl-lilac-sprites.jpg'
$bmp = New-Object System.Drawing.Bitmap($path)
$bg = $bmp.GetPixel(0, 0)

function IsOpaque($p, $bg) {
    $diff = [Math]::Abs($p.R - $bg.R) + [Math]::Abs($p.G - $bg.G) + [Math]::Abs($p.B - $bg.B)
    return $diff -ge 40
}

function GetFrame($cellX, $sy, $cellW, $sh) {
    $left = $cellX + $cellW
    $right = -1
    $bottom = -1
    for ($y = $sy; $y -lt ($sy + $sh); $y++) {
        for ($x = $cellX; $x -lt ($cellX + $cellW); $x++) {
            if (IsOpaque $bmp.GetPixel($x, $y) $bg) {
                if ($x -lt $left) { $left = $x }
                if ($x -gt $right) { $right = $x }
                if ($y -gt $bottom) { $bottom = $y }
            }
        }
    }
    if ($bottom -lt 0) { return $null }
    return [PSCustomObject]@{
        sx = $left
        sy = $sy
        sw = $right - $left + 1
        sh = $bottom - $sy + 1
        feet = $bottom + 1
    }
}

$rows = @(
    @{ key = 'idle'; sy = 25; sh = 89; fw = 102; count = 10; pick = @(0,1,2,3) },
    @{ key = 'runStart'; sy = 138; sh = 84; fw = 102; count = 10; pick = @(0,2,4,6) },
    @{ key = 'runFull'; sy = 243; sh = 85; fw = 102; count = 10; pick = @(0,1,2,3,4,5,6,7,8,9) },
    @{ key = 'jump'; sy = 351; sh = 86; fw = 102; count = 10; pick = @(0,2,4,6) },
    @{ key = 'finish'; sy = 462; sh = 88; fw = 146; count = 7; pick = @(0) }
)

foreach ($row in $rows) {
    Write-Host "$($row.key):"
    foreach ($fi in $row.pick) {
        $cellX = $fi * $row.fw
        $f = GetFrame $cellX $row.sy $row.fw $row.sh
        if ($f) {
            Write-Host "  { sx:$($f.sx), sy:$($f.sy), sw:$($f.sw), sh:$($f.sh), feet:$($f.feet) },"
        }
    }
}

# portrait from idle frame 0 center-ish
$f0 = GetFrame 0 25 102 89
Write-Host "portrait:"
Write-Host "  { sx:$($f0.sx), sy:$($f0.sy), sw:$($f0.sw), sh:$($f0.sh), feet:$($f0.feet) },"

$bmp.Dispose()