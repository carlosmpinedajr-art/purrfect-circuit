Add-Type -AssemblyName System.Drawing

$script:cx = 0
$script:cy = 0

function Draw-StadiumFill($graphics, $sg, $tr, $brush) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $left = $script:cx - $sg
    $right = $script:cx + $sg
    $top = $script:cy - $tr
    $bottom = $script:cy + $tr
    $path.AddLine($left, $top, $right, $top)
    $path.AddArc($right - $tr, $top, $tr * 2, $tr * 2, 270, 180)
    $path.AddLine($right, $bottom, $left, $bottom)
    $path.AddArc($left - $tr, $top, $tr * 2, $tr * 2, 90, 180)
    $path.CloseFigure()
    $graphics.FillPath($brush, $path)
    $path.Dispose()
}

function Draw-StadiumOutline($graphics, $sg, $tr, $pen) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $left = $script:cx - $sg
    $right = $script:cx + $sg
    $top = $script:cy - $tr
    $bottom = $script:cy + $tr
    $path.AddLine($left, $top, $right, $top)
    $path.AddArc($right - $tr, $top, $tr * 2, $tr * 2, 270, 180)
    $path.AddLine($right, $bottom, $left, $bottom)
    $path.AddArc($left - $tr, $top, $tr * 2, $tr * 2, 90, 180)
    $path.CloseFigure()
    $graphics.DrawPath($pen, $path)
    $path.Dispose()
}

$w = 1600
$h = 800
$bmp = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'None'

$skyBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    [System.Drawing.Point]::new(0, 0),
    [System.Drawing.Point]::new(0, $h),
    [System.Drawing.Color]::FromArgb(135, 206, 235),
    [System.Drawing.Color]::FromArgb(90, 158, 66)
)
$g.FillRectangle($skyBrush, 0, 0, $w, $h)
$skyBrush.Dispose()
$g.FillRectangle([System.Drawing.Brushes]::ForestGreen, 0, 0, $w, $h)

$script:cx = $w / 2
$script:cy = $h / 2 - 16
$straightHalf = 420.0
$turnR = 176.0
$innerScale = 0.68
$innerSg = $straightHalf * $innerScale
$innerTr = $turnR * $innerScale

Draw-StadiumFill $g ($innerSg - 12) ($innerTr - 12) ([System.Drawing.Brushes]::DarkOliveGreen)

$trackBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(196, 160, 120))
Draw-StadiumFill $g $straightHalf $turnR $trackBrush
$trackBrush.Dispose()

Draw-StadiumFill $g $innerSg $innerTr ([System.Drawing.Brushes]::DarkOliveGreen)

$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(140, 255, 255, 255), 2)
$pen.DashStyle = 'Dash'
for ($i = 1; $i -lt 6; $i++) {
    $t = $innerScale + (1 - $innerScale) * ($i / 6)
    Draw-StadiumOutline $g ($straightHalf * $t) ($turnR * $t) $pen
}
$pen.Dispose()

$goldPen = New-Object System.Drawing.Pen([System.Drawing.Color]::Gold, 8)
Draw-StadiumOutline $g $straightHalf $turnR $goldPen
$goldPen.Dispose()

$whitePen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 4)
Draw-StadiumOutline $g $straightHalf $turnR $whitePen
$whitePen.Dispose()

$innerPen = New-Object System.Drawing.Pen([System.Drawing.Color]::LightGray, 4)
Draw-StadiumOutline $g $innerSg $innerTr $innerPen
$innerPen.Dispose()

$finishX = $script:cx - $straightHalf
$topOuter = $script:cy - $turnR
$topInner = $script:cy - $innerTr
$checkH = ($topInner - $topOuter) / 6
for ($i = 0; $i -lt 6; $i++) {
    $brush = if ($i % 2 -eq 0) { [System.Drawing.Brushes]::White } else { [System.Drawing.Brushes]::Black }
    $g.FillRectangle($brush, $finishX - 10, $topOuter + $i * $checkH, 20, $checkH)
}

$font = New-Object System.Drawing.Font('Arial', 18, [System.Drawing.FontStyle]::Bold)
$g.DrawString('START / FINISH', $font, [System.Drawing.Brushes]::Gold, $finishX - 80, $topOuter - 40)
$font.Dispose()

$outPath = Join-Path $PSScriptRoot 'oval-track.png'
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Host "Saved $outPath"