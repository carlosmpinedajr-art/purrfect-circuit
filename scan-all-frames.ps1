Add-Type -AssemblyName System.Drawing
$root = $PSScriptRoot
$bmp = New-Object System.Drawing.Bitmap((Join-Path $root 'catgirl-yellow.jpg'))
$bg = $bmp.GetPixel(0,0)

function Get-BottomOpaque($f) {
    $bottomY = -1
    for ($y = $f.sy; $y -lt [Math]::Min($bmp.Height, $f.sy + $f.sh + 16); $y++) {
        for ($x = $f.sx; $x -lt ($f.sx + $f.sw); $x++) {
            $p = $bmp.GetPixel($x, $y)
            $diff = [Math]::Abs($p.R-$bg.R)+[Math]::Abs($p.G-$bg.G)+[Math]::Abs($p.B-$bg.B)
            if ($diff -ge 50 -and $y -gt $bottomY) { $bottomY = $y }
        }
    }
    return $bottomY
}

$sets = @{
    runStart = @(
        @{ sx=128; sy=242; sw=80; sh=131 },
        @{ sx=267; sy=242; sw=101; sh=131 },
        @{ sx=405; sy=246; sw=115; sh=127 },
        @{ sx=558; sy=248; sw=107; sh=125 }
    )
    runFull = @(
        @{ sx=128; sy=434; sw=85; sh=122 },
        @{ sx=267; sy=434; sw=99; sh=122 },
        @{ sx=405; sy=440; sw=114; sh=116 },
        @{ sx=558; sy=440; sw=107; sh=116 },
        @{ sx=704; sy=440; sw=100; sh=116 },
        @{ sx=856; sy=440; sw=86; sh=116 }
    )
}

foreach ($setName in $sets.Keys) {
    $i = 0
    foreach ($f in $sets[$setName]) {
        $bottom = Get-BottomOpaque $f
        $cropBottom = $f.sy + $f.sh - 1
        Write-Host "$setName$i sy=$($f.sy) sh=$($f.sh) bottom=$bottom cropBottom=$cropBottom needSh=$(( $bottom - $f.sy + 1 ))"
        $i++
    }
}

$bmp.Dispose()