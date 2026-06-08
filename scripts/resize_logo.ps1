Add-Type -AssemblyName System.Drawing
$srcPath = "C:\Users\convidado 1\Documents\zherkeysite\public\logo.png"
$backupPath = "C:\Users\convidado 1\Documents\zherkeysite\public\logo_original.png"
$destPath = "C:\Users\convidado 1\Documents\zherkeysite\public\logo.png"

# Backup original logo if it hasn't been backed up yet
if (!(Test-Path $backupPath)) {
    Copy-Item $srcPath $backupPath
    Write-Host "Backup created at logo_original.png"
}

# Load from backup to avoid resizing a resized image
$image = [System.Drawing.Image]::FromFile($backupPath)

# Resize to high-quality 256x256 PNG
$resized = New-Object System.Drawing.Bitmap(256, 256)
$graph = [System.Drawing.Graphics]::FromImage($resized)

# Enable high quality resizing settings
$graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graph.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graph.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graph.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

$graph.DrawImage($image, 0, 0, 256, 256)

# Dispose old file handles to allow overwriting
$image.Dispose()

# Overwrite logo.png with optimized version
$resized.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
$resized.Dispose()
$graph.Dispose()

Write-Host "Logo optimized successfully!"
