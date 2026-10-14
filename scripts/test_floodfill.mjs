import { spawn } from 'node:child_process';
import fs from 'node:fs';

const width = 374;
const height = 374;
const frameSize = width * height * 4;

function processFrame(buf) {
  // buf is width * height * 4 bytes RGBA
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  function isWhite(x, y) {
    const idx = (y * width + x) * 4;
    const r = buf[idx];
    const g = buf[idx + 1];
    const b = buf[idx + 2];
    return r >= 240 && g >= 240 && b >= 240;
  }

  // Push all border pixels that are white
  for (let x = 0; x < width; x++) {
    if (isWhite(x, 0)) {
      visited[x] = 1;
      queue[tail++] = (0 << 16) | x;
    }
    const bottomY = height - 1;
    const bottomIdx = bottomY * width + x;
    if (isWhite(x, bottomY)) {
      visited[bottomIdx] = 1;
      queue[tail++] = (bottomY << 16) | x;
    }
  }

  for (let y = 1; y < height - 1; y++) {
    if (isWhite(0, y)) {
      visited[y * width] = 1;
      queue[tail++] = (y << 16) | 0;
    }
    const rightX = width - 1;
    const rightIdx = y * width + rightX;
    if (isWhite(rightX, y)) {
      visited[rightIdx] = 1;
      queue[tail++] = (y << 16) | rightX;
    }
  }

  // BFS flood fill
  const dx = [1, -1, 0, 0];
  const dy = [0, 0, 1, -1];

  while (head < tail) {
    const val = queue[head++];
    const curX = val & 0xffff;
    const curY = (val >> 16) & 0xffff;

    // Set pixel to transparent
    const pIdx = (curY * width + curX) * 4;
    buf[pIdx] = 0;
    buf[pIdx + 1] = 0;
    buf[pIdx + 2] = 0;
    buf[pIdx + 3] = 0;

    for (let i = 0; i < 4; i++) {
      const nx = curX + dx[i];
      const ny = curY + dy[i];
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nIndex = ny * width + nx;
        if (!visited[nIndex] && isWhite(nx, ny)) {
          visited[nIndex] = 1;
          queue[tail++] = (ny << 16) | nx;
        }
      }
    }
  }
}

// Test on single frame from gif
const childIn = spawn('ffmpeg', ['-v', 'error', '-i', 'assets/gif_frame_0.png', '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'], { stdio: ['ignore', 'pipe', 'inherit'] });
const chunks = [];
childIn.stdout.on('data', chunk => chunks.push(chunk));
childIn.on('close', () => {
  const buf = Buffer.concat(chunks);
  console.log('Received raw bytes:', buf.length);
  processFrame(buf);

  const childOut = spawn('ffmpeg', [
    '-v', 'error',
    '-y',
    '-f', 'rawvideo',
    '-pix_fmt', 'rgba',
    '-s', `${width}x${height}`,
    '-i', 'pipe:0',
    'assets/test_transparent_f0.png'
  ], { stdio: ['pipe', 'inherit', 'inherit'] });

  childOut.stdin.write(buf);
  childOut.stdin.end();
  childOut.on('close', () => {
    console.log('Saved assets/test_transparent_f0.png');
  });
});
