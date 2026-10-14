import { spawn, execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const launcherScript = join(root, 'bin/launcher.mjs');

async function main() {
  console.log('[Diagnose Boot] Killing existing Antigravity and node launcher...');
  try {
    execSync('taskkill /F /IM Antigravity.exe /T', { stdio: 'ignore' });
  } catch (_) {}
  try {
    execSync('powershell -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like \\"*launcher.mjs*\\" -and $_.ProcessId -ne $PID } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"', { stdio: 'ignore' });
  } catch (_) {}
  await new Promise(r => setTimeout(r, 1500));

  console.log('[Diagnose Boot] Spawning bin/launcher.mjs with stdio pipe...');
  const child = spawn(process.execPath, [launcherScript], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', data => {
    process.stdout.write(`[LAUNCHER STDOUT] ${data}`);
  });

  child.stderr.on('data', data => {
    process.stderr.write(`[LAUNCHER STDERR] ${data}`);
  });

  // Let it run for 18 seconds to capture the full startup sequence and cut-off point
  await new Promise(r => setTimeout(r, 18000));
  console.log('[Diagnose Boot] Finished 18s capture window.');
}

main().catch(console.error);
