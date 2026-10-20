import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import { execSync } from 'node:child_process';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = path.resolve(process.cwd(), 'docs', 'images');
const ASSETS_DIR = path.resolve(process.cwd(), 'assets');
const FRAMES_DIR = path.resolve(process.cwd(), '.temp_frames');
const DIST_DIR = path.resolve(process.cwd(), 'dist');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(ASSETS_DIR, { recursive: true });
fs.mkdirSync(FRAMES_DIR, { recursive: true });

function startStaticServer(port = 5199) {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
  };

  const server = http.createServer((req, res) => {
    let filePath = path.join(DIST_DIR, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(DIST_DIR, 'index.html');
    }

    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    try {
      const data = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      console.log(`Static studio server running at http://127.0.0.1:${port}`);
      resolve(server);
    });
  });
}

async function run() {
  const server = await startStaticServer(5199);

  console.log('Launching headless Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
    args: ['--no-sandbox', '--disable-gpu', '--allow-file-access-from-files'],
  });

  const page = await browser.newPage();

  // 1. Render assets/logo.png from inline SVG
  console.log('Rendering assets/logo.png from assets/logo.svg...');
  const logoSvg = fs.readFileSync(path.join(ASSETS_DIR, 'logo.svg'), 'utf8');
  await page.setViewport({ width: 512, height: 512, deviceScaleFactor: 1 });
  await page.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:0;background:transparent;overflow:hidden;">${logoSvg}</body></html>`);
  await page.screenshot({ path: path.join(ASSETS_DIR, 'logo.png'), omitBackground: true });
  console.log('assets/logo.png generated.');

  // 2. Open Studio App
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:5199', { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 2000));

  // Screenshot 1: Primary Studio Dashboard
  console.log('Capturing Screenshot 1: screenforge_dashboard.png...');
  await page.screenshot({
    path: path.join(OUT_DIR, 'screenforge_dashboard.png'),
    fullPage: false,
  });

  // Screenshot 2: Auto-Zoom Tab
  console.log('Capturing Screenshot 2: screenforge_auto_zoom.png...');
  const buttons = await page.$$('button');
  for (const b of buttons) {
    const text = await page.evaluate((el) => el.textContent, b);
    if (text && text.includes('Auto-Zoom')) {
      await b.click();
      break;
    }
  }
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({
    path: path.join(OUT_DIR, 'screenforge_auto_zoom.png'),
    fullPage: false,
  });

  // Screenshot 3: Cursor Physics Tab
  console.log('Capturing Screenshot 3: screenforge_cursor_physics.png...');
  const buttonsCursor = await page.$$('button');
  for (const b of buttonsCursor) {
    const text = await page.evaluate((el) => el.textContent, b);
    if (text && text.includes('Cursor')) {
      await b.click();
      break;
    }
  }
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({
    path: path.join(OUT_DIR, 'screenforge_cursor_physics.png'),
    fullPage: false,
  });

  // Screenshot 4: Canvas Themes & 2.5D Tilt
  console.log('Capturing Screenshot 4: screenforge_canvas_themes.png...');
  const buttonsCanvas = await page.$$('button');
  for (const b of buttonsCanvas) {
    const text = await page.evaluate((el) => el.textContent, b);
    if (text && text.includes('Canvas')) {
      await b.click();
      break;
    }
  }
  await new Promise((r) => setTimeout(r, 400));

  // Toggle 2.5D perspective
  const checkboxes = await page.$$('input[type="checkbox"]');
  for (const cb of checkboxes) {
    await cb.click();
    break;
  }
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({
    path: path.join(OUT_DIR, 'screenforge_canvas_themes.png'),
    fullPage: false,
  });

  // Screenshot 5: Export Modal
  console.log('Capturing Screenshot 5: screenforge_export_modal.png...');
  const exportBtns = await page.$$('button');
  for (const b of exportBtns) {
    const text = await page.evaluate((el) => el.textContent, b);
    if (text && text.includes('Export 4K')) {
      await b.click();
      break;
    }
  }
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({
    path: path.join(OUT_DIR, 'screenforge_export_modal.png'),
    fullPage: false,
  });

  // Close Export Modal
  const closeBtns = await page.$$('button');
  for (const b of closeBtns) {
    const text = await page.evaluate((el) => el.textContent, b);
    if (text && text.includes('Cancel')) {
      await b.click();
      break;
    }
  }
  await new Promise((r) => setTimeout(r, 500));

  // 3. Record Live Frames for Animated Demo GIF
  console.log('Recording live animation sequence for demo GIF...');
  let frameCount = 0;
  for (let i = 0; i < 24; i++) {
    const framePath = path.join(FRAMES_DIR, `frame_${String(frameCount++).padStart(4, '0')}.png`);
    await page.screenshot({ path: framePath, fullPage: false });
    await new Promise((r) => setTimeout(r, 180));
  }

  await browser.close();
  server.close();
  console.log('Browser and server closed.');

  // 4. Generate Animated Demo GIF using FFmpeg
  console.log('Generating screenforge_demo.gif with FFmpeg palettegen...');
  const gifOut = path.join(OUT_DIR, 'screenforge_demo.gif');
  try {
    execSync(
      `ffmpeg -y -framerate 6 -i "${FRAMES_DIR}\\frame_%04d.png" -vf "fps=10,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" "${gifOut}"`,
      { stdio: 'inherit' }
    );
    console.log('Demo GIF created at:', gifOut);
  } catch (err) {
    console.error('Error rendering GIF:', err.message);
  }

  // Cleanup temp frames
  fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
