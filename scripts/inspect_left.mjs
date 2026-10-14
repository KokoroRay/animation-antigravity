import { connect, localSocket } from '../extension/cdp.mjs';

async function inspectLeft() {
  const port = 56281;
  const list = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
  const client = await connect(localSocket(list[0].webSocketDebuggerUrl, port));
  const res = await client.call('Runtime.evaluate', {
    expression: `(() => {
      // Find all left columns/elements (x < 350)
      const all = Array.from(document.querySelectorAll('*'));
      const leftElements = all.filter(e => {
        const rect = e.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= 350 && rect.height > 200 && rect.width > 30;
      });
      return leftElements.map(e => ({
        tag: e.tagName,
        cls: e.className,
        id: e.id,
        bg: window.getComputedStyle(e).backgroundColor,
        color: window.getComputedStyle(e).color,
        border: window.getComputedStyle(e).borderRight,
        rect: { left: e.getBoundingClientRect().left, width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height }
      }));
    })()`,
    returnByValue: true
  });
  console.log(JSON.stringify(res.result.value, null, 2));
  client.close();
}
inspectLeft().catch(console.error);
