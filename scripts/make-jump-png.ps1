Add-Type -AssemblyName System.Drawing
function IsNavy($r,$g,$b) {
  $d=[math]::Abs($r-26)+[math]::Abs($g-27)+[math]::Abs($b-48)
  if ($d -lt 95) { return $true }
  if ($b -ge $r -and $b -ge $g -and $r -lt 70 -and $g -lt 75 -and $b -lt 115 -and ($r+$g+$b) -lt 210) { return $true }
  return $false
}
$input = Join-Path $PSScriptRoot "..\sunny-jump-sprites.jpg"
$tmp = Join-Path $PSScriptRoot "..\sunny-jump-sprites-tmp.png"
$outPng = Join-Path $PSScriptRoot "..\sunny-jump-sprites.png"
$src = New-Object System.Drawing.Bitmap($input)
$dst = New-Object System.Drawing.Bitmap($src.Width, $src.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
for ($y=0; $y -lt $src.Height; $y++) {
  for ($x=0; $x -lt $src.Width; $x++) {
    $c = $src.GetPixel($x,$y)
    if (-not (IsNavy $c.R $c.G $c.B)) {
      $dst.SetPixel($x,$y, [System.Drawing.Color]::FromArgb(255,$c.R,$c.G,$c.B))
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
Write-Output "Wrote $outPng"