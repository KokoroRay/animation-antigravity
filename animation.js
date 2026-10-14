(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const escapeHtml = str => str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  
  const scene = $('#scene') || $('.scene');
  const masterVideo = $('#master-video') || $('.master-cinematic-video');
  const isAuthentic = Boolean(scene && scene.classList.contains('authentic-mode') && masterVideo);
  let TOTAL_DURATION = 10000;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const embedded = window.parent !== window && (window.ANTIGRAVITY_EXTERNAL || window.AEMEATH_EXTERNAL || new URLSearchParams(location.search).has('embedded'));

  const defaultAssets = {
    artwork: 'assets/artwork.jpg',
    avatar: 'assets/avatar.jpg',
    video: 'assets/elaina-video.mp4'
  };
  const assets = window.ANTIGRAVITY_ASSETS || window.AEMEATH_ASSETS || defaultAssets;

  if (embedded) document.body.classList.add('embedded');

  // DOM Elements
  const stage = $('#character-stage') || $('.character-stage');
  const video = $('.character-video');
  const artwork = $('.character-artwork');
  const canvas = $('.character-canvas');
  const scanline = $('.scanline-laser');
  const orbitalSystem = $('.orbital-system');
  const meteorsLayer = $('.meteors-layer');
  const codeStream = $('#code-stream');
  const ambientGlow = $('.ambient-glow');
  const ratioText = $('#ratio');
  const syncBar = $('#sync-bar');
  const bottomProgress = $('#bottom-progress');
  const syncStatus = $('#sync-status');
  const timecode = $('#timecode');
  const flash = $('.transition-flash');
  const shutter = $('.shutter-line');
  const bootCurtain = $('#boot-curtain') || $('.boot-curtain');
  const slider = $('#timeline');
  const pauseBtn = $('#pause');
  const replayBtn = $('#replay');
  const elapsedOut = $('#elapsed');
  const dialog = $('#settings-dialog');
  const wallpaperSlider = $('#wallpaper-strength');
  const wallpaperValue = $('#wallpaper-value');
  const themeSelect = $('#theme-preset');
  const editorOpacitySlider = $('#editor-opacity');
  const editorOpacityValue = $('#editor-opacity-value');

  // Ensure default media paths are populated immediately (vital for embedded iframe mode)
  if (masterVideo) {
    masterVideo.muted = true;
    masterVideo.defaultMuted = true;
    masterVideo.playsInline = true;
    masterVideo.autoplay = true;
    if (!masterVideo.getAttribute('src') || masterVideo.getAttribute('src') === '') {
      masterVideo.src = assets.video;
    }
  }
  if (video) {
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.autoplay = true;
    if (!video.getAttribute('src') || video.getAttribute('src') === '') {
      video.src = assets.video;
    }
    video.addEventListener('error', () => {
      console.warn('[Antigravity] Video load notice, keeping artwork visible');
      if (artwork) {
        artwork.style.opacity = '1';
        artwork.style.filter = 'none';
      }
    });
  }
  if (artwork && (!artwork.getAttribute('src') || artwork.getAttribute('src') === '')) {
    artwork.src = assets.artwork;
  }

  if (slider) slider.max = String(TOTAL_DURATION / 1000);

  // Math Helpers
  const clamp = n => Math.max(0, Math.min(1, n));
  const smooth = n => { const t = clamp(n); return t * t * (3 - 2 * t); };

  // Playback State
  let playing = false;
  let elapsed = 0;
  let origin = 0;
  let frame = 0;
  let completed = false;
  let userConfig = null;
  let wallpaperStrength = 40;
  let editorOpacity = 82;
  let currentThemePreset = 'elaina';
  let autoPalette = null;

  const send = (action, details = {}) => {
    const data = { type: 'antigravity-boot', action, ...details };
    if (window.ANTIGRAVITY_SEND) {
      window.ANTIGRAVITY_SEND(data);
    } else if (window.AEMEATH_SEND) {
      window.AEMEATH_SEND(data);
    } else if (embedded) {
      window.parent.postMessage(data, '*');
    }
  };

  // 49 sci-fi script lines for the adapted startup animation
  const CODE_LINES = [
    { text: "// Initializing neural core · Starlight online", type: "comment" },
    { text: "const seed = 'ocean://memory';", type: "code", tokens: [
      { t: "keyword", v: "const " }, { t: "ident", v: "seed" }, { t: "op", v: " = " }, { t: "string", v: "'ocean://memory'" }, { t: "op", v: ";" }
    ]},
    { text: "await boot(seed); // neural matrix online", type: "code", tokens: [
      { t: "keyword", v: "await " }, { t: "fn", v: "boot" }, { t: "op", v: "(" }, { t: "ident", v: "seed" }, { t: "op", v: "); " }, { t: "comment", v: "// neural matrix online" }
    ]},
    { text: "const clock = sync('neural');", type: "code", tokens: [
      { t: "keyword", v: "const " }, { t: "ident", v: "clock" }, { t: "op", v: " = " }, { t: "fn", v: "sync" }, { t: "op", v: "(" }, { t: "string", v: "'neural'" }, { t: "op", v: ");" }
    ]},
    { text: "clock.rate = 60; // synchronize light particles", type: "code", tokens: [
      { t: "ident", v: "clock" }, { t: "op", v: "." }, { t: "prop", v: "rate" }, { t: "op", v: " = " }, { t: "number", v: "60" }, { t: "op", v: "; " }, { t: "comment", v: "// synchronize light particles" }
    ]},
    { text: "// Photon array · Signal link connected", type: "comment" },
    { text: "const photons = collect('cyan');", type: "code", tokens: [
      { t: "keyword", v: "const " }, { t: "ident", v: "photons" }, { t: "op", v: " = " }, { t: "fn", v: "collect" }, { t: "op", v: "(" }, { t: "string", v: "'cyan'" }, { t: "op", v: ");" }
    ]},
    { text: "photons.spread(0.72);", type: "code", tokens: [
      { t: "ident", v: "photons" }, { t: "op", v: "." }, { t: "fn", v: "spread" }, { t: "op", v: "(" }, { t: "number", v: "0.72" }, { t: "op", v: ");" }
    ]},
    { text: "await photons.align(); // spectrum calibrated", type: "code", tokens: [
      { t: "keyword", v: "await " }, { t: "ident", v: "photons" }, { t: "op", v: "." }, { t: "fn", v: "align" }, { t: "op", v: "(); " }, { t: "comment", v: "// spectrum calibrated" }
    ]},
    { text: "// Collecting luminescence · Rebuilding strands", type: "comment" },
    { text: "const light = scan('hair');", type: "code", tokens: [
      { t: "keyword", v: "const " }, { t: "ident", v: "light" }, { t: "op", v: " = " }, { t: "fn", v: "scan" }, { t: "op", v: "(" }, { t: "string", v: "'hair'" }, { t: "op", v: ");" }
    ]},
    { text: "await light.trace(); // luminous strands rebuilt", type: "code", tokens: [
      { t: "keyword", v: "await " }, { t: "ident", v: "light" }, { t: "op", v: "." }, { t: "fn", v: "trace" }, { t: "op", v: "(); " }, { t: "comment", v: "// luminous strands rebuilt" }
    ]},
    { text: "light.edge = 0.85;", type: "code", tokens: [
      { t: "ident", v: "light" }, { t: "op", v: "." }, { t: "prop", v: "edge" }, { t: "op", v: " = " }, { t: "number", v: "0.85" }, { t: "op", v: ";" }
    ]},
    { text: "light.tint = ['cyan', 'violet', 'ice'];", type: "code", tokens: [
      { t: "ident", v: "light" }, { t: "op", v: "." }, { t: "prop", v: "tint" }, { t: "op", v: " = [" }, { t: "string", v: "'cyan'" }, { t: "op", v: ", " }, { t: "string", v: "'violet'" }, { t: "op", v: ", " }, { t: "string", v: "'ice'" }, { t: "op", v: "];" }
    ]},
    { text: "// Deep-space link · Establishing socket", type: "comment" },
    { text: "const link = connect('deep-space');", type: "code", tokens: [
      { t: "keyword", v: "const " }, { t: "ident", v: "link" }, { t: "op", v: " = " }, { t: "fn", v: "connect" }, { t: "op", v: "(" }, { t: "string", v: "'deep-space'" }, { t: "op", v: ");" }
    ]},
    { text: "await link.listen();", type: "code", tokens: [
      { t: "keyword", v: "await " }, { t: "ident", v: "link" }, { t: "op", v: "." }, { t: "fn", v: "listen" }, { t: "op", v: "();" }
    ]},
    { text: "link.signal = 1.0;", type: "code", tokens: [
      { t: "ident", v: "link" }, { t: "op", v: "." }, { t: "prop", v: "signal" }, { t: "op", v: " = " }, { t: "number", v: "1.0" }, { t: "op", v: ";" }
    ]},
    { text: "// Decoding memory graph · Topology sync", type: "comment" },
    { text: "const face = await decode(); // resolve topology", type: "code", tokens: [
      { t: "keyword", v: "const " }, { t: "ident", v: "face" }, { t: "op", v: " = " }, { t: "keyword", v: "await " }, { t: "fn", v: "decode" }, { t: "op", v: "(); " }, { t: "comment", v: "// resolve topology" }
    ]},
    { text: "face.align({ precision: 'high' });", type: "code", tokens: [
      { t: "ident", v: "face" }, { t: "op", v: "." }, { t: "fn", v: "align" }, { t: "op", v: "({ " }, { t: "prop", v: "precision" }, { t: "op", v: ": " }, { t: "string", v: "'high'" }, { t: "op", v: " });" }
    ]},
    { text: "face.resolve();", type: "code", tokens: [
      { t: "ident", v: "face" }, { t: "op", v: "." }, { t: "fn", v: "resolve" }, { t: "op", v: "();" }
    ]},
    { text: "// Vector contours · Progressive laser reveal", type: "comment" },
    { text: "const contour = trace('silhouette');", type: "code", tokens: [
      { t: "keyword", v: "const " }, { t: "ident", v: "contour" }, { t: "op", v: " = " }, { t: "fn", v: "trace" }, { t: "op", v: "(" }, { t: "string", v: "'silhouette'" }, { t: "op", v: ");" }
    ]},
    { text: "contour.smooth(0.92); // preserve silhouette", type: "code", tokens: [
      { t: "ident", v: "contour" }, { t: "op", v: "." }, { t: "fn", v: "smooth" }, { t: "op", v: "(" }, { t: "number", v: "0.92" }, { t: "op", v: "); " }, { t: "comment", v: "// preserve silhouette" }
    ]},
    { text: "await contour.reveal();", type: "code", tokens: [
      { t: "keyword", v: "await " }, { t: "ident", v: "contour" }, { t: "op", v: "." }, { t: "fn", v: "reveal" }, { t: "op", v: "();" }
    ]},
    { text: "// Stardust emission · Kinetic particle burst", type: "comment" },
    { text: "const trails = emit('stardust');", type: "code", tokens: [
      { t: "keyword", v: "const " }, { t: "ident", v: "trails" }, { t: "op", v: " = " }, { t: "fn", v: "emit" }, { t: "op", v: "(" }, { t: "string", v: "'stardust'" }, { t: "op", v: ");" }
    ]},
    { text: "trails.velocity = 0.86;", type: "code", tokens: [
      { t: "ident", v: "trails" }, { t: "op", v: "." }, { t: "prop", v: "velocity" }, { t: "op", v: " = " }, { t: "number", v: "0.86" }, { t: "op", v: ";" }
    ]},
    { text: "trails.palette = light.tint;", type: "code", tokens: [
      { t: "ident", v: "trails" }, { t: "op", v: "." }, { t: "prop", v: "palette" }, { t: "op", v: " = " }, { t: "ident", v: "light" }, { t: "op", v: "." }, { t: "prop", v: "tint" }, { t: "op", v: ";" }
    ]},
    { text: "await trails.cross();", type: "code", tokens: [
      { t: "keyword", v: "await " }, { t: "ident", v: "trails" }, { t: "op", v: "." }, { t: "fn", v: "cross" }, { t: "op", v: "();" }
    ]},
    { text: "// Iris awakening · Synchronizing ocular aperture", type: "comment" },
    { text: "await eyes.open(0.85); // iris aperture synchronized", type: "code", tokens: [
      { t: "keyword", v: "await " }, { t: "ident", v: "eyes" }, { t: "op", v: "." }, { t: "fn", v: "open" }, { t: "op", v: "(" }, { t: "number", v: "0.85" }, { t: "op", v: "); " }, { t: "comment", v: "// iris aperture synchronized" }
    ]},
    { text: "const pulse = connect('iris');", type: "code", tokens: [
      { t: "keyword", v: "const " }, { t: "ident", v: "pulse" }, { t: "op", v: " = " }, { t: "fn", v: "connect" }, { t: "op", v: "(" }, { t: "string", v: "'iris'" }, { t: "op", v: ");" }
    ]},
    { text: "pulse.glow('cyan');", type: "code", tokens: [
      { t: "ident", v: "pulse" }, { t: "op", v: "." }, { t: "fn", v: "glow" }, { t: "op", v: "(" }, { t: "string", v: "'cyan'" }, { t: "op", v: ");" }
    ]},
    { text: "// Focal stabilization · Iris bloom lock", type: "comment" },
    { text: "pulse.phase = clock.phase;", type: "code", tokens: [
      { t: "ident", v: "pulse" }, { t: "op", v: "." }, { t: "prop", v: "phase" }, { t: "op", v: " = " }, { t: "ident", v: "clock" }, { t: "op", v: "." }, { t: "prop", v: "phase" }, { t: "op", v: ";" }
    ]},
    { text: "pulse.bloom(0.72);", type: "code", tokens: [
      { t: "ident", v: "pulse" }, { t: "op", v: "." }, { t: "fn", v: "bloom" }, { t: "op", v: "(" }, { t: "number", v: "0.72" }, { t: "op", v: ");" }
    ]},
    { text: "await pulse.stabilize();", type: "code", tokens: [
      { t: "keyword", v: "await " }, { t: "ident", v: "pulse" }, { t: "op", v: "." }, { t: "fn", v: "stabilize" }, { t: "op", v: "();" }
    ]},
    { text: "// Meditation complete · Attaching subject to viewport", type: "comment" },
    { text: "scene.attach(face);", type: "code", tokens: [
      { t: "ident", v: "scene" }, { t: "op", v: "." }, { t: "fn", v: "attach" }, { t: "op", v: "(" }, { t: "ident", v: "face" }, { t: "op", v: ");" }
    ]},
    { text: "scene.depth = 'quiet';", type: "code", tokens: [
      { t: "ident", v: "scene" }, { t: "op", v: "." }, { t: "prop", v: "depth" }, { t: "op", v: " = " }, { t: "string", v: "'quiet'" }, { t: "op", v: ";" }
    ]},
    { text: "scene.focus = eyes.center;", type: "code", tokens: [
      { t: "ident", v: "scene" }, { t: "op", v: "." }, { t: "prop", v: "focus" }, { t: "op", v: " = " }, { t: "ident", v: "eyes" }, { t: "op", v: "." }, { t: "prop", v: "center" }, { t: "op", v: ";" }
    ]},
    { text: "// Camera zoom out to 1.0x · Initiating live stream", type: "comment" },
    { text: "await scene.zoomOut({ duration: 'normal', scale: 1.0 });", type: "code", tokens: [
      { t: "keyword", v: "await " }, { t: "ident", v: "scene" }, { t: "op", v: "." }, { t: "fn", v: "zoomOut" }, { t: "op", v: "({ " }, { t: "prop", v: "duration" }, { t: "op", v: ": " }, { t: "string", v: "'normal'" }, { t: "op", v: ", " }, { t: "prop", v: "scale" }, { t: "op", v: ": " }, { t: "number", v: "1.0" }, { t: "op", v: " });" }
    ]},
    { text: "await scene.playVideo();", type: "code", tokens: [
      { t: "keyword", v: "await " }, { t: "ident", v: "scene" }, { t: "op", v: "." }, { t: "fn", v: "playVideo" }, { t: "op", v: "();" }
    ]},
    { text: "trails.release();", type: "code", tokens: [
      { t: "ident", v: "trails" }, { t: "op", v: "." }, { t: "fn", v: "release" }, { t: "op", v: "();" }
    ]},
    { text: "await sync('consciousness');", type: "code", tokens: [
      { t: "keyword", v: "await " }, { t: "fn", v: "sync" }, { t: "op", v: "(" }, { t: "string", v: "'consciousness'" }, { t: "op", v: ");" }
    ]},
    { text: "await scene.ready(); // consciousness online", type: "code", tokens: [
      { t: "keyword", v: "await " }, { t: "ident", v: "scene" }, { t: "op", v: "." }, { t: "fn", v: "ready" }, { t: "op", v: "(); " }, { t: "comment", v: "// consciousness online" }
    ]}
  ];

  function renderLineHTML(line, charCount, isTyping) {
    if (line.type === 'comment') {
      const text = line.text.slice(0, charCount);
      return `<span class="tok-comment">${escapeHtml(text)}</span>${isTyping ? '<span class="tok-cursor"></span>' : ''}`;
    }
    let remaining = charCount;
    let html = '';
    for (const token of line.tokens) {
      if (remaining <= 0) break;
      const chunk = token.v.slice(0, remaining);
      remaining -= chunk.length;
      let cls = '';
      if (token.t === 'keyword') cls = 'tok-keyword';
      else if (token.t === 'fn') cls = 'tok-fn';
      else if (token.t === 'string') cls = 'tok-string';
      else if (token.t === 'number') cls = 'tok-number';
      else if (token.t === 'prop') cls = 'tok-prop';
      else if (token.t === 'op') cls = 'tok-op';
      else if (token.t === 'comment') cls = 'tok-comment';
      else cls = 'tok-ident';
      html += cls ? `<span class="${cls}">${escapeHtml(chunk)}</span>` : escapeHtml(chunk);
    }
    if (isTyping) {
      html += '<span class="tok-cursor"></span>';
    }
    return html;
  }

  // ========================================================
  // CHARACTER OUTLINE & NEURAL AWAKENING ENGINE
  // ========================================================
  let preparedPaths = [];
  let totalContourLength = 0;
  let contourGradient = null;

  function initContours(rawPaths) {
    if (!Array.isArray(rawPaths)) return;
    totalContourLength = 0;

    preparedPaths = rawPaths.map(points => {
      if (!points || points.length < 2) return null;
      let len = 0;
      let minY = 9999;
      for (let i = 1; i < points.length; i++) {
        len += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
        if (points[i][1] < minY) minY = points[i][1];
      }
      totalContourLength += len;
      const path2d = new Path2D();
      if (points.length < 3) {
        points.forEach((p, idx) => idx ? path2d.lineTo(p[0], p[1]) : path2d.moveTo(p[0], p[1]));
      } else {
        path2d.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length - 1; i++) {
          const xc = (points[i][0] + points[i + 1][0]) / 2;
          const yc = (points[i][1] + points[i + 1][1]) / 2;
          path2d.quadraticCurveTo(points[i][0], points[i][1], xc, yc);
        }
        path2d.lineTo(points[points.length - 1][0], points[points.length - 1][1]);
      }
      const isMain = len >= 160;
      return { points, total: len, minY, path2d, isMain };
    }).filter(Boolean);
  }

  if (window.CONTOUR_PATHS) {
    initContours(window.CONTOUR_PATHS);
  }


  // Draw Neon Contours with Progressive Scanline Reveal (Samsung Wonderland Edge Style)
  const ctx = canvas?.getContext('2d');



  // Draw Neon Contours with Organic Spline Reveal (Wonderland Edge Style - No Harsh Scanners)
  function drawNeonContours(t) {
    if (!ctx || !preparedPaths.length) return;

    if (t >= 3600) {
      return;
    }

    if (canvas && canvas.style.display === 'none') {
      canvas.style.display = 'block';
    }

    ctx.clearRect(0, 0, 1920, 1080);

    if (scanline) {
      scanline.style.opacity = '0';
      scanline.style.display = 'none';
    }

    if (!contourGradient) {
      contourGradient = ctx.createLinearGradient(0, 40, 0, 1060);
      contourGradient.addColorStop(0.00, '#fde047'); // Bright golden yellow (cowlick & top hair)
      contourGradient.addColorStop(0.18, '#fb923c'); // Warm sunset orange
      contourGradient.addColorStop(0.36, '#f472b6'); // Rose pink / magenta
      contourGradient.addColorStop(0.58, '#c084fc'); // Electric purple / violet
      contourGradient.addColorStop(0.80, '#38bdf8'); // Sky neon cyan
      contourGradient.addColorStop(1.00, '#22d3ee'); // Bright electric teal
    }

    const drawRatio = clamp(t / 3200);
    const targetLen = drawRatio * totalContourLength;

    // Smooth soft fadeout as video blooms into full focus (3.2s - 3.6s)
    const contourFade = t < 3200 ? 1.0 : Math.max(0, 1.0 - (t - 3200) / 400);

    // Dynamic Shimmer Pulse
    const edgePulse = 0.94 + 0.06 * Math.sin(t * 0.007);
    const alpha1 = edgePulse * contourFade;

    // Pass 1: Delicate Chromatic Neon Filament (Thinner main lines ~0.95px, fine details ~0.50px)
    ctx.save();
    ctx.strokeStyle = contourGradient;
    ctx.globalAlpha = alpha1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    let accum1 = 0;
    for (const p of preparedPaths) {
      if (accum1 >= targetLen) break;
      ctx.lineWidth = p.isMain ? 0.95 : 0.50;
      const avail = targetLen - accum1;
      if (avail >= p.total) {
        ctx.setLineDash([]);
        ctx.stroke(p.path2d);
        accum1 += p.total;
      } else {
        ctx.setLineDash([avail, p.total]);
        ctx.stroke(p.path2d);
        accum1 += avail;
        break;
      }
    }
    ctx.restore();

    // Pass 2: Ultra-crisp Laser White Filament Core (Main ~0.40px, details ~0.22px)
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.95 * alpha1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    let accum2 = 0;
    for (const p of preparedPaths) {
      if (accum2 >= targetLen) break;
      ctx.lineWidth = p.isMain ? 0.40 : 0.22;
      const avail = targetLen - accum2;
      if (avail >= p.total) {
        ctx.setLineDash([]);
        ctx.stroke(p.path2d);
        accum2 += p.total;
      } else {
        ctx.setLineDash([avail, p.total]);
        ctx.stroke(p.path2d);
        accum2 += avail;
        break;
      }
    }
    ctx.restore();
  }

  // Master Timeline Render Loop
  let lastLineIndex = -1;
  let lastCharCount = -1;

  function render(t) {
    // 0. Boot Initializing Screen (0.0s – 1.4s)
    if (bootCurtain) {
      if (t < 1100) {
        bootCurtain.style.opacity = '1';
        bootCurtain.style.display = 'flex';
      } else if (t < 1600) {
        const fade = smooth((1600 - t) / 500);
        bootCurtain.style.opacity = String(fade);
        bootCurtain.style.display = 'flex';
      } else {
        bootCurtain.style.opacity = '0';
        bootCurtain.style.display = 'none';
      }
    }

    // 1. Timecode & Progress Ratio
    const sec = Math.floor(t / 1000);
    const cs = Math.floor((t % 1000) / 10);
    if (timecode) timecode.textContent = `00:${String(sec).padStart(2, '0')}:${String(cs).padStart(2, '0')}`;
    if (elapsedOut) elapsedOut.innerHTML = `${(t / 1000).toFixed(1)} <span>/ ${(TOTAL_DURATION / 1000).toFixed(1)}s</span>`;
    if (slider && !slider.matches(':active')) slider.value = String(t / 1000);

    const progressRatio = clamp(t / (TOTAL_DURATION - 800));
    const pct = (progressRatio * 100).toFixed(2);
    if (ratioText) ratioText.textContent = `${pct}%`;
    if (syncBar) syncBar.style.width = `${pct}%`;
    if (bottomProgress) bottomProgress.style.width = `${pct}%`;

    // 2. Status Text
    if (syncStatus) {
      if (t < 1800) syncStatus.textContent = 'INITIALIZING NEURAL LINK';
      else if (t < 3200) syncStatus.textContent = 'PHOTON MATRIX CALIBRATION';
      else if (t < 6000) syncStatus.textContent = 'OCULAR APERTURE AWAKENING';
      else if (t < 8500) syncStatus.textContent = 'SYNCHRONIZING CONSCIOUSNESS';
      else syncStatus.textContent = 'SYSTEM ONLINE // AWAKENING COMPLETE';
    }

    // 3. Authentic Full-Screen GPU Video Mode (Directly matching TikTok original link)
    if (isAuthentic && masterVideo) {
      if (playing && masterVideo.paused) {
        masterVideo.muted = true;
        masterVideo.play().catch(() => {});
      }
      const targetSec = t / 1000;
      if (Math.abs(masterVideo.currentTime - targetSec) > 2.0) {
        masterVideo.currentTime = targetSec;
      }

      // Soft Photonic Aperture Flash into Antigravity (NO CENTER LINE)
      const shutterStart = TOTAL_DURATION - 800;
      if (t >= shutterStart) {
        if (shutter) {
          shutter.style.opacity = '0';
          shutter.style.display = 'none';
        }
        if (flash) {
          const fProg = clamp((t - shutterStart) / 400);
          const fFade = Math.max(0, 1 - (t - (shutterStart + 400)) / 300);
          flash.style.opacity = String(smooth(fProg) * fFade);
        }
      } else {
        if (shutter) {
          shutter.style.opacity = '0';
          shutter.style.display = 'none';
        }
        if (flash) flash.style.opacity = '0';
      }

      // Completion Check
      if (t >= TOTAL_DURATION && !completed) {
        completed = true;
        send('complete', { videoTime: masterVideo ? masterVideo.currentTime : 0 });
        if (!embedded) {
          pause();
        }
      }
      return;
    }

    // 4. Dynamic Camera Zoom Engine:
    // Starts zoomed-in close on Elaina's sleeping face (scale 1.78, translate(-6%, -5%))
    // Smoothly zooms out between 3.2s and 6.0s down to normal framing (scale 1.0, translate(0, 0))
    if (stage) {
      if (t <= 3200) {
        stage.style.transform = 'scale(1.78) translate(-6%, -5%)';
      } else if (t <= 6000) {
        const alpha = smooth((t - 3200) / 2800);
        const scale = 1.78 - 0.78 * alpha;
        const tx = -6 * (1 - alpha);
        const ty = -5 * (1 - alpha);
        stage.style.transform = `scale(${scale.toFixed(4)}) translate(${tx.toFixed(2)}%, ${ty.toFixed(2)}%)`;
      } else {
        stage.style.transform = 'scale(1) translate(0%, 0%)';
      }
    }

    // 5. Progressive Character Reveal from Darkness:
    // Closed-eye still frame starts in deep shadow (#000000), leaving the room pitch black
    // while neon Wonderland Edge contours draw in darkness, then softly illuminating Elaina.
    if (artwork) {
      if (t < 1400) {
        artwork.style.opacity = '0';
        artwork.style.filter = 'contrast(1.4) brightness(0.05)';
        artwork.style.maskImage = 'none';
        artwork.style.webkitMaskImage = 'none';
        artwork.style.clipPath = 'none';
        artwork.style.webkitClipPath = 'none';
      } else if (t < 2400) {
        // 1.4s - 2.4s: Pitch-black void. Background room is completely dark.
        // Faint dark silhouette (opacity <= 0.15, brightness 0.22) emerges gently under neon contours.
        const p1 = (t - 1400) / 1000;
        const faintAlpha = 0.15 * smooth(p1);
        artwork.style.opacity = String(faintAlpha);
        artwork.style.filter = 'contrast(1.3) brightness(0.22)';
        artwork.style.maskImage = 'none';
        artwork.style.webkitMaskImage = 'none';
        artwork.style.clipPath = 'none';
        artwork.style.webkitClipPath = 'none';
      } else if (t < 3200) {
        // 2.4s - 3.2s: Light smoothly blooms over Elaina as contours reach the hands and book.
        const p2 = (t - 2400) / 800;
        const bloomFade = smooth(p2);
        const alpha = 0.15 + 0.85 * bloomFade;
        const bright = (0.22 + 0.78 * bloomFade).toFixed(2);
        artwork.style.opacity = String(alpha);
        artwork.style.filter = `contrast(1.1) brightness(${bright})`;
        artwork.style.maskImage = 'none';
        artwork.style.webkitMaskImage = 'none';
        artwork.style.clipPath = 'none';
        artwork.style.webkitClipPath = 'none';
      } else if (t <= 3600) {
        artwork.style.maskImage = 'none';
        artwork.style.webkitMaskImage = 'none';
        artwork.style.clipPath = 'none';
        artwork.style.webkitClipPath = 'none';
        artwork.style.filter = 'none';
        // Seamless 400ms crossfade into live video
        const fade = smooth((t - 3200) / 400);
        artwork.style.opacity = String(1.0 - fade);
      } else {
        artwork.style.maskImage = 'none';
        artwork.style.webkitMaskImage = 'none';
        artwork.style.clipPath = 'none';
        artwork.style.webkitClipPath = 'none';
        artwork.style.filter = 'none';
        artwork.style.opacity = '0';
      }
    }

    // Celestial FX (Orbital rings, meteors & ambient glow)
    if (t < 1200) {
      if (orbitalSystem) orbitalSystem.style.opacity = '0';
      if (meteorsLayer) meteorsLayer.style.opacity = '0';
      if (ambientGlow) ambientGlow.style.opacity = '0';
    } else if (t < 2000) {
      const initFade = smooth((t - 1200) / 800);
      if (orbitalSystem) orbitalSystem.style.opacity = String(0.75 * initFade);
      if (meteorsLayer) meteorsLayer.style.opacity = String(0.85 * initFade);
      if (ambientGlow) ambientGlow.style.opacity = String(0.20 * initFade);
    } else if (t < 3200) {
      if (orbitalSystem) orbitalSystem.style.opacity = '0.75';
      if (meteorsLayer) meteorsLayer.style.opacity = '0.85';
      if (ambientGlow) ambientGlow.style.opacity = '0.20';
    } else {
      const bloom = smooth((t - 3200) / 1200);
      if (orbitalSystem) orbitalSystem.style.opacity = String(0.75 + 0.25 * bloom);
      if (meteorsLayer) meteorsLayer.style.opacity = String(0.85 + 0.15 * bloom);
      if (ambientGlow) ambientGlow.style.opacity = String(0.20 + 0.25 * bloom);
    }

    // Auto-hide character contours cleanly as video takes over (completely gone at t >= 3600)
    if (t < 3200) {
      if (canvas) {
        if (canvas.style.display === 'none') canvas.style.display = 'block';
        canvas.style.opacity = '1';
      }
      drawNeonContours(t);
    } else if (t < 3600) {
      const contourFade = smooth((3600 - t) / 400);
      if (canvas) {
        if (canvas.style.display === 'none') canvas.style.display = 'block';
        canvas.style.opacity = String(contourFade);
      }
      drawNeonContours(t);
    } else {
      if (canvas && canvas.style.display !== 'none') {
        canvas.style.opacity = '0';
        canvas.style.display = 'none';
        if (ctx) ctx.clearRect(0, 0, 1920, 1080);
      }
      if (scanline && scanline.style.opacity !== '0') {
        scanline.style.opacity = '0';
        scanline.style.display = 'none';
      }
    }

    // 6. Live Video Playback (assets/elaina-video.mp4):
    // Elaina starts with eyes closed at 0.0s matching artwork.jpg.
    // Video starts playing cleanly at t = 3200 right as camera zooms out.
    // Elaina naturally awakens and opens her eyes between 3.2s and 6.0s (video 0s -> 2.8s).
    if (video) {
      if (t < 3200) {
        video.style.opacity = '0';
        if (!video.paused) {
          video.pause();
        }
      } else {
        const videoFade = smooth((t - 3200) / 400);
        video.style.opacity = String(videoFade);

        if (playing && video.paused) {
          video.play().catch(() => {});
        }
      }
    }

    // 6. Live Code Terminal Typewriter (Flows all the way down full vertical screen)
    if (codeStream) {
      const codeStart = 60;
      const codeEnd = TOTAL_DURATION - 1200;
      const totalLines = CODE_LINES.length;

      let currentLineIdx = -1;
      let currentCharCount = 0;

      if (t >= codeStart) {
        const lineFraction = clamp((t - codeStart) / (codeEnd - codeStart)) * totalLines;
        currentLineIdx = Math.min(totalLines - 1, Math.floor(lineFraction));
        const withinLineProgress = clamp(lineFraction - currentLineIdx);
        const activeLineObj = CODE_LINES[currentLineIdx];
        currentCharCount = Math.floor(withinLineProgress * activeLineObj.text.length);
      }

      if (currentLineIdx !== lastLineIndex || currentCharCount !== lastCharCount) {
        if (currentLineIdx < lastLineIndex || lastLineIndex === -1) {
          codeStream.innerHTML = '';
          for (let i = 0; i <= currentLineIdx; i++) {
            const l = CODE_LINES[i];
            const isCurrent = i === currentLineIdx;
            const chars = isCurrent ? currentCharCount : l.text.length;
            const div = document.createElement('div');
            div.className = 'code-line';
            div.innerHTML = renderLineHTML(l, chars, isCurrent);
            codeStream.appendChild(div);
          }
        } else {
          while (codeStream.children.length < currentLineIdx) {
            const idx = codeStream.children.length;
            const l = CODE_LINES[idx];
            const div = document.createElement('div');
            div.className = 'code-line';
            div.innerHTML = renderLineHTML(l, l.text.length, false);
            codeStream.appendChild(div);
          }
          if (lastLineIndex >= 0 && lastLineIndex < currentLineIdx && codeStream.children[lastLineIndex]) {
            const prevL = CODE_LINES[lastLineIndex];
            codeStream.children[lastLineIndex].innerHTML = renderLineHTML(prevL, prevL.text.length, false);
          }
          if (!codeStream.children[currentLineIdx] && currentLineIdx >= 0) {
            const div = document.createElement('div');
            div.className = 'code-line';
            codeStream.appendChild(div);
          }
          if (codeStream.children[currentLineIdx]) {
            const curL = CODE_LINES[currentLineIdx];
            codeStream.children[currentLineIdx].innerHTML = renderLineHTML(curL, currentCharCount, true);
          }
        }
        lastLineIndex = currentLineIdx;
        lastCharCount = currentCharCount;
        codeStream.scrollTop = codeStream.scrollHeight;
      }

      // Dim left code stream smoothly as character awakes to draw full focus
      if (t >= 6000) {
        const dimFade = smooth((t - 6000) / 1500);
        codeStream.style.opacity = String(1.0 - 0.55 * dimFade);
      } else {
        codeStream.style.opacity = '1';
      }
    }

    // 8. Climax Soft Photonic Flash into Antigravity (NO CENTER LINE)
    const shutterStart = TOTAL_DURATION - 800;
    if (t >= shutterStart) {
      if (shutter) {
        shutter.style.opacity = '0';
        shutter.style.display = 'none';
      }
      if (flash) {
        const fProg = clamp((t - shutterStart) / 420);
        const fFade = Math.max(0, 1 - (t - (shutterStart + 420)) / 380);
        flash.style.opacity = String(smooth(fProg) * fFade);
      }
    } else {
      if (shutter) {
        shutter.style.opacity = '0';
        shutter.style.display = 'none';
      }
      if (flash) flash.style.opacity = '0';
    }

    // 9. Completion Check
    if (t >= TOTAL_DURATION && !completed) {
      completed = true;
      send('complete', { videoTime: video ? video.currentTime : 0 });
      if (!embedded) {
        pause();
      }
    }
  }

  function tick(timestamp) {
    if (!playing) return;
    elapsed = timestamp - origin;
    if (elapsed > TOTAL_DURATION) elapsed = TOTAL_DURATION;
    render(elapsed);
    if (elapsed < TOTAL_DURATION) {
      frame = requestAnimationFrame(tick);
    }
  }

  function play() {
    if (completed && elapsed >= TOTAL_DURATION) {
      elapsed = 0;
      completed = false;
      lastLineIndex = -1;
      if (canvas) {
        canvas.style.display = 'block';
        canvas.style.opacity = '1';
      }
    }
    playing = true;
    origin = performance.now() - elapsed;
    if (pauseBtn) pauseBtn.textContent = 'Tạm dừng';
    if (isAuthentic && masterVideo) {
      masterVideo.muted = true;
      masterVideo.play().catch(() => {});
    }
    if (video) {
      if (elapsed >= 3500) {
        video.play().catch(() => {});
      } else {
        video.pause();
        video.currentTime = 0;
      }
    }
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(tick);
  }

  function pause() {
    playing = false;
    cancelAnimationFrame(frame);
    if (pauseBtn) pauseBtn.textContent = 'Tiếp tục';
    if (isAuthentic && masterVideo) masterVideo.pause();
    if (video) video.pause();
  }

  function seek(targetMs) {
    elapsed = Math.max(0, Math.min(TOTAL_DURATION, targetMs));
    origin = performance.now() - elapsed;
    lastLineIndex = -1;
    if (elapsed < 3500 && canvas) {
      canvas.style.display = 'block';
      canvas.style.opacity = '1';
    }
    render(elapsed);
    if (isAuthentic && masterVideo && masterVideo.duration) {
      masterVideo.currentTime = Math.min(masterVideo.duration, elapsed / 1000);
    }
    if (video && video.duration) {
      video.currentTime = elapsed < 3500 ? 0 : Math.min(video.duration, (elapsed - 3500) / 1000);
    }
  }

  function restart() {
    pause();
    completed = false;
    lastLineIndex = -1;
    if (video) {
      try { video.currentTime = 0; } catch (_) {}
    }
    seek(0);
    play();
  }

  function getActivePalette() {
    if (currentThemePreset === 'auto') {
      if (autoPalette) return autoPalette;
      if (window.imageSettings?.extractPalette && video && video.readyState >= 2) {
        autoPalette = window.imageSettings.extractPalette(video);
        return autoPalette;
      }
      if (window.imageSettings?.extractPalette && artwork && artwork.complete) {
        autoPalette = window.imageSettings.extractPalette(artwork);
        return autoPalette;
      }
    }
    const presets = window.imageSettings?.THEME_PRESETS;
    if (presets && presets[currentThemePreset]) {
      return presets[currentThemePreset];
    }
    return {
      base: '10 14 26',
      tint: '56 189 248',
      violet: '192 132 252'
    };
  }

  function applyWallpaperSettings() {
    const pal = getActivePalette();
    const isCustomVid = userConfig?.video && !userConfig.video.includes('/startup-video.mp4') && !userConfig.video.includes('/wallpaper-tiktok.mp4') && !userConfig.video.startsWith('http://127.0.0.1:') && !userConfig.video.startsWith('http://localhost:');
    send('background', {
      strength: wallpaperStrength,
      editorOpacity: editorOpacity,
      themePreset: currentThemePreset,
      palette: pal,
      isVideo: true,
      video: (isCustomVid ? userConfig.video : null) || assets.wallpaperVideo || assets.video,
      image: userConfig?.artwork || assets.artwork
    });
  }

  async function loadUserConfig() {
    try {
      if (window.imageSettings) {
        userConfig = await window.imageSettings.load();
        const isCustomVid = userConfig?.video && !userConfig.video.includes('/startup-video.mp4') && !userConfig.video.includes('/wallpaper-tiktok.mp4') && !userConfig.video.startsWith('http://127.0.0.1:') && !userConfig.video.startsWith('http://localhost:');
        if (isCustomVid && video) {
          video.src = userConfig.video;
        } else if (video && assets.video) {
          video.src = assets.video;
        }
        if (userConfig.artwork && artwork) {
          artwork.src = userConfig.artwork;
        } else if (artwork && (!artwork.src || artwork.src.endsWith('/'))) {
          artwork.src = assets.artwork;
        }
        if (userConfig.contours) {
          initContours(userConfig.contours);
        }
        if (typeof userConfig.strength === 'number') {
          wallpaperStrength = userConfig.strength;
          if (wallpaperSlider) wallpaperSlider.value = String(wallpaperStrength);
          if (wallpaperValue) wallpaperValue.textContent = `${wallpaperStrength}%`;
        }
        if (typeof userConfig.editorOpacity === 'number') {
          editorOpacity = userConfig.editorOpacity;
          if (editorOpacitySlider) editorOpacitySlider.value = String(editorOpacity);
          if (editorOpacityValue) editorOpacityValue.textContent = `${editorOpacity}%`;
        }
        if (userConfig.themePreset) {
          currentThemePreset = userConfig.themePreset;
          if (themeSelect) themeSelect.value = currentThemePreset;
        }
      }
    } catch (_) {}

    applyWallpaperSettings();
  }

  function setupEvents() {
    // Playback Buttons
    pauseBtn?.addEventListener('click', () => (playing ? pause() : play()));
    replayBtn?.addEventListener('click', restart);

    // Timeline Slider
    slider?.addEventListener('input', e => {
      seek(Number(e.target.value) * 1000);
    });

    // Skip Buttons
    const skip = () => {
      completed = true;
      send('complete', { videoTime: video ? video.currentTime : 0 });
      if (!embedded) {
        seek(TOTAL_DURATION);
      }
    };

    $('.skip')?.addEventListener('click', skip);
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') skip();
      else if (e.code === 'Space' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        playing ? pause() : play();
      }
    });

    // Settings Modal
    $('#image-settings')?.addEventListener('click', () => openSettings());
    $('#settings-dialog form')?.addEventListener('submit', () => send('settings-close'));

    themeSelect?.addEventListener('change', e => {
      currentThemePreset = e.target.value;
      autoPalette = null;
      applyWallpaperSettings();
    });

    editorOpacitySlider?.addEventListener('input', e => {
      editorOpacity = Number(e.target.value);
      if (editorOpacityValue) editorOpacityValue.textContent = `${editorOpacity}%`;
      applyWallpaperSettings();
    });

    wallpaperSlider?.addEventListener('input', e => {
      wallpaperStrength = Number(e.target.value);
      if (wallpaperValue) wallpaperValue.textContent = `${wallpaperStrength}%`;
      applyWallpaperSettings();
    });

    $('#video-file')?.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        $('#settings-status').textContent = 'Đang tải video mới...';
        const res = await window.imageSettings.importVideo(file);
        userConfig = { ...userConfig, video: res.video };
        if (video) video.src = res.video;
        const previewV = $('#video-settings-preview');
        if (previewV) previewV.src = res.video;
        autoPalette = null;
        applyWallpaperSettings();
        $('#settings-status').textContent = 'Đã nạp video thành công.';
      } catch (err) {
        $('#settings-status').textContent = err.message;
      }
    });

    $('#artwork-file')?.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        $('#settings-status').textContent = 'Đang trích xuất nét vẽ Neon từ ảnh...';
        const res = await window.imageSettings.importImage(file, 'artwork');
        userConfig = { ...userConfig, artwork: res.artwork, contours: res.contours };
        if (artwork) artwork.src = res.artwork;
        const previewArt = $('#artwork-preview');
        if (previewArt) previewArt.src = res.artwork;
        initContours(res.contours);
        autoPalette = null;
        applyWallpaperSettings();
        $('#settings-status').textContent = 'Đã trích xuất nét vẽ thành công!';
      } catch (err) {
        $('#settings-status').textContent = err.message;
      }
    });

    dialog?.addEventListener('close', () => send('settings-close'));

    $('#replay-startup')?.addEventListener('click', () => {
      dialog?.close();
      send('settings-close');
      restart();
    });

    $('#preview-images')?.addEventListener('click', async () => {
      try {
        await window.imageSettings.save({
          ...userConfig,
          strength: wallpaperStrength,
          editorOpacity: editorOpacity,
          themePreset: currentThemePreset
        });
        applyWallpaperSettings();
        $('#settings-status').textContent = 'Đã lưu cài đặt và áp dụng theme thành công!';
        dialog?.close();
        send('settings-close');
        if (!embedded) {
          restart();
        }
      } catch (err) {
        $('#settings-status').textContent = err.message;
      }
    });

    $('#reset-images')?.addEventListener('click', async () => {
      try {
        await window.imageSettings.save({});
        $('#settings-status').textContent = 'Đã đặt lại về mặc định.';
        location.reload();
      } catch (_) {}
    });
  }

  function openSettings() {
    if (!dialog) return;
    dialog.showModal();
    send('settings-open');
  }

  async function init() {
    setupEvents();
    await loadUserConfig();

    if (window.ANTIGRAVITY_OPEN_SETTINGS || window.AEMEATH_OPEN_SETTINGS) {
      openSettings();
      send('ready');
      return;
    }

    send('ready');
    const seekParam = new URLSearchParams(location.search).get('seek');
    if (seekParam) {
      const targetS = Number(seekParam);
      seek(targetS * 1000);
      pause();
      if (masterVideo) {
        masterVideo.currentTime = targetS;
        masterVideo.addEventListener('loadedmetadata', () => {
          masterVideo.currentTime = targetS;
        }, { once: true });
      }
      if (video) {
        const vidTime = targetS < 3.2 ? 0 : (targetS - 3.2);
        if (video.duration && isFinite(video.duration)) {
          video.currentTime = Math.min(video.duration, vidTime);
        } else {
          video.addEventListener('loadedmetadata', () => {
            video.currentTime = Math.min(video.duration, vidTime);
          }, { once: true });
        }
      }
    } else {
      const startAt = Math.max(0, Math.min(TOTAL_DURATION - 200, Number(window.ANTIGRAVITY_START_AT) || 0));
      if (startAt > 0) {
        pause();
        completed = false;
        lastLineIndex = -1;
        seek(startAt);
        if (video && startAt >= 3500) {
          const vidTime = (startAt - 3500) / 1000;
          const applyTime = () => { try { video.currentTime = Math.min(video.duration || vidTime, vidTime); } catch (_) {} };
          if (video.readyState >= 1) applyTime();
          else video.addEventListener('loadedmetadata', applyTime, { once: true });
        }
        play();
      } else {
        restart();
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.antigravityLauncherUI = {
    openSettings,
    restart,
    seek,
    play,
    pause
  };
})();
