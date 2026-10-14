import { execSync } from 'node:child_process';
const ps = `
$wsh = New-Object -ComObject WScript.Shell
Get-ChildItem -Path @(
  [Environment]::GetFolderPath('Desktop'),
  [Environment]::GetFolderPath('CommonDesktopDirectory'),
  (Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs'),
  (Join-Path $env:PROGRAMDATA 'Microsoft\\Windows\\Start Menu\\Programs')
) -Recurse -Filter "*.lnk" -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*anti*" -or $_.Name -like "*gravity*" } | ForEach-Object {
  $sc = $wsh.CreateShortcut($_.FullName)
  [PSCustomObject]@{
    LnkPath = $_.FullName
    TargetPath = $sc.TargetPath
    Arguments = $sc.Arguments
  }
} | ConvertTo-Json
`;
try {
  const out = execSync(`powershell -NoProfile -Command "${ps.trim()}"`, { encoding: 'utf8' }).trim();
  console.log(out);
} catch (e) {
  console.error(e.message);
}
