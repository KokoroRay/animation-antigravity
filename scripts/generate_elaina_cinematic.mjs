import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const outputFile = path.join(root, 'assets', 'startup-video-elaina.mp4');

// MIME types map
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.mp4': 'video/mp4'
};

// Spawn FFmpeg to receive JPEG frames via stdin
console.log('Spawning FFmpeg encoder for 1080p 60fps output...');
const ffmpeg = spawn('ffmpeg', [
  '-y',
  '-f', 'image2pipe',
  '-vcodec', 'mjpeg',
  '-r', '60',
  '-i', '-',
  '-c:v', 'libx264',
  '-pix_fmt', 'yuv420p',
  '-preset', 'fast',
  '-crf', '17',
  outputFile
], { stdio: ['pipe', 'inherit', 'inherit'] });

let framesReceived = 0;
let edgeProcess = null;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');

  if (url.pathname === '/submit-frame' && req.method === 'POST') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      ffmpeg.stdin.write(buffer);
      framesReceived++;
      if (framesReceived % 30 === 0) {
        console.log(`[FFmpeg] Encoded ${framesReceived}/810 frames (${((framesReceived / 810) * 100).toFixed(1)}%)`);
      }
      res.writeHead(200);
      res.end('OK');
    });
    return;
  }

  if (url.pathname === '/done' && req.method === 'POST') {
    console.log('[Done] All 810 frames submitted! Finalizing MP4...');
    res.writeHead(200);
    res.end('OK');

    ffmpeg.stdin.end();
    ffmpeg.on('close', code => {
      console.log(`[FFmpeg] Process exited with code ${code}. Video saved to ${outputFile}`);
      if (edgeProcess) edgeProcess.kill();
      server.close();
      process.exit(code);
    });
    return;
  }

  if (url.pathname === '/error' && req.method === 'POST') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      console.error('[Browser Error]', Buffer.concat(chunks).toString());
      if (edgeProcess) edgeProcess.kill();
      ffmpeg.kill();
      server.close();
      process.exit(1);
    });
    return;
  }

  // Serve static files
  let filePath = path.join(root, decodeURIComponent(url.pathname).replace(/^\//, ''));
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const stat = fs.statSync(filePath);
    const range = req.headers.range;

    if (range && ext === '.mp4') {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': 'video/mp4'
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Content-Length': stat.size,
        'Cache-Control': 'no-cache'
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  console.log(`[Server] Generator server listening on port ${port}`);

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const genUrl = `http://127.0.0.1:${port}/scripts/elaina_generator.html`;

  console.log(`[Browser] Launching Edge headless to render Elaina frames...`);
  edgeProcess = spawn(edgePath, [
    '--headless',
    '--disable-gpu',
    '--window-size=1920,1080',
    '--autoplay-policy=no-user-gesture-required',
    genUrl
  ], { stdio: 'ignore' });
});
