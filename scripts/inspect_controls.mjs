import { connect, localSocket } from '../extension/cdp.mjs';

async function inspectWindowControls() {
  const port = 56281;
  const list = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
  const client = await connect(localSocket(list[0].webSocketDebuggerUrl, port));
  const res = await client.call('Runtime.evaluate', {
    expression: `(() => {
      // Find top-right elements
      const all = Array.from(document.querySelectorAll('*'));
      const topRights = all.filter(e => {
        const rect = e.getBoundingClientRect();
        return rect.top >= 0 && rect.top <= 50 && rect.right >= (window.innerWidth - 160) && rect.width > 20 && rect.height > 15;
      });
      return topRights.map(e => ({
        tag: e.tagName,
        cls: e.className,
        id: e.id,
        bg: window.getComputedStyle(e).backgroundColor,
        color: window.getComputedStyle(e).color,
        rect: { top: e.getBoundingClientRect().top, right: e.getBoundingClientRect().right, width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height }
      }));
    })()`,
    returnByValue: true
  });
  console.log(JSON.stringify(res.result.value, null, 2));
  client.close();
}

inspectWindowControls().catch(console.error);
