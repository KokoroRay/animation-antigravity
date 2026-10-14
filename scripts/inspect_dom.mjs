import { connect, localSocket } from '../extension/cdp.mjs';

async function inspect() {
  const port = 56281;
  const list = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
  const client = await connect(localSocket(list[0].webSocketDebuggerUrl, port));
  const res = await client.call('Runtime.evaluate', {
    expression: `(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const pill = all.find(e => e.textContent && e.textContent.includes('take_screenshot') && e.children.length === 0);
      const windowControls = document.querySelector('.window-controls-container') || document.querySelector('[class*="window-control"]') || document.querySelector('.titlebar-right');
      
      const activityBar = document.querySelector('.part.activitybar') || document.querySelector('[aria-label="Activity Bar"]') || document.querySelector('[class*="activitybar"]');
      const sidebar = document.querySelector('.part.sidebar') || document.querySelector('[aria-label="Side Bar"]') || document.querySelector('[class*="sidebar"]');

      function info(el) {
        if (!el) return null;
        const cs = window.getComputedStyle(el);
        return {
          tag: el.tagName,
          id: el.id,
          cls: el.className,
          bg: cs.backgroundColor,
          color: cs.color,
          border: cs.border,
          parent: el.parentElement ? { tag: el.parentElement.tagName, cls: el.parentElement.className, bg: window.getComputedStyle(el.parentElement).backgroundColor } : null
        };
      }

      return {
        pillTarget: info(pill?.parentElement || pill),
        windowControls: info(windowControls),
        activityBar: info(activityBar),
        sidebar: info(sidebar)
      };
    })()`,
    returnByValue: true
  });
  console.log(JSON.stringify(res.result.value, null, 2));
  client.close();
}

inspect().catch(console.error);
