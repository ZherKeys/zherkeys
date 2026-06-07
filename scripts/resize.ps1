Add-Type -AssemblyName System.Drawing
$srcPath = "C:\Users\convidado 1\Documents\zherkeysite\public\logo.png"
$destPngPath = "C:\Users\convidado 1\Documents\zherkeysite\public\favicon.png"
$destIcoPath = "C:\Users\convidado 1\Documents\zherkeysite\public\favicon.ico"

# Resize to 48x48 PNG (multiple of 48px square as required by Google)
$image = [System.Drawing.Image]::FromFile($srcPath)
$resized = New-Object System.Drawing.Bitmap(48, 48)
$graph = [System.Drawing.Graphics]::FromImage($resized)
$graph.DrawImage($image, 0, 0, 48, 48)

$resized.Save($destPngPath, [System.Drawing.Imaging.ImageFormat]::Png)

# Resize to 48x48 ICO
$hIcon = $resized.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$fileStream = New-Object System.IO.FileStream($destIcoPath, [System.IO.FileMode]::Create)
$icon.Save($fileStream)
$fileStream.Close()
$icon.Dispose()

$image.Dispose()
$resized.Dispose()
$graph.Dispose()
Write-Host "Resized successfully to 48x48!"
