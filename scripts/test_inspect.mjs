import { connect, localSocket } from '../extension/cdp.mjs';

async function main() {
  const port = process.argv[2] ? Number(process.argv[2]) : 50620;
  const res = await fetch(`http://127.0.0.1:${port}/json/list`);
  const list = await res.json();
  console.log('Targets:', list.map(t => ({ id: t.id, type: t.type, url: t.url, title: t.title })));
  const page = list.find(t => t.type === 'page');
  if (page) {
    const client = await connect(localSocket(page.webSocketDebuggerUrl, port));
    await client.call('Runtime.enable');
    const status = await client.call('Runtime.evaluate', {
      expression: 'Boolean(globalThis.__antigravityExtension) ? JSON.stringify(globalThis.__antigravityExtension.status()) : "NOT_INJECTED"',
      returnByValue: true
    });
    console.log('Status in page:', status?.result?.value);
    client.close();
  }
}

main().catch(console.error);
