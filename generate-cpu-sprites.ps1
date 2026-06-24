Add-Type -AssemblyName System.Drawing

$root = $PSScriptRoot
$sourcePath = Join-Path $root 'catgirl-yellow.jpg'

function ConvertTo-Hsl([int]$r, [int]$g, [int]$b) {
    $rf = $r / 255.0; $gf = $g / 255.0; $bf = $b / 255.0
    $max = [Math]::Max($rf, [Math]::Max($gf, $bf))
    $min = [Math]::Min($rf, [Math]::Min($gf, $bf))
    $h = 0.0; $s = 0.0; $l = ($max + $min) / 2.0
    if ($max -ne $min) {
        $d = $max - $min
        $s = if ($l -gt 0.5) { $d / (2.0 - $max - $min) } else { $d / ($max + $min) }
        if ($max -eq $rf) { $h = (($gf - $bf) / $d + $(if ($gf -lt $bf) { 6 } else { 0 })) / 6.0 }
        elseif ($max -eq $gf) { $h = (($bf - $rf) / $d + 2.0) / 6.0 }
        else { $h = (($rf - $gf) / $d + 4.0) / 6.0 }
    }
    return @{ H = $h * 360.0; S = $s; L = $l }
}

function ConvertFrom-Hsl([double]$h, [double]$s, [double]$l) {
    $h = (($h % 360.0) + 360.0) % 360.0
    $c = (1.0 - [Math]::Abs(2.0 * $l - 1.0)) * $s
    $x = $c * (1.0 - [Math]::Abs(($h / 60.0) % 2.0 - 1.0))
    $m = $l - $c / 2.0
    $rf = 0.0; $gf = 0.0; $bf = 0.0
    if ($h -lt 60) { $rf = $c; $gf = $x }
    elseif ($h -lt 120) { $rf = $x; $gf = $c }
    elseif ($h -lt 180) { $gf = $c; $bf = $x }
    elseif ($h -lt 240) { $gf = $x; $bf = $c }
    elseif ($h -lt 300) { $rf = $x; $bf = $c }
    else { $rf = $c; $bf = $x }
    return @{
        R = [int][Math]::Round(($rf + $m) * 255.0)
        G = [int][Math]::Round(($gf + $m) * 255.0)
        B = [int][Math]::Round(($bf + $m) * 255.0)
    }
}

function Test-ProtectedPixel([int]$r, [int]$g, [int]$b) {
    if ($r -gt 188 -and $g -gt 128 -and $b -gt 96 -and $r -ge ($g - 18) -and $g -ge ($b - 12)) { return $true }
    if ($r -gt 232 -and $g -gt 232 -and $b -gt 232) { return $true }
    $max = [Math]::Max($r, [Math]::Max($g, $b))
    $min = [Math]::Min($r, [Math]::Min($g, $b))
    if (($max - $min) -lt 16 -and $max -gt 70 -and $max -lt 205) { return $true }
    return $false
}

function Test-HairPixel([int]$r, [int]$g, [int]$b) {
    return ($r -gt 70 -and $r -lt 175 -and $g -gt 45 -and $g -lt 130 -and $b -gt 25 -and $b -lt 95 -and $r -gt $g -and $g -gt $b)
}

function Export-RecoloredSprite($inputPath, $outputPath, $style) {
    $src = New-Object System.Drawing.Bitmap($inputPath)
    $dst = New-Object System.Drawing.Bitmap($src.Width, $src.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $bg = $src.GetPixel(0, 0)

    for ($y = 0; $y -lt $src.Height; $y++) {
        for ($x = 0; $x -lt $src.Width; $x++) {
            $p = $src.GetPixel($x, $y)
            $diff = [Math]::Abs($p.R - $bg.R) + [Math]::Abs($p.G - $bg.G) + [Math]::Abs($p.B - $bg.B)
            if ($diff -lt 50) {
                $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
                continue
            }

            $r = [int]$p.R; $g = [int]$p.G; $b = [int]$p.B
            if (Test-ProtectedPixel $r $g $b) {
                $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $r, $g, $b))
                continue
            }

            $hsl = ConvertTo-Hsl $r $g $b
            if ($hsl.S -lt 0.08) {
                $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $r, $g, $b))
                continue
            }

            if (Test-HairPixel $r $g $b) {
                $hsl.H += $style.HairHueShift
                $hsl.S = [Math]::Min(1.0, $hsl.S * $style.SatMult * 0.95)
            } else {
                $hsl.H += $style.HueShift
                $hsl.S = [Math]::Min(1.0, $hsl.S * $style.SatMult)
            }
            $hsl.L = [Math]::Min(0.92, [Math]::Max(0.08, $hsl.L * $style.LightMult))
            $rgb = ConvertFrom-Hsl $hsl.H $hsl.S $hsl.L
            $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $rgb.R, $rgb.G, $rgb.B))
        }
    }

    $dst.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $src.Dispose()
    $dst.Dispose()
    Write-Host "Wrote $outputPath"
}

function Export-TransparentSprite($inputPath, $outputPath) {
    Export-RecoloredSprite $inputPath $outputPath @{
        HueShift = 0; HairHueShift = 0; SatMult = 1.0; LightMult = 1.0
    }
}

$cpuStyles = @(
    @{ File = 'cpu-mint.png';   HueShift = 125; HairHueShift = 95;  SatMult = 1.30; LightMult = 0.98 },
    @{ File = 'cpu-rose.png';   HueShift = -78; HairHueShift = 38;  SatMult = 1.45; LightMult = 1.04 },
    @{ File = 'cpu-sky.png';    HueShift = 162; HairHueShift = -25; SatMult = 1.35; LightMult = 1.05 },
    @{ File = 'cpu-lime.png';  HueShift = 44;  HairHueShift = 12;  SatMult = 1.50; LightMult = 1.02 },
    @{ File = 'cpu-violet.png';HueShift = -132;HairHueShift = 55;  SatMult = 1.25; LightMult = 0.94 },
    @{ File = 'cpu-coral.png'; HueShift = -32; HairHueShift = -18; SatMult = 1.40; LightMult = 1.06 }
)

if (-not (Test-Path $sourcePath)) {
    Write-Error "Missing source sprite sheet: $sourcePath"
    exit 1
}

Export-TransparentSprite $sourcePath (Join-Path $root 'catgirl-yellow-transparent.png')

foreach ($style in $cpuStyles) {
    $out = Join-Path $root $style.File
    Export-RecoloredSprite $sourcePath $out $style
}

# Also export transparent bases for playable racers when present.
foreach ($pair in @(
    @{ Src = 'catgirl-purple.jpg'; Out = 'catgirl-purple-transparent.png' },
    @{ Src = 'catgirl-orange.jpg'; Out = 'catgirl-orange-transparent.png' }
)) {
    $src = Join-Path $root $pair.Src
    if (Test-Path $src) {
        Export-TransparentSprite $src (Join-Path $root $pair.Out)
    }
}

Write-Host 'CPU sprite PNGs generated.'