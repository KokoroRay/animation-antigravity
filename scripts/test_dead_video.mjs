import { connect, localSocket } from '../extension/cdp.mjs';
import { buildInjection } from '../extension/payload.mjs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

async function main() {
  const port = 59260;
  // Inject with a dead media server port to simulate the bug!
  const sourceIntro = await buildInjection(root, { mediaUrl: 'http://127.0.0.1:9999', skipIntro: false });

  const res = await fetch(`http://127.0.0.1:${port}/json/list`);
  const list = await res.json();
  const page = list.find(t => t.type === 'page');
  const client = await connect(localSocket(page.webSocketDebuggerUrl, port));
  await client.call('Runtime.enable');
  await client.call('Page.enable');

  client.on('Runtime.consoleAPICalled', params => {
    const text = params.args?.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
    console.log('[BROWSER CONSOLE]', text);
  });
  client.on('Runtime.exceptionThrown', params => {
    console.error('[BROWSER EXCEPTION]', params.exceptionDetails?.text, params.exceptionDetails?.exception?.description);
  });

  console.log('Disposing previous extension...');
  await client.call('Runtime.evaluate', {
    expression: 'if (window.__antigravityExtension) window.__antigravityExtension.dispose();'
  });

  console.log('Injecting sourceIntro with dead video port...');
  const evalRes = await client.call('Runtime.evaluate', {
    expression: sourceIntro,
    returnByValue: true,
    awaitPromise: true
  });
  console.log('Eval result:', evalRes.result.value);

  // Monitor for 8 seconds
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 350));
    const status = await client.call('Runtime.evaluate', {
      expression: 'Boolean(globalThis.__antigravityExtension) ? JSON.stringify(globalThis.__antigravityExtension.status()) : "NONE"',
      returnByValue: true
    });
    console.log(`[t = ${(i * 0.35 + 0.35).toFixed(2)}s] Status:`, status.result.value);
    const st = status.result.value ? JSON.parse(status.result.value) : null;
    if (st && st.completed && i < 20) {
      console.log('*** FAILED OR COMPLETED EARLY! ***');
      break;
    }
  }

  client.close();
}

main().catch(console.error);
