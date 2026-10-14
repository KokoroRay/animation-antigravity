import { createServer } from 'node:http';
import { createReadStream, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

let activeServer = null;
let activePort = 0;

export function getMediaServer(root) {
  if (activeServer && activePort) {
    return Promise.resolve({
      port: activePort,
      url: `http://127.0.0.1:${activePort}`,
      close() {
        if (activeServer) {
          activeServer.close();
          activeServer = null;
          activePort = 0;
        }
      }
    });
  }

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
      res.setHeader('Cache-Control', 'public, max-age=3600');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const safePath = req.url.split('?')[0].replace(/^\/+/, '');
      const filePath = join(root, 'assets', safePath);

      if (!existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }

      try {
        const stat = statSync(filePath);
        const mime = filePath.endsWith('.mp4')
          ? 'video/mp4'
          : filePath.endsWith('.webm')
            ? 'video/webm'
            : filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')
              ? 'image/jpeg'
              : filePath.endsWith('.png')
                ? 'image/png'
                : filePath.endsWith('.gif')
                  ? 'image/gif'
                  : filePath.endsWith('.webp')
                    ? 'image/webp'
                    : 'application/octet-stream';

        const range = req.headers.range;

        if (range) {
          const match = range.match(/bytes=(\d*)-(\d*)/);
          let start, end;
          if (match) {
            if (match[1] === '') {
              // Suffix range: bytes=-500 (last 500 bytes)
              const suffix = parseInt(match[2], 10);
              start = Math.max(0, stat.size - suffix);
              end = stat.size - 1;
            } else if (match[2] === '') {
              // Prefix range: bytes=1000- (from 1000 to end)
              start = parseInt(match[1], 10);
              end = stat.size - 1;
            } else {
              // Explicit range: bytes=0-1000
              start = parseInt(match[1], 10);
              end = parseInt(match[2], 10);
            }
          }

          if (!match || isNaN(start) || isNaN(end) || start >= stat.size || end >= stat.size || start > end) {
            res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
            res.end();
            return;
          }

          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': (end - start) + 1,
            'Content-Type': mime
          });

          if (req.method === 'HEAD') {
            res.end();
            return;
          }

          createReadStream(filePath, { start, end }).pipe(res);
        } else {
          res.writeHead(200, {
            'Content-Length': stat.size,
            'Content-Type': mime,
            'Accept-Ranges': 'bytes'
          });

          if (req.method === 'HEAD') {
            res.end();
            return;
          }

          createReadStream(filePath).pipe(res);
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server Error');
      }
    });

    const onListening = () => {
      activePort = server.address().port;
      activeServer = server;
      resolve({
        port: activePort,
        url: `http://127.0.0.1:${activePort}`,
        close() {
          if (activeServer) {
            activeServer.close();
            activeServer = null;
            activePort = 0;
          }
        }
      });
    };

    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        server.listen(0, '127.0.0.1', onListening);
      } else {
        reject(err);
      }
    });

    server.listen(58999, '127.0.0.1', onListening);
  });
}
