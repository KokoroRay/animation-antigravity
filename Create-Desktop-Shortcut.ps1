# Script to create a Desktop shortcut for Antigravity Startup Animation
$ErrorActionPreference = 'Stop'

$scriptDir = $PSScriptRoot
$targetVbs = Join-Path $scriptDir "Start-Antigravity.vbs"
$desktopPath = [System.Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktopPath "Antigravity.lnk"

$antigravityExe = "C:\Users\Admin\AppData\Local\Programs\Antigravity\Antigravity.exe"
if (-not (Test-Path $antigravityExe)) {
    $antigravityExe = Join-Path $env:LOCALAPPDATA "Programs\Antigravity\Antigravity.exe"
}

$WshShell = New-Object -ComObject WScript.Shell
$shortcuts = @(
    (Join-Path $desktopPath "Antigravity.lnk"),
    (Join-Path ([System.Environment]::GetFolderPath('UserProfile')) "OneDrive\Desktop\Antigravity.lnk"),
    (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Antigravity.lnk"),
    (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Antigravity\Antigravity.lnk"),
    (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Antigravity\Antigravity IDE.lnk")
)

foreach ($scPath in $shortcuts) {
    $parent = Split-Path -Parent $scPath
    if (Test-Path $parent) {
        if (Test-Path $scPath) {
            Set-ItemProperty -Path $scPath -Name Attributes -Value Normal -ErrorAction SilentlyContinue
        }
        $Shortcut = $WshShell.CreateShortcut($scPath)
        $Shortcut.TargetPath = "wscript.exe"
        $Shortcut.Arguments = "`"$targetVbs`""
        $Shortcut.WorkingDirectory = $scriptDir
        $Shortcut.Description = "Khoi chay Google Antigravity voi hieu ung mo dau Anime va theme tu dong"
        if (Test-Path $antigravityExe) {
            $Shortcut.IconLocation = "$antigravityExe,0"
        }
        $Shortcut.Save()
        Set-ItemProperty -Path $scPath -Name Attributes -Value ([System.IO.FileAttributes]::ReadOnly) -ErrorAction SilentlyContinue
        Write-Host " [OK] $scPath" -ForegroundColor Green
    }
}

Write-Host "==========================================================" -ForegroundColor Green
Write-Host " [THANH CONG] Da tao & khoa Shortcut tai tat ca vi tri!" -ForegroundColor Cyan
Write-Host " Gio day khi ban go Antigravity tren Windows hoac nhap vao"
Write-Host " Desktop / Start Menu se luon chay launcher tuy bien!"
Write-Host "==========================================================" -ForegroundColor Green
