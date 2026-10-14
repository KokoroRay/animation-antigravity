#!/usr/bin/env node
import { spawn, execSync } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, platform, tmpdir } from 'node:os';
import { injectIntoPort } from '../extension/run.mjs';

const LOCK_FILE = join(tmpdir(), 'antigravity-launcher.lock');

function acquireLock() {
  if (existsSync(LOCK_FILE)) {
    try {
      const data = JSON.parse(readFileSync(LOCK_FILE, 'utf8'));
      const pid = data.pid;
      if (pid && typeof pid === 'number') {
        try {
          process.kill(pid, 0);
          console.log(`[Thông báo] Trình khởi chạy Antigravity đang hoạt động (PID: ${pid}). Bỏ qua phiên gọi trùng lặp.`);
          process.exit(0);
        } catch (_) {
          // Process does not exist anymore; stale lock
        }
      }
    } catch (_) {}
  }

  try {
    writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, time: Date.now() }), 'utf8');
  } catch (_) {}

  const cleanup = () => {
    try {
      if (existsSync(LOCK_FILE)) {
        const data = JSON.parse(readFileSync(LOCK_FILE, 'utf8'));
        if (data.pid === process.pid) unlinkSync(LOCK_FILE);
      }
    } catch (_) {}
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });
}

// Find Antigravity executable on current OS
function findAntigravityPath() {
  const os = platform();

  if (os === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local');
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const candidates = [
      join(localAppData, 'Programs', 'Antigravity', 'Antigravity.exe'),
      join(localAppData, 'Antigravity', 'Antigravity.exe'),
      join(programFiles, 'Antigravity', 'Antigravity.exe'),
      'C:\\Users\\Admin\\AppData\\Local\\Programs\\Antigravity\\Antigravity.exe'
    ];
    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
  } else if (os === 'darwin') {
    const candidates = [
      '/Applications/Antigravity.app/Contents/MacOS/Antigravity',
      join(homedir(), 'Applications/Antigravity.app/Contents/MacOS/Antigravity')
    ];
    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
  } else {
    // Linux
    const candidates = [
      '/usr/bin/antigravity',
      '/opt/antigravity/antigravity',
      join(homedir(), '.local/share/antigravity/antigravity')
    ];
    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
  }

  return null;
}

// Find a free TCP port on 127.0.0.1
async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(err => (err ? reject(err) : resolve(port)));
    });
  });
}

// Check if an existing Antigravity process already has a CDP port enabled
function getExistingCdpPort() {
  const os = platform();
  if (os === 'win32') {
    try {
      const stdout = execSync(
        `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='Antigravity.exe'\\" | Select-Object ProcessId, CommandLine | ConvertTo-Json -Compress"`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
      ).trim();
      if (!stdout) return null;
      const list = JSON.parse(stdout);
      const procs = Array.isArray(list) ? list : [list];
      for (const p of procs) {
        const match = (p.CommandLine || '').match(/--remote-debugging-port=(\d+)/);
        if (match) {
          const port = parseInt(match[1], 10);
          if (port > 0) return port;
        }
      }
    } catch (_) {}
  }
  return null;
}

// A normal Antigravity window cannot be attached to after it has started.
// Starting another copy with CDP flags can leave a second, invisible process
// with no page targets, so detect that case before attempting injection.
function getAntigravityMainProcesses() {
  if (platform() !== 'win32') return [];
  try {
    const stdout = execSync(
      `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='Antigravity.exe'\\" | Select-Object ProcessId, CommandLine | ConvertTo-Json -Compress"`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    ).trim();
    if (!stdout) return [];
    const result = JSON.parse(stdout);
    const list = Array.isArray(result) ? result : [result];
    return list.filter(p => p.CommandLine && !p.CommandLine.includes('--type='));
  } catch (_) {
    return [];
  }
}

function showWindowsMessage(title, message) {
  if (platform() !== 'win32') return;
  try {
    const title64 = Buffer.from(title, 'utf8').toString('base64');
    const message64 = Buffer.from(message, 'utf8').toString('base64');
    const script = `Add-Type -AssemblyName PresentationFramework; $t=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${title64}')); $m=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${message64}')); [System.Windows.MessageBox]::Show($m, $t, 'OK', 'Warning') | Out-Null`;
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    execSync(`powershell -NoProfile -EncodedCommand ${encoded}`, { stdio: 'ignore' });
  } catch (_) {}
}

// Check existing Antigravity instance with CDP
async function ensureNoConflictingInstance() {
  try {
    const existingPort = getExistingCdpPort();
    if (existingPort) {
      console.log(`[Thông báo] Phát hiện Antigravity đang chạy với cổng gỡ lỗi CDP: ${existingPort}.`);
      console.log('>> Tái sử dụng phiên hiện tại (không tắt ứng dụng)...');
      return existingPort;
    }
  } catch (_) {}
  return null;
}

async function main() {
  acquireLock();

  console.log('========================================================');
  console.log('       ANTIGRAVITY CUSTOM STARTUP LAUNCHER             ');
  console.log('========================================================\n');

  const customPathArg = process.argv.indexOf('--app-path');
  const appPath = customPathArg >= 0 ? process.argv[customPathArg + 1] : findAntigravityPath();

  if (!appPath || !existsSync(appPath)) {
    console.error('[LỖI] Không tìm thấy ứng dụng Antigravity trên máy tính.');
    console.error('Bạn có thể truyền đường dẫn thủ công bằng:');
    console.error('  node bin/launcher.mjs --app-path "C:\\path\\to\\Antigravity.exe"\n');
    process.exit(1);
  }

  console.log(`[1/4] Đã phát hiện Antigravity: ${appPath}`);

  const runningMainProcesses = getAntigravityMainProcesses();
  const runningWithoutCdp = runningMainProcesses.filter(p => !/--remote-debugging-port=\d+/.test(p.CommandLine || ''));
  if (runningWithoutCdp.length) {
    const pids = runningWithoutCdp.map(p => p.ProcessId).join(', ');
    const message = `Antigravity đang mở trực tiếp (PID ${pids}) nên không thể tiêm hoạt cảnh vào phiên này.\n\nHãy lưu công việc, đóng tất cả cửa sổ Antigravity, đợi ứng dụng thoát hẳn, rồi mở lại bằng biểu tượng Antigravity trên Desktop hoặc Start Menu.`;
    console.error(`[LỖI] ${message.replaceAll('\n', ' ')}`);
    showWindowsMessage('Cần khởi động lại Antigravity', message);
    process.exitCode = 2;
    return;
  }

  // Check existing instances
  const existingPort = await ensureNoConflictingInstance();
  let port = existingPort;

  if (port) {
    console.log(`[2/4] Sử dụng cổng gỡ lỗi CDP hiện hữu: 127.0.0.1:${port}`);
  } else {
    port = await getFreePort();
    console.log(`[2/4] Cấp phát cổng gỡ lỗi CDP: 127.0.0.1:${port}`);

    // Launch Antigravity with remote debugging enabled
    console.log('[3/4] Đang khởi chạy Antigravity với cổng CDP...');
    const child = spawn(appPath, [
      `--remote-debugging-address=127.0.0.1`,
      `--remote-debugging-port=${port}`,
      `--background-color=#000000`,
      `--force-dark-mode`,
      `--enable-features=WebUIDarkMode`
    ], {
      detached: true,
      stdio: 'ignore'
    });

    child.unref();
  }

  console.log('[4/4] Đang kết nối và tiêm hoạt cảnh khởi động vào Antigravity...');
  try {
    await injectIntoPort(port);
  } catch (err) {
    console.error('\n[Lỗi kết nối]', err.message);
    showWindowsMessage(
      'Không khởi chạy được hoạt cảnh Antigravity',
      `Launcher không tìm thấy trang Antigravity để gắn hoạt cảnh.\n\n${err.message}\n\nHãy đóng hoàn toàn Antigravity rồi mở lại bằng shortcut launcher.`
    );
    process.exit(1);
  }
}

main();
