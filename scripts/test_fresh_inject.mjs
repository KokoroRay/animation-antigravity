import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, localSocket } from '../extension/cdp.mjs';
import { buildInjection } from '../extension/payload.mjs';
import { getMediaServer } from '../extension/media-server.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

async function main() {
  const mediaServer = await getMediaServer(root);
  const sourceIntro = await buildInjection(root, { mediaUrl: mediaServer.url, skipIntro: false });

  const res = await fetch('http://127.0.0.1:50242/json/list');
  const list = await res.json();
  const page = list.find(t => t.type === 'page');
  if (!page) {
    console.log('No page target found');
    return;
  }

  const client = await connect(localSocket(page.webSocketDebuggerUrl, 50242));
  await client.call('Runtime.enable');
  await client.call('Page.enable');

  client.on('Runtime.consoleAPICalled', params => {
    const text = params.args?.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
    console.log('[BROWSER CONSOLE]', params.type, text);
  });

  client.on('Runtime.exceptionThrown', params => {
    console.error('[BROWSER EXCEPTION]', JSON.stringify(params.exceptionDetails));
  });

  console.log('Disposing previous extension...');
  await client.call('Runtime.evaluate', {
    expression: 'if (window.__antigravityExtension) window.__antigravityExtension.dispose();'
  });

  console.log('Injecting fresh sourceIntro into target:', page.id);
  const evalResult = await client.call('Runtime.evaluate', {
    expression: sourceIntro,
    returnByValue: true,
    awaitPromise: true
  });
  console.log('Eval result:', evalResult);

  // Poll status every 250ms for 16 seconds
  for (let i = 0; i < 64; i++) {
    await new Promise(r => setTimeout(r, 250));
    const status = await client.call('Runtime.evaluate', {
      expression: 'Boolean(globalThis.__antigravityExtension) ? JSON.stringify(globalThis.__antigravityExtension.status()) : "NOT_INJECTED"',
      returnByValue: true
    }).catch(e => ({ error: e.message }));

    const iframeInfo = await client.call('Runtime.evaluate', {
      expression: `(() => {
        const frame = document.getElementById('antigravity-extension-overlay');
        if (!frame) return { frame: false };
        const win = frame.contentWindow;
        if (!win) return { frame: true, win: false };
        const v = win.document.querySelector('.character-video');
        const mv = win.document.querySelector('.master-cinematic-video');
        const err = win.__lastError;
        return {
          frame: true,
          win: true,
          videoSrc: v?.src,
          videoPaused: v?.paused,
          videoCurrentTime: v?.currentTime,
          videoReadyState: v?.readyState,
          videoDuration: v?.duration,
          videoError: v?.error ? (v.error.message || v.error.code) : null,
          timeText: win.document.querySelector('#timecode')?.textContent,
          statusText: win.document.querySelector('#sync-status')?.textContent,
          completed: win.completed
        };
      })()`,
      returnByValue: true
    }).catch(e => ({ error: e.message }));

    console.log(`[t = ${(i * 0.25 + 0.25).toFixed(2)}s] Status:`, status?.result?.value, '| Iframe:', JSON.stringify(iframeInfo?.result?.value));
    
    // If overlay disappears early, log why!
    const st = status?.result?.value ? JSON.parse(status.result.value) : null;
    if (st && st.completed && i < 40) {
      console.log('COMPLETED EARLY! Breaking to inspect.');
      break;
    }
  }

  client.close();
  mediaServer.close();
}

main().catch(console.error);
