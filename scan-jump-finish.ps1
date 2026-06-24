Add-Type -AssemblyName System.Drawing
foreach ($file in @('catgirl-yellow.jpg','catgirl-purple.jpg')) {
    $path = Join-Path $PSScriptRoot $file
    $bmp = New-Object System.Drawing.Bitmap($path)
    $bg = $bmp.GetPixel(0,0)
    $frames = @(
        @{ name='jump'; sx=336; sy=626; sw=112; sh=112; feet=737 },
        @{ name='finishY'; sx=240; sy=818; sw=96; sh=112; feet=929 },
        @{ name='finishP'; sx=128; sy=818; sw=102; sh=112; feet=929 }
    )
    Write-Host "== $file =="
    foreach ($f in $frames) {
        $bottom = -1
        for ($y = $f.sy; $y -lt [Math]::Min($bmp.Height, $f.sy + $f.sh + 16); $y++) {
            for ($x = $f.sx; $x -lt ($f.sx + $f.sw); $x++) {
                $p = $bmp.GetPixel($x, $y)
                $diff = [Math]::Abs($p.R-$bg.R)+[Math]::Abs($p.G-$bg.G)+[Math]::Abs($p.B-$bg.B)
                if ($diff -ge 50 -and $y -gt $bottom) { $bottom = $y }
            }
        }
        $need = $bottom - $f.sy + 1
        Write-Host "$($f.name) bottom=$bottom needSh=$need currentSh=$($f.sh) feet=$($f.feet)"
    }
    $bmp.Dispose()
}