Add-Type -AssemblyName System.Drawing

$root = Join-Path $PSScriptRoot '..'

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

function Test-EyePixel([int]$r, [int]$g, [int]$b) {
    return ($b -gt 110 -and $g -gt 70 -and $r -lt 110 -and $b -gt ($r + 25))
}

function Test-OutfitPixel([int]$r, [int]$g, [int]$b) {
    if (Test-ProtectedPixel $r $g $b) { return $false }
    if (Test-HairPixel $r $g $b) { return $false }
    if (Test-EyePixel $r $g $b) { return $false }
    $hsl = ConvertTo-Hsl $r $g $b
    if ($hsl.S -lt 0.14) { return $false }
    if ($hsl.H -ge 245 -and $hsl.H -le 335) { return $true }
    if ($hsl.H -ge 210 -and $hsl.H -lt 245 -and $hsl.S -ge 0.22 -and $b -gt $g) { return $true }
    return $false
}

function Export-RecoloredSheet($inputPath, $outputPath, $style) {
    if (-not (Test-Path $inputPath)) {
        Write-Error "Missing input: $inputPath"
        return
    }
    $src = New-Object System.Drawing.Bitmap($inputPath)
    $dst = New-Object System.Drawing.Bitmap($src.Width, $src.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

    for ($y = 0; $y -lt $src.Height; $y++) {
        for ($x = 0; $x -lt $src.Width; $x++) {
            $p = $src.GetPixel($x, $y)
            if ($p.A -eq 0) {
                $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
                continue
            }

            $r = [int]$p.R; $g = [int]$p.G; $b = [int]$p.B
            if (-not (Test-OutfitPixel $r $g $b)) {
                $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $r, $g, $b))
                continue
            }

            $hsl = ConvertTo-Hsl $r $g $b
            $hsl.H += $style.HueShift
            $hsl.S = [Math]::Min(1.0, [Math]::Max(0.08, $hsl.S * $style.SatMult))
            $hsl.L = [Math]::Min(0.92, [Math]::Max(0.08, $hsl.L * $style.LightMult))
            $rgb = ConvertFrom-Hsl $hsl.H $hsl.S $hsl.L
            $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $rgb.R, $rgb.G, $rgb.B))
        }
    }

    $dst.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $src.Dispose()
    $dst.Dispose()
    Write-Output "Wrote $outputPath"
}

$variants = @(
    @{
        Prefix = 'lilac'
        HueShift = 18
        SatMult = 1.12
        LightMult = 1.06
    },
    @{
        Prefix = 'ember'
        HueShift = 112
        SatMult = 1.38
        LightMult = 1.08
    }
)

$sheets = @(
    @{ Src = 'sunny-run-sprites.png';  Suffix = 'run-sprites.png' },
    @{ Src = 'sunny-jump-sprites.png'; Suffix = 'jump-sprites.png' }
)

foreach ($sheet in $sheets) {
    $inputPath = Join-Path $root $sheet.Src
    foreach ($variant in $variants) {
        $outName = "$($variant.Prefix)-$($sheet.Suffix)"
        $outputPath = Join-Path $root $outName
        Export-RecoloredSheet $inputPath $outputPath @{
            HueShift = $variant.HueShift
            SatMult = $variant.SatMult
            LightMult = $variant.LightMult
        }
    }
}

Write-Output 'Sunny outfit variants generated.'