Add-Type -AssemblyName System.Drawing
$root = $PSScriptRoot
$bmp = New-Object System.Drawing.Bitmap((Join-Path $root 'catgirl-yellow.jpg'))
$bg = $bmp.GetPixel(0,0)

$runFull = @(
    @{ sx=128; sy=434; sw=85; sh=122 },
    @{ sx=267; sy=434; sw=99; sh=122 },
    @{ sx=405; sy=440; sw=114; sh=116 },
    @{ sx=558; sy=440; sw=107; sh=116 },
    @{ sx=704; sy=440; sw=100; sh=116 },
    @{ sx=856; sy=440; sw=86; sh=116 }
)

$i = 0
foreach ($f in $runFull) {
    $bottomY = -1
    for ($y = $f.sy; $y -lt ($f.sy + $f.sh + 8); $y++) {
        for ($x = $f.sx; $x -lt ($f.sx + $f.sw); $x++) {
            if ($y -ge $bmp.Height) { continue }
            $p = $bmp.GetPixel($x, $y)
            $diff = [Math]::Abs($p.R-$bg.R)+[Math]::Abs($p.G-$bg.G)+[Math]::Abs($p.B-$bg.B)
            if ($diff -ge 50) { if ($y -gt $bottomY) { $bottomY = $y } }
        }
    }
    Write-Host "runFull$i bottom=$bottomY cropBottom=$($f.sy+$f.sh-1) extra=$(( $bottomY - ($f.sy+$f.sh-1) ))"
    $i++
}
$bmp.Dispose()