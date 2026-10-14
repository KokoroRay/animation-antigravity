import { connect, localSocket } from '../extension/cdp.mjs';

async function main() {
  const port = process.argv[2] ? Number(process.argv[2]) : 50326;
  const res = await fetch(`http://127.0.0.1:${port}/json/list`);
  const list = await res.json();
  const page = list.find(t => t.type === 'page');
  const client = await connect(localSocket(page.webSocketDebuggerUrl, port));
  await client.call('Runtime.enable');

  const evalRes = await client.call('Runtime.evaluate', {
    expression: `(() => {
      const ext = window.__antigravityExtension;
      const overlay = document.getElementById('antigravity-extension-overlay');
      const curtain = document.getElementById('antigravity-pre-curtain');
      const liveVid = document.getElementById('antigravity-live-video-wallpaper');
      const themeBtn = document.getElementById('antigravity-theme-toggle-btn');
      return {
        hasExtension: Boolean(ext),
        status: ext ? ext.status() : null,
        hasOverlay: Boolean(overlay),
        hasCurtain: Boolean(curtain),
        hasLiveVid: Boolean(liveVid),
        liveVidSrc: liveVid?.src,
        liveVidPaused: liveVid?.paused,
        liveVidReadyState: liveVid?.readyState,
        hasThemeBtn: Boolean(themeBtn)
      };
    })()`,
    returnByValue: true
  });

  const val = evalRes.result.value;
  console.log('hasExtension:', val.hasExtension);
  console.log('status:', JSON.stringify(val.status));
  console.log('hasOverlay:', val.hasOverlay);
  console.log('hasCurtain:', val.hasCurtain);
  console.log('hasLiveVid:', val.hasLiveVid);
  console.log('liveVidSrc:', val.liveVidSrc);
  console.log('liveVidPaused:', val.liveVidPaused);
  console.log('liveVidReadyState:', val.liveVidReadyState);
  console.log('hasThemeBtn:', val.hasThemeBtn);

  client.close();
}

main().catch(console.error);
