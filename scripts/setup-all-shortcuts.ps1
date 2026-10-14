$wsh = New-Object -ComObject WScript.Shell

$vbsPath = "D:\work\animation-antigravity\Start-Antigravity.vbs"
$projectDir = "D:\work\animation-antigravity"
$iconExe = "C:\Users\Admin\AppData\Local\Programs\Antigravity\Antigravity.exe"

$targetShortcuts = @(
  "$env:USERPROFILE\Desktop\Antigravity.lnk",
  "$env:USERPROFILE\OneDrive\Desktop\Antigravity.lnk",
  "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Antigravity.lnk",
  "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Antigravity\Antigravity.lnk",
  "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Antigravity\Antigravity IDE.lnk"
)

foreach ($scPath in $targetShortcuts) {
  $parent = Split-Path -Parent $scPath
  if (Test-Path $parent) {
    try {
      if (Test-Path $scPath) {
        # Strip ReadOnly so we can update it
        Set-ItemProperty -Path $scPath -Name Attributes -Value Normal -ErrorAction SilentlyContinue
      }
      $sc = $wsh.CreateShortcut($scPath)
      $sc.TargetPath = "wscript.exe"
      $sc.Arguments = "`"$vbsPath`""
      $sc.WorkingDirectory = $projectDir
      $sc.Description = "Google Antigravity voi hieu ung Neural Awakening va Live Anime Wallpaper"
      $sc.IconLocation = "$iconExe,0"
      $sc.Save()

      # Mark as ReadOnly to prevent Electron / Windows from overwriting it!
      Set-ItemProperty -Path $scPath -Name Attributes -Value ([System.IO.FileAttributes]::ReadOnly) -ErrorAction SilentlyContinue

      Write-Host "[OK] $scPath" -ForegroundColor Green
    } catch {
      Write-Host "[ERR] $scPath : $($_.Exception.Message)" -ForegroundColor Red
    }
  }
}

Write-Host "All shortcuts configured and locked with ReadOnly!" -ForegroundColor Cyan
