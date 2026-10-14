import { connect, localSocket } from '../extension/cdp.mjs';

async function find() {
  const port = 56281;
  const list = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
  const client = await connect(localSocket(list[0].webSocketDebuggerUrl, port));
  const res = await client.call('Runtime.evaluate', {
    expression: `(() => {
      const all = Array.from(document.querySelectorAll('*'));
      return all.filter(e => /close|minimize|maximize|window/i.test(e.className + ' ' + e.id + ' ' + (e.getAttribute('aria-label') || ''))).map(e => ({
        tag: e.tagName,
        cls: e.className,
        id: e.id,
        aria: e.getAttribute('aria-label'),
        bg: window.getComputedStyle(e).backgroundColor,
        rect: { top: e.getBoundingClientRect().top, right: e.getBoundingClientRect().right, width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height }
      })).slice(0, 15);
    })()`,
    returnByValue: true
  });
  console.log(JSON.stringify(res.result.value, null, 2));
  client.close();
}
find().catch(console.error);
