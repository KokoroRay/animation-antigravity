import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resourcesDir = 'C:/Users/Admin/AppData/Local/Programs/Antigravity/resources';
const asarPath = path.join(resourcesDir, 'app.asar');
const backupPath = path.join(resourcesDir, 'app.asar.backup');
const gifSource = path.join(projectRoot, 'assets', 'elaina-transparent.gif');
const htmlSource = path.join(projectRoot, 'assets', 'native-loading.html');

// This module only mounts the native overlay. The sidecar HTML and transparent
// GIF live beside app.asar so Chromium can load the animation without embedding
// a multi-megabyte data URL into the archive.
const replacement = Buffer.from(`"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachLoadingOverlay = attachLoadingOverlay;
const electron_1 = require("electron");
const path_1 = require("node:path");
const url_1 = require("node:url");
function attachLoadingOverlay(win) {
    const view = new electron_1.WebContentsView({ webPreferences: { nodeIntegration: false, contextIsolation: true } });
    const loadingFile = path_1.join(process.resourcesPath, "neural-loading.html");
    void view.webContents.loadURL(url_1.pathToFileURL(loadingFile).href);
    win.contentView.addChildView(view);
    const updateBounds = () => {
        const [width, height] = win.getContentSize();
        view.setBounds({ x: 0, y: 0, width, height });
    };
    updateBounds();
    win.on("resize", updateBounds);
    win.webContents.once("did-finish-load", () => {
        try { win.contentView.removeChildView(view); } catch (_) {}
        win.off("resize", updateBounds);
    });
}
`, 'utf8');

const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
if (!fs.existsSync(asarPath)) throw new Error(`Missing ${asarPath}`);
if (!fs.existsSync(gifSource)) throw new Error(`Missing transparent character GIF: ${gifSource}`);
if (!fs.existsSync(htmlSource)) throw new Error(`Missing loading page: ${htmlSource}`);

const archive = fs.readFileSync(asarPath);
const headerSize = archive.readUInt32LE(12);
const headerStart = 16;
const headerText = archive.subarray(headerStart, headerStart + headerSize).toString('utf8');
const header = JSON.parse(headerText);
const fileInfo = header.files?.dist?.files?.['loadingOverlay.js'];
if (!fileInfo?.integrity?.hash) throw new Error('dist/loadingOverlay.js integrity metadata is missing');

// ASAR payload start: first data byte follows the complete header pickle.
const payloadStart = 8 + archive.readUInt32LE(4);
const fileStart = payloadStart + Number(fileInfo.offset);
const currentBytes = archive.subarray(fileStart, fileStart + fileInfo.size);
const currentHash = sha256(currentBytes);
if (currentHash !== fileInfo.integrity.hash) {
  throw new Error(`Current loadingOverlay.js hash is invalid (${currentHash}); refusing to patch`);
}
if (replacement.length > fileInfo.size) {
  throw new Error(`Replacement is ${replacement.length} bytes; limit is ${fileInfo.size}`);
}

const nextBytes = Buffer.concat([replacement, Buffer.alloc(fileInfo.size - replacement.length, 0x20)]);
const nextHash = sha256(nextBytes);
const hashCount = headerText.split(currentHash).length - 1;
if (hashCount !== 2) throw new Error(`Expected two integrity hashes in the header; found ${hashCount}`);
const nextHeader = Buffer.from(headerText.replaceAll(currentHash, nextHash), 'utf8');
if (nextHeader.length !== headerSize) throw new Error('ASAR header size would change; refusing in-place patch');

fs.copyFileSync(gifSource, path.join(resourcesDir, 'elaina-evernight.gif'));
fs.copyFileSync(htmlSource, path.join(resourcesDir, 'neural-loading.html'));
if (!fs.existsSync(backupPath)) fs.copyFileSync(asarPath, backupPath);

const snapshotPath = `${asarPath}.before-elaina-gif-${Date.now()}`;
fs.copyFileSync(asarPath, snapshotPath);
try {
  const fd = fs.openSync(asarPath, 'r+');
  try {
    fs.writeSync(fd, nextBytes, 0, nextBytes.length, fileStart);
    fs.writeSync(fd, nextHeader, 0, nextHeader.length, headerStart);
  } finally {
    fs.closeSync(fd);
  }

  const verify = fs.readFileSync(asarPath);
  const verifyHeader = JSON.parse(verify.subarray(headerStart, headerStart + headerSize).toString('utf8'));
  const verifyInfo = verifyHeader.files.dist.files['loadingOverlay.js'];
  const verifyBytes = verify.subarray(payloadStart + Number(verifyInfo.offset), payloadStart + Number(verifyInfo.offset) + verifyInfo.size);
  if (sha256(verifyBytes) !== verifyInfo.integrity.hash) throw new Error('Updated ASAR integrity check failed');
  if (!fs.existsSync(path.join(resourcesDir, 'elaina-evernight.gif')) || !fs.existsSync(path.join(resourcesDir, 'neural-loading.html'))) {
    throw new Error('Loading sidecar files are missing after copy');
  }
  console.log(`Native loader updated with transparent Elaina GIF (${fileInfo.size}-byte module).`);
  console.log(`Recovery snapshot: ${snapshotPath}`);
} catch (error) {
  fs.copyFileSync(snapshotPath, asarPath);
  throw error;
}
