import { execSync } from 'node:child_process';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';

const projectDir = process.cwd();
const vbsPath = join(projectDir, 'Start-Antigravity.vbs');

const antigravityExeCandidates = [
  join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'Programs', 'Antigravity', 'Antigravity.exe'),
  'C:\\Users\\Admin\\AppData\\Local\\Programs\\Antigravity\\Antigravity.exe'
];

let iconExe = antigravityExeCandidates.find(p => existsSync(p)) || 'shell32.dll,220';

console.log('========================================================');
console.log('    CÀI ĐẶT PHÍM TẮT KHỞI ĐỘNG ANTIGRAVITY TỰ ĐỘNG      ');
console.log('========================================================\n');
console.log(`[Thư mục dự án]: ${projectDir}`);
console.log(`[Icon]: ${iconExe}`);

const psScript = `
$wsh = New-Object -ComObject WScript.Shell
$desktop = [System.Environment]::GetFolderPath('Desktop')
$startMenu = Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs'

$targetShortcuts = @(
  (Join-Path $desktop 'Antigravity.lnk'),
  (Join-Path ([System.Environment]::GetFolderPath('UserProfile')) 'OneDrive\\Desktop\\Antigravity.lnk'),
  (Join-Path $startMenu 'Antigravity.lnk'),
  (Join-Path $startMenu 'Antigravity\\Antigravity.lnk'),
  (Join-Path $startMenu 'Antigravity\\Antigravity IDE.lnk')
)

foreach ($scPath in $targetShortcuts) {
  $parent = Split-Path -Parent $scPath
  if (Test-Path $parent) {
    try {
      if (Test-Path $scPath) {
        Set-ItemProperty -Path $scPath -Name Attributes -Value Normal -ErrorAction SilentlyContinue
      }
      $sc = $wsh.CreateShortcut($scPath)
      $sc.TargetPath = 'wscript.exe'
      $sc.Arguments = '"${vbsPath}"'
      $sc.WorkingDirectory = '${projectDir}'
      $sc.Description = 'Khoi chay Google Antigravity voi hieu ung mo dau Anime va theme tu dong'
      $sc.IconLocation = '${iconExe},0'
      $sc.Save()
      Set-ItemProperty -Path $scPath -Name Attributes -Value ([System.IO.FileAttributes]::ReadOnly) -ErrorAction SilentlyContinue
      Write-Host "[Da cau hinh & khoa ReadOnly]: $scPath" -ForegroundColor Green
    } catch {
      Write-Host "[Bo qua]: $scPath ($($_.Exception.Message))" -ForegroundColor Yellow
    }
  }
}

`;

const tempPs1 = join(tmpdir(), `install_antigravity_shortcuts_${Date.now()}.ps1`);
try {
  writeFileSync(tempPs1, psScript, 'utf8');
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tempPs1}"`, { stdio: 'inherit' });
  console.log('\n[HOÀN TẤT] Giờ đây bạn có thể mở Antigravity bằng cách:');
  console.log('  1. Bấm đúp chuột vào biểu tượng Antigravity trên màn hình Desktop');
  console.log('  2. Hoặc tìm "Antigravity" trong Start Menu và bấm mở');
  console.log('  3. Hoặc chạy file Start-Antigravity.bat / Start-Antigravity.vbs');
  console.log('Tất cả đều sẽ tự động kích hoạt hiệu ứng mở đầu Anime và theme Aura!');
} catch (err) {
  console.error('[Lỗi cài đặt shortcut]:', err.message);
} finally {
  try { unlinkSync(tempPs1); } catch (_) {}
}
