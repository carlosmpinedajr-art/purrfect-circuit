Add-Type -AssemblyName System.Drawing
$root = $PSScriptRoot
$jpg = New-Object System.Drawing.Bitmap((Join-Path $root 'catgirl-yellow.jpg'))
$png = New-Object System.Drawing.Bitmap((Join-Path $root 'catgirl-yellow-transparent.png'))
$bg = $jpg.GetPixel(0,0)

$frame = @{ sx=405; sy=440; sw=114; sh=116 }
$removed = @{}
$kept = 0

for ($y = $frame.sy; $y -lt ($frame.sy + $frame.sh); $y++) {
    for ($x = $frame.sx; $x -lt ($frame.sx + $frame.sw); $x++) {
        $jp = $jpg.GetPixel($x, $y)
        $pp = $png.GetPixel($x, $y)
        $diff = [Math]::Abs($jp.R-$bg.R)+[Math]::Abs($jp.G-$bg.G)+[Math]::Abs($jp.B-$bg.B)
        if ($diff -lt 50) { continue }
        if ($pp.A -gt 20) { $kept++ }
        else {
            $key = "$($jp.R),$($jp.G),$($jp.B)"
            if ($removed.ContainsKey($key)) { $removed[$key]++ } else { $removed[$key] = 1 }
        }
    }
}

Write-Host "Kept character pixels: $kept"
Write-Host "Removed character-ish pixels (top colors):"
$removed.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 15 | ForEach-Object { Write-Host "  $($_.Key) count=$($_.Value)" }

# bottom rows removed count
for ($y = 548; $y -le 555; $y++) {
    $rowRemoved = 0; $rowKept = 0
    for ($x = $frame.sx; $x -lt ($frame.sx + $frame.sw); $x++) {
        $jp = $jpg.GetPixel($x, $y)
        $pp = $png.GetPixel($x, $y)
        $diff = [Math]::Abs($jp.R-$bg.R)+[Math]::Abs($jp.G-$bg.G)+[Math]::Abs($jp.B-$bg.B)
        if ($diff -lt 50) { continue }
        if ($pp.A -gt 20) { $rowKept++ } else { $rowRemoved++ }
    }
    Write-Host "y=$y kept=$rowKept removed=$rowRemoved"
}

$jpg.Dispose(); $png.Dispose()