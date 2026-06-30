Add-Type -AssemblyName System.Drawing
function IsNavy($r,$g,$b) {
  $d=[math]::Abs($r-26)+[math]::Abs($g-27)+[math]::Abs($b-48)
  if ($d -lt 95) { return $true }
  if ($b -ge $r -and $b -ge $g -and $r -lt 70 -and $g -lt 75 -and $b -lt 115 -and ($r+$g+$b) -lt 210) { return $true }
  return $false
}
$input = Join-Path $PSScriptRoot '..\celebration-sprites-new.jpg'
$tmp = Join-Path $PSScriptRoot '..\celebration-sprites-tmp.png'
$outPng = Join-Path $PSScriptRoot '..\celebration-sprites.png'
$src = New-Object System.Drawing.Bitmap($input)
$dst = New-Object System.Drawing.Bitmap($src.Width, $src.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
for ($y=0; $y -lt $src.Height; $y++) {
  for ($x=0; $x -lt $src.Width; $x++) {
    $c = $src.GetPixel($x,$y)
    if (-not (IsNavy $c.R $c.G $c.B)) {
      $dst.SetPixel($x,$y,[System.Drawing.Color]::FromArgb(255,$c.R,$c.G,$c.B))
    }
  }
}
for ($pass=0; $pass -lt 3; $pass++) {
  $copy = $dst.Clone()
  for ($y=0; $y -lt $dst.Height; $y++) {
    for ($x=0; $x -lt $dst.Width; $x++) {
      $c = $copy.GetPixel($x,$y)
      if ($c.A -eq 0) { continue }
      $near=$false
      foreach ($d in @(@(-1,0),@(1,0),@(0,-1),@(0,1))) {
        $nx=$x+$d[0]; $ny=$y+$d[1]
        if ($nx -ge 0 -and $ny -ge 0 -and $nx -lt $dst.Width -and $ny -lt $dst.Height) {
          if ($copy.GetPixel($nx,$ny).A -eq 0) { $near=$true; break }
        }
      }
      if ($near -and (IsNavy $c.R $c.G $c.B)) {
        $dst.SetPixel($x,$y,[System.Drawing.Color]::FromArgb(0,0,0,0))
      }
    }
  }
}
$dst.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
$src.Dispose(); $dst.Dispose()
Move-Item $tmp $outPng -Force

# Frames sit in four equal columns — crop each quarter tightly so neighbors do not bleed in.
$bmp = New-Object System.Drawing.Bitmap($outPng)
$cellW = [math]::Floor($bmp.Width / 4)
$frames = @()
for ($fi=0; $fi -lt 4; $fi++) {
  $x0 = $fi * $cellW
  $x1 = $x0 + $cellW - 1
  $left=9999; $right=-1; $top=9999; $bottom=-1
  for ($y=0; $y -lt $bmp.Height; $y++) {
    for ($x=$x0; $x -le $x1; $x++) {
      if ($bmp.GetPixel($x,$y).A -eq 0) { continue }
      if ($x -lt $left) { $left=$x }
      if ($x -gt $right) { $right=$x }
      if ($y -lt $top) { $top=$y }
      if ($y -gt $bottom) { $bottom=$y }
    }
  }
  $frames += "{ sx: $left, sy: $top, sw: $($right-$left+1), sh: $($bottom-$top+1), feet: $($bottom+1) }"
}
Write-Output ($frames -join ",`n")
$bmp.Dispose()
Write-Output "Wrote $outPng"