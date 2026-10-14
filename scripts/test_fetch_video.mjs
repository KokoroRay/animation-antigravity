import { connect, localSocket } from '../extension/cdp.mjs';
import { getMediaServer } from '../extension/media-server.mjs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

async function main() {
  const port = 50326;
  const srv = await getMediaServer(root);
  console.log('Active media server:', srv.url);

  const res = await fetch(`http://127.0.0.1:${port}/json/list`);
  const list = await res.json();
  const page = list.find(t => t.type === 'page');
  const client = await connect(localSocket(page.webSocketDebuggerUrl, port));
  await client.call('Runtime.enable');

  const evalRes = await client.call('Runtime.evaluate', {
    expression: `(async () => {
      async function testVid(url) {
        const v = document.createElement('video');
        v.muted = true;
        v.autoplay = true;
        v.playsInline = true;
        let canplay = false, err = null;
        v.addEventListener('canplay', () => { canplay = true; });
        v.addEventListener('error', () => { err = v.error ? { code: v.error.code, message: v.error.message } : 'err'; });
        v.src = url;
        document.body.appendChild(v);
        await new Promise(r => setTimeout(r, 1200));
        const res = { ready: v.readyState, paused: v.paused, time: v.currentTime, dur: v.duration, canplay, err };
        v.remove();
        return res;
      }

      async function testBlob(url) {
        try {
          const resp = await fetch(url);
          const blob = await resp.blob();
          const blobUrl = URL.createObjectURL(blob);
          const r = await testVid(blobUrl);
          URL.revokeObjectURL(blobUrl);
          return { ...r, blobSize: blob.size };
        } catch (e) {
          return { blobErr: e.message };
        }
      }

      return {
        startupHttp: await testVid('${srv.url}/startup-video.mp4'),
        wallpaperHttp: await testVid('${srv.url}/wallpaper-tiktok.mp4'),
        startupBlob: await testBlob('${srv.url}/startup-video.mp4'),
        wallpaperBlob: await testBlob('${srv.url}/wallpaper-tiktok.mp4')
      };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Test in page:', evalRes?.result?.value);
  client.close();
}

main().catch(console.error);
