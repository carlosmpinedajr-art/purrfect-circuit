Add-Type -AssemblyName System.Drawing
$root = $PSScriptRoot
$bmp = New-Object System.Drawing.Bitmap((Join-Path $root 'catgirl-yellow.jpg'))
$bg = $bmp.GetPixel(0,0)
$frame = @{ sx=128; sy=434; sw=85; sh=122 }

for ($y = 548; $y -le 575; $y++) {
    $count = 0
    $colors = @{}
    for ($x = $frame.sx; $x -lt ($frame.sx + $frame.sw); $x++) {
        $p = $bmp.GetPixel($x, $y)
        $diff = [Math]::Abs($p.R-$bg.R)+[Math]::Abs($p.G-$bg.G)+[Math]::Abs($p.B-$bg.B)
        if ($diff -ge 50) {
            $count++
            $key = "$($p.R),$($p.G),$($p.B)"
            if ($colors.ContainsKey($key)) { $colors[$key]++ } else { $colors[$key]=1 }
        }
    }
    $top = ($colors.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 3 | ForEach-Object { "$($_.Key)($($_.Value))" }) -join ' '
    Write-Host "y=$y count=$count colors=$top"
}
$bmp.Dispose()