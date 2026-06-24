Add-Type -AssemblyName System.Drawing
$root = $PSScriptRoot
$bmp = New-Object System.Drawing.Bitmap((Join-Path $root 'catgirl-purple.jpg'))
$bg = $bmp.GetPixel(0,0)

function Get-BottomOpaque($f) {
    $bottomY = -1
    for ($y = $f.sy; $y -lt [Math]::Min($bmp.Height, $f.sy + $f.sh + 20); $y++) {
        for ($x = $f.sx; $x -lt ($f.sx + $f.sw); $x++) {
            $p = $bmp.GetPixel($x, $y)
            $diff = [Math]::Abs($p.R-$bg.R)+[Math]::Abs($p.G-$bg.G)+[Math]::Abs($p.B-$bg.B)
            if ($diff -ge 50 -and $y -gt $bottomY) { $bottomY = $y }
        }
    }
    return $bottomY
}

$runFull = @(
    @{ sx=128; sy=434; sw=90; sh=122 },
    @{ sx=267; sy=434; sw=90; sh=122 },
    @{ sx=405; sy=434; sw=90; sh=121 },
    @{ sx=544; sy=434; sw=90; sh=121 },
    @{ sx=683; sy=434; sw=85; sh=121 },
    @{ sx=821; sy=434; sw=85; sh=121 }
)
$runStart = @(
    @{ sx=128; sy=242; sw=108; sh=131 },
    @{ sx=267; sy=242; sw=108; sh=131 },
    @{ sx=405; sy=242; sw=108; sh=130 },
    @{ sx=544; sy=242; sw=114; sh=131 }
)

$i=0; foreach ($f in $runFull) { $b=Get-BottomOpaque $f; Write-Host "purple runFull$i bottom=$b needSh=$(( $b - $f.sy + 1 )) currentSh=$($f.sh)"; $i++ }
$i=0; foreach ($f in $runStart) { $b=Get-BottomOpaque $f; Write-Host "purple runStart$i bottom=$b needSh=$(( $b - $f.sy + 1 )) currentSh=$($f.sh)"; $i++ }
$bmp.Dispose()