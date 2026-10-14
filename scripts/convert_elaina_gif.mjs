import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const width = 374;
const height = 374;
const frameBytes = width * height * 4;

function processFrame(buf, offset) {
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  function isWhite(x, y) {
    const idx = offset + (y * width + x) * 4;
    const r = buf[idx];
    const g = buf[idx + 1];
    const b = buf[idx + 2];
    // Background in elaina-evernight.gif is pure white (255, 255, 255)
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
    const pIdx = offset + (curY * width + curX) * 4;
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

async function run() {
  console.log('Extracting frames from elaina-evernight.gif...');
  const inputChild = spawn('ffmpeg', [
    '-v', 'error',
    '-i', 'elaina-evernight.gif',
    '-f', 'rawvideo',
    '-pix_fmt', 'rgba',
    'pipe:1'
  ], { stdio: ['ignore', 'pipe', 'inherit'] });

  const chunks = [];
  inputChild.stdout.on('data', chunk => chunks.push(chunk));
  
  await new Promise(resolve => inputChild.on('close', resolve));
  const rawData = Buffer.concat(chunks);
  const totalFrames = Math.floor(rawData.length / frameBytes);
  console.log(`Total frames read: ${totalFrames} (${rawData.length} bytes)`);

  console.log('Processing frames with flood fill transparency...');
  const startTime = Date.now();
  for (let f = 0; f < totalFrames; f++) {
    processFrame(rawData, f * frameBytes);
  }
  console.log(`Transparency processing took ${Date.now() - startTime}ms`);

  console.log('Encoding output transparent GIF via ffmpeg...');
  // Use palettegen / paletteuse with alpha reserve to produce a clean transparent GIF
  const outPath = path.resolve('assets/elaina-transparent.gif');
  const ffmpegOut = spawn('ffmpeg', [
    '-v', 'warning',
    '-y',
    '-f', 'rawvideo',
    '-pix_fmt', 'rgba',
    '-s', `${width}x${height}`,
    '-r', '27.17', // Match original timing or 27-30fps
    '-i', 'pipe:0',
    '-filter_complex', '[0:v] split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=000000 [p]; [b][p] paletteuse=alpha_threshold=128',
    outPath
  ], { stdio: ['pipe', 'inherit', 'inherit'] });

  ffmpegOut.stdin.write(rawData);
  ffmpegOut.stdin.end();

  await new Promise(resolve => ffmpegOut.on('close', resolve));
  console.log(`Successfully generated ${outPath}!`);

  const stat = fs.statSync(outPath);
  console.log(`Output size: ${(stat.size / 1024).toFixed(1)} KB`);
}

run().catch(console.error);
