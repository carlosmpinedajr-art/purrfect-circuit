Add-Type -AssemblyName System.Drawing

function IsHurdleBg($r, $g, $b) {
  $d = [math]::Abs($r - 44) + [math]::Abs($g - 31) + [math]::Abs($b - 74)
  if ($d -lt 90) { return $true }
  if ($r -lt 90 -and $g -lt 70 -and $b -gt 50 -and $b -gt $r -and ($r + $g + $b) -lt 220) { return $true }
  if ($r -lt 120 -and $g -lt 100 -and $b -lt 140 -and ($r + $g + $b) -lt 200 -and ($b - $r) -gt 10) { return $true }
  return $false
}

$input = Join-Path $PSScriptRoot '..\hurdle-sprite-new.jpg'
$tmp = Join-Path $PSScriptRoot '..\hurdle-sprite-tmp.png'
$outPng = Join-Path $PSScriptRoot '..\hurdle-sprite.png'
$src = New-Object System.Drawing.Bitmap($input)
$dst = New-Object System.Drawing.Bitmap($src.Width, $src.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

for ($y = 0; $y -lt $src.Height; $y++) {
  for ($x = 0; $x -lt $src.Width; $x++) {
    $c = $src.GetPixel($x, $y)
    if (-not (IsHurdleBg $c.R $c.G $c.B)) {
      $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $c.R, $c.G, $c.B))
    }
  }
}

for ($pass = 0; $pass -lt 3; $pass++) {
  $copy = $dst.Clone()
  for ($y = 0; $y -lt $dst.Height; $y++) {
    for ($x = 0; $x -lt $dst.Width; $x++) {
      $c = $copy.GetPixel($x, $y)
      if ($c.A -eq 0) { continue }
      $near = $false
      foreach ($d in @(@(-1, 0), @(1, 0), @(0, -1), @(0, 1))) {
        $nx = $x + $d[0]; $ny = $y + $d[1]
        if ($nx -ge 0 -and $ny -ge 0 -and $nx -lt $dst.Width -and $ny -lt $dst.Height) {
          if ($copy.GetPixel($nx, $ny).A -eq 0) { $near = $true; break }
        }
      }
      if ($near -and (IsHurdleBg $c.R $c.G $c.B)) {
        $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
      }
    }
  }
}

$left = 9999; $right = -1; $top = 9999; $bottom = -1
for ($y = 0; $y -lt $dst.Height; $y++) {
  for ($x = 0; $x -lt $dst.Width; $x++) {
    if ($dst.GetPixel($x, $y).A -gt 0) {
      if ($x -lt $left) { $left = $x }
      if ($x -gt $right) { $right = $x }
      if ($y -lt $top) { $top = $y }
      if ($y -gt $bottom) { $bottom = $y }
    }
  }
}

$dst.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
$src.Dispose(); $dst.Dispose()
Move-Item $tmp $outPng -Force
$sw = $right - $left + 1
$sh = $bottom - $top + 1
$feetX = [int](($left + $right) / 2)
$feetY = $bottom + 1
Write-Output "Wrote $outPng"
Write-Output "HURDLE_SPRITE: sx=$left sy=$top sw=$sw sh=$sh feetX=$feetX feetY=$feetY"