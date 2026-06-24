Add-Type -AssemblyName System.Drawing

$root = $PSScriptRoot
$inputPath = Join-Path $root 'catgirl-lilac-sprites.jpg'
$outputPath = Join-Path $root 'catgirl-lilac-transparent.png'
$tolerance = 50

$src = New-Object System.Drawing.Bitmap($inputPath)
$w = $src.Width
$h = $src.Height
$bg = $src.GetPixel(0, 0)
$dst = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

function Is-BgPixel($p, $bg, $tol) {
    $diff = [Math]::Abs($p.R - $bg.R) + [Math]::Abs($p.G - $bg.G) + [Math]::Abs($p.B - $bg.B)
    return $diff -lt $tol
}

$remove = New-Object bool[] ($w * $h)
$queue = New-Object System.Collections.Generic.Queue[int]

function Enqueue-Bg($x, $y) {
    if ($x -lt 0 -or $y -lt 0 -or $x -ge $w -or $y -ge $h) { return }
    $idx = $y * $w + $x
    if ($remove[$idx]) { return }
    $p = $src.GetPixel($x, $y)
    if (Is-BgPixel $p $bg $tolerance) {
        $remove[$idx] = $true
        $queue.Enqueue($idx) | Out-Null
    }
}

for ($x = 0; $x -lt $w; $x++) {
    Enqueue-Bg $x 0
    Enqueue-Bg $x ($h - 1)
}
for ($y = 0; $y -lt $h; $y++) {
    Enqueue-Bg 0 $y
    Enqueue-Bg ($w - 1) $y
}

while ($queue.Count -gt 0) {
    $idx = $queue.Dequeue()
    $x = $idx % $w
    $y = [Math]::Floor($idx / $w)
    Enqueue-Bg ($x - 1) $y
    Enqueue-Bg ($x + 1) $y
    Enqueue-Bg $x ($y - 1)
    Enqueue-Bg $x ($y + 1)
}

$alpha = New-Object byte[] ($w * $h)
$red = New-Object byte[] ($w * $h)
$green = New-Object byte[] ($w * $h)
$blue = New-Object byte[] ($w * $h)

for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
        $idx = $y * $w + $x
        $p = $src.GetPixel($x, $y)
        if ($remove[$idx]) {
            $alpha[$idx] = 0
        } else {
            $alpha[$idx] = 255
            $red[$idx] = $p.R
            $green[$idx] = $p.G
            $blue[$idx] = $p.B
        }
    }
}

for ($pass = 0; $pass -lt 4; $pass++) {
    for ($y = 1; $y -lt ($h - 1); $y++) {
        for ($x = 1; $x -lt ($w - 1); $x++) {
            $idx = $y * $w + $x
            if ($alpha[$idx] -gt 128) { continue }
            $neighbors = @(
                ($y - 1) * $w + $x,
                ($y + 1) * $w + $x,
                $y * $w + ($x - 1),
                $y * $w + ($x + 1)
            )
            $count = 0
            $r = 0; $g = 0; $b = 0
            foreach ($n in $neighbors) {
                if ($alpha[$n] -gt 128) {
                    $count++
                    $r += $red[$n]
                    $g += $green[$n]
                    $b += $blue[$n]
                }
            }
            if ($count -ge 3) {
                $alpha[$idx] = 255
                $red[$idx] = [byte][Math]::Round($r / $count)
                $green[$idx] = [byte][Math]::Round($g / $count)
                $blue[$idx] = [byte][Math]::Round($b / $count)
            }
        }
    }
}

for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
        $idx = $y * $w + $x
        if ($alpha[$idx] -eq 0) {
            $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } else {
            $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $red[$idx], $green[$idx], $blue[$idx]))
        }
    }
}

$dst.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$src.Dispose()
$dst.Dispose()
Write-Host "Wrote $outputPath"