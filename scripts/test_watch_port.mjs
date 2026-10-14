import { watchAndInject } from '../extension/run.mjs';

async function main() {
  console.log('[Test Watch] Running watchAndInject on port 59260...');
  // We first dispose any existing extension in the window
  const res = await fetch('http://127.0.0.1:59260/json/list');
  const targets = await res.json();
  const page = targets.find(t => t.type === 'page');
  if (page) {
    const { connect, localSocket } = await import('../extension/cdp.mjs');
    const client = await connect(localSocket(page.webSocketDebuggerUrl, 59260));
    await client.call('Runtime.enable');
    await client.call('Runtime.evaluate', {
      expression: 'if (window.__antigravityExtension) window.__antigravityExtension.dispose();'
    });
    client.close();
    console.log('[Test Watch] Disposed previous extension.');
  }

  // Now run watchAndInject with isInitialLaunch = true
  await watchAndInject(59260, true);
}

main().catch(console.error);
