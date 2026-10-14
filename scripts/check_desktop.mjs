import { execSync } from 'node:child_process';
const ps = `
$wsh = New-Object -ComObject WScript.Shell
$sc = $wsh.CreateShortcut('C:\\Users\\Admin\\Desktop\\Antigravity.lnk')
Write-Host "Target: $($sc.TargetPath)"
Write-Host "Args: $($sc.Arguments)"
`;
const out = execSync(`powershell -NoProfile -Command "${ps.trim()}"`, { encoding: 'utf8' });
console.log(out);
