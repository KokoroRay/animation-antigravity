import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { buildInjection } from './payload.mjs';
import { connect, pageTarget, localSocket } from './cdp.mjs';
import { getMediaServer } from './media-server.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// Total length of the startup animation (must match TOTAL_DURATION in animation.js)
const INTRO_MS = 10000;
// Hard safety cap: never keep trying to play the intro longer than this after launch
const INTRO_GIVE_UP_MS = 60000;

// ---------------------------------------------------------------------------
// Logging (launcher runs hidden via VBS, so also write to logs/launcher.log)
// ---------------------------------------------------------------------------
const LOG_DIR = join(root, 'logs');
const LOG_FILE = join(LOG_DIR, 'launcher.log');
try {
  mkdirSync(LOG_DIR, { recursive: true });
  writeFileSync(LOG_FILE, `=== Antigravity launcher ${new Date().toISOString()} ===\n`, 'utf8');
} catch (_) {}

function log(...args) {
  const line = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  console.log(line);
  try { appendFileSync(LOG_FILE, `[${new Date().toISOString().slice(11, 23)}] ${line}\n`, 'utf8'); } catch (_) {}
}

// ---------------------------------------------------------------------------
// Scripts
// ---------------------------------------------------------------------------
// Pure pitch-black curtain used while waiting for the page to settle (#000000)
function getCurtainScript() {
  return `(() => {
  if (window.top !== window) return;

  const hideSplashStyle = () => {
    if (document.getElementById('antigravity-anti-splash-style')) return true;
    const host = document.head || document.documentElement;
    if (!host) return false;
    const s = document.createElement('style');
    s.id = 'antigravity-anti-splash-style';
    s.textContent = 'html, body { background: #000000 !important; background-color: #000000 !important; } .monaco-workbench-splash, .splash-logo, .icon-wrapper, .icon-wrapper img, img[src*="icon"], img[src*="logo"], svg.splash-logo, [class*="splash"], [id*="splash"] { display: none !important; opacity: 0 !important; visibility: hidden !important; }';
    host.appendChild(s);
    return true;
  };

  const showCurtain = () => {
    if (!hideSplashStyle()) return false;
    if (document.getElementById('antigravity-pre-curtain') || document.getElementById('antigravity-extension-overlay')) return true;
    const host = document.body || document.documentElement;
    if (!host) return false;
    const c = document.createElement('div');
    c.id = 'antigravity-pre-curtain';
    c.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;background:#000000;z-index:2147483640;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"JetBrains Mono",monospace;user-select:none;';
    // Keep only a plain black handoff cover here. The Elaina GIF is used by
    // Antigravity's native loading view; adding it again here made both loaders overlap.
    host.appendChild(c);
    return true;
  };

  const mountCurtain = () => {
    if (showCurtain()) observer?.disconnect();
  };
  const observer = new MutationObserver(mountCurtain);
  observer.observe(document, { childList: true, subtree: true });
  mountCurtain();
  if (document.readyState === 'loading') {
    document.addEventListener('readystatechange', mountCurtain);
  }
})();`;
}

let CURTAIN_SCRIPT = getCurtainScript();

const REMOVE_CURTAIN = `(() => { document.getElementById('antigravity-pre-curtain')?.remove(); document.getElementById('antigravity-instant-curtain')?.remove(); })()`;

const STATUS_EXPR = `(() => {
  const e = globalThis.__antigravityExtension;
  if (!e) return { present: false };
  const s = e.status();
  return { present: true, intro: s.intro === true, ready: s.ready, completed: s.completed, phase: s.phase, overlay: s.overlay };
})()`;

// ---------------------------------------------------------------------------
// CDP helpers
// ---------------------------------------------------------------------------
async function openClient(target, port) {
  const client = await connect(localSocket(target.webSocketDebuggerUrl, port));
  await client.call('Runtime.enable');
  await client.call('Page.enable');

  // Immediately evaluate CURTAIN_SCRIPT so the Antigravity logo is blocked from frame 0!
  try {
    await client.call('Runtime.evaluate', { expression: CURTAIN_SCRIPT, returnByValue: true }, 1000);
  } catch (_) {}

  client.on('Runtime.consoleAPICalled', params => {
    const text = params.args?.map(a => a.value ?? a.description ?? JSON.stringify(a)).join(' ');
    if (text && text.includes('Antigravity')) log(`[PAGE ${target.id.slice(0, 6)}]`, text);
  });
  client.on('Runtime.exceptionThrown', params => {
    log(`[PAGE ${target.id.slice(0, 6)} EXCEPTION]`, params.exceptionDetails?.text || '', params.exceptionDetails?.exception?.description || '');
  });
  client.navigatedCount = 0;
  client.on('Page.frameNavigated', async params => {
    if (!params.frame?.parentId) {
      client.navigatedCount++;
      log(`[PAGE ${target.id.slice(0, 6)}] navigated ->`, params.frame?.url || '');
      try {
        await client.call('Runtime.evaluate', { expression: CURTAIN_SCRIPT, returnByValue: true }, 1000);
      } catch (_) {}
    }
  });

  // Binding used by the renderer to persist theme configuration to disk
  try {
    await client.call('Runtime.addBinding', { name: '__antigravitySaveDiskConfig' });
    client.on('Runtime.bindingCalled', async params => {
      if (params?.name !== '__antigravitySaveDiskConfig') return;
      try {
        const cfg = JSON.parse(params.payload);
        await writeFile(join(root, 'assets/user-config.json'), JSON.stringify(cfg, null, 2), 'utf8');
        log('[Antigravity] Đã lưu cấu hình theme vào assets/user-config.json');
      } catch (e) {
        log('[Antigravity] Lỗi ghi file cấu hình:', e.message);
      }
    });
  } catch (_) {}

  return client;
}

async function addNewDocScript(client, source) {
  try {
    const res = await client.call('Page.addScriptToEvaluateOnNewDocument', { source });
    return res?.identifier || null;
  } catch (_) {
    return null;
  }
}

async function removeNewDocScript(client, identifier) {
  if (!identifier) return;
  try { await client.call('Page.removeScriptToEvaluateOnNewDocument', { identifier }); } catch (_) {}
}

async function evaluate(client, expression, timeout = 2500) {
  const res = await client.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, timeout);
  if (res?.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text || 'evaluate failed');
  return res?.result?.value;
}

// ---------------------------------------------------------------------------
// Main watcher
// ---------------------------------------------------------------------------
export async function watchAndInject(port, isInitialLaunch = true) {
  const mediaServer = await getMediaServer(root);
  CURTAIN_SCRIPT = getCurtainScript();
  const [sourceIntro, sourceWallpaper] = await Promise.all([
    buildInjection(root, { mediaUrl: mediaServer.url, skipIntro: false }),
    buildInjection(root, { mediaUrl: mediaServer.url, skipIntro: true })
  ]);

  // targetId -> { client, curtainId, wallpaperId }
  const entries = new Map();
  const launchTime = Date.now();
  const deadline = launchTime + 45000;

  let introDone = !isInitialLaunch;
  let introTargetId = null;
  let introStartedAt = null;       // wall clock time when the intro first reported "ready"
  let lastIntroInjectAt = 0;
  let introInjectCount = 0;
  let firstWorkspaceSeenAt = null;
  let hasConnected = false;
  let consecutiveFailures = 0;

  async function getEntry(target) {
    let entry = entries.get(target.id);
    if (entry && entry.client && !entry.client.closed) return entry;
    if (entry?.client) { try { entry.client.close(); } catch (_) {} }
    const client = await openClient(target, port);
    const curtainId = await addNewDocScript(client, CURTAIN_SCRIPT);
    try { await evaluate(client, CURTAIN_SCRIPT, 1000); } catch (_) {}
    entry = { client, curtainId, wallpaperId: null };
    entries.set(target.id, entry);
    return entry;
  }

  function dropEntry(targetId) {
    const entry = entries.get(targetId);
    if (entry?.client) { try { entry.client.close(); } catch (_) {} }
    entries.delete(targetId);
  }

  async function finishIntro(reason) {
    if (introDone) return;
    introDone = true;
    log(`[Antigravity] Hoạt cảnh khởi động kết thúc (${reason}). Chuyển sang theme + live wallpaper.`);
    for (const entry of entries.values()) {
      await removeNewDocScript(entry.client, entry.curtainId);
      entry.curtainId = null;
      try { await evaluate(entry.client, REMOVE_CURTAIN); } catch (_) {}
    }
  }

  while (true) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
        signal: AbortSignal.timeout(2000),
        redirect: 'error'
      }).catch(() => null);

      if (!response || !response.ok) {
        if (hasConnected && ++consecutiveFailures >= 6) {
          log('[Antigravity] Phiên làm việc Antigravity đã đóng.');
          break;
        }
        if (!hasConnected && Date.now() > deadline) {
          throw new Error('Cổng gỡ lỗi CDP chưa sẵn sàng quá thời gian (timeout)');
        }
        await delay(300);
        continue;
      }

      if (!hasConnected) log(`[Antigravity] Đã kết nối CDP cổng ${port}`);
      hasConnected = true;
      consecutiveFailures = 0;

      const targets = await response.json();
      const validTargets = Array.isArray(targets) ? targets.filter(pageTarget) : [];
      if (!validTargets.length) {
        if (Date.now() > deadline) {
          const error = new Error('CDP đã mở nhưng không tìm thấy trang Antigravity. Có thể ứng dụng đang chạy từ một lần mở trực tiếp trước đó.');
          error.code = 'ERR_CDP_NO_TARGETS';
          throw error;
        }
        await delay(150);
        continue;
      }

      // Forget clients of targets that no longer exist
      for (const id of [...entries.keys()]) {
        if (!validTargets.some(t => t.id === id)) dropEntry(id);
      }

      // =====================================================================
      // PHASE 1: startup intro (survives page reloads by resuming)
      // =====================================================================
      if (!introDone) {
        if (Date.now() - launchTime > INTRO_GIVE_UP_MS) {
          await finishIntro('give-up timeout');
          continue;
        }

        const sectionTarget = validTargets.find(t => t.url?.includes('section='));
        const workspaceTarget = validTargets.find(t => t.url?.includes('/c/'));
        const mainTarget = sectionTarget || workspaceTarget || validTargets.find(t => t.id === introTargetId) || validTargets[0];
        introTargetId = mainTarget.id;

        if (workspaceTarget && !firstWorkspaceSeenAt) firstWorkspaceSeenAt = Date.now();

        let entry;
        try {
          entry = await getEntry(mainTarget);
        } catch (err) {
          log('[Antigravity] Không kết nối được target:', err.message);
          await delay(250);
          continue;
        }

        // Curtain on every new document while the intro is running (covers boot reloads)
        if (!entry.curtainId) entry.curtainId = await addNewDocScript(entry.client, CURTAIN_SCRIPT);

        const isWorkspace = Boolean(sectionTarget || workspaceTarget || mainTarget.url?.includes('/c/'));
        let hasAppMounted = false;
        try {
          hasAppMounted = await evaluate(entry.client, 'Boolean(document.getElementById("root")?.children?.length > 0 || document.querySelector(".monaco-workbench"))', 1500);
        } catch (_) {}

        // Only settle when workspace is active OR React app is mounted OR page has navigated to workspace OR max 3.5s after launch.
        const settled = isWorkspace ||
          hasAppMounted ||
          (entry.client.navigatedCount >= 1 && mainTarget.url?.length > 25) ||
          Date.now() - launchTime >= 3500;

        let status;
        try {
          status = await evaluate(entry.client, STATUS_EXPR);
        } catch (_) {
          // Execution context is being replaced (navigation in progress)
          if (entry.client.closed) dropEntry(mainTarget.id);
          await delay(150);
          continue;
        }

        if (!settled && !introStartedAt) {
          try { await evaluate(entry.client, CURTAIN_SCRIPT); } catch (_) {}
          await delay(150);
          continue;
        }

        if (status?.present && status.intro) {
          // Intro instance alive on the page
          if (status.ready && !introStartedAt) {
            introStartedAt = Date.now();
            log('[Antigravity] Hoạt cảnh Neural Awakening đang phát!');
          }
          if (status.completed) {
            await finishIntro('completed');
            continue;
          }
          // Intro injected but never became ready -> retry after a while
          if (!status.ready && !introStartedAt && Date.now() - lastIntroInjectAt > 8000) {
            log('[Antigravity] Intro chưa sẵn sàng sau 8s, tiêm lại...');
            try { await evaluate(entry.client, 'globalThis.__antigravityExtension?.dispose?.()'); } catch (_) {}
          }
          await delay(200);
          continue;
        }

        // No intro on the page: first injection, or the page reloaded and wiped it
        const rawElapsed = introStartedAt ? Date.now() - introStartedAt : 0;
        if (rawElapsed >= INTRO_MS - 700) {
          await finishIntro('page reloaded at the very end of the intro');
          continue;
        }
        if (Date.now() - lastIntroInjectAt < 700) {
          await delay(150);
          continue;
        }

        // Always play startup intro from 0.0s so the user never misses the beginning
        const elapsed = 0;

        lastIntroInjectAt = Date.now();
        introInjectCount++;
        log(introStartedAt && elapsed > 0
          ? `[Antigravity] Trang vừa tải lại giữa hoạt cảnh -> tiếp tục từ ${(elapsed / 1000).toFixed(2)}s (lần ${introInjectCount})`
          : `[Antigravity] Tiêm hoạt cảnh vào ${mainTarget.url}`);

        // Keep entry.curtainId active so any subsequent navigation during boot remains black with spinner!

        const expression =
          `globalThis.__antigravityExtension?.dispose?.();` +
          `globalThis.__antigravityStartAt = ${Math.max(0, Math.round(elapsed))};` +
          sourceIntro;
        try {
          const result = await evaluate(entry.client, expression, 15000);
          if (!result?.installed) log('[Antigravity] Tiêm intro không thành công:', result);
        } catch (err) {
          log('[Antigravity] Lỗi tiêm intro:', err.message);
        }
        await delay(200);
        continue;
      }

      // =====================================================================
      // PHASE 2: keep theme + live wallpaper alive on every window
      // =====================================================================
      for (const target of validTargets) {
        let entry;
        try {
          entry = await getEntry(target);
        } catch (_) {
          continue;
        }
        if (!entry.wallpaperId) entry.wallpaperId = await addNewDocScript(entry.client, sourceWallpaper);

        let present = false;
        try {
          present = await evaluate(entry.client, 'Boolean(globalThis.__antigravityExtension)');
        } catch (_) {
          if (entry.client.closed) dropEntry(target.id);
          continue;
        }
        if (!present) {
          log(`[Antigravity] Áp dụng theme + wallpaper cho ${target.id.slice(0, 6)} (${target.url})`);
          try {
            await evaluate(entry.client, REMOVE_CURTAIN);
            await evaluate(entry.client, sourceWallpaper, 15000);
          } catch (err) {
            log('[Antigravity] Lỗi áp dụng wallpaper:', err.message);
          }
        }
      }
    } catch (err) {
      log('[Antigravity] Lỗi vòng giám sát:', err.message);
      if (err.code === 'ERR_CDP_NO_TARGETS' || (!hasConnected && Date.now() > deadline)) throw err;
    }
    await delay(introDone ? 600 : 200);
  }

  for (const id of [...entries.keys()]) dropEntry(id);
  try { mediaServer.close(); } catch (_) {}
}

export async function injectIntoPort(port) {
  return watchAndInject(port, true);
}

async function main() {
  const portIndex = process.argv.indexOf('--port');
  const port = portIndex >= 0 ? Number(process.argv[portIndex + 1]) : 9222;
  await watchAndInject(port, true);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(err => {
    console.error('[Lỗi]', err.message);
    process.exitCode = 1;
  });
}
