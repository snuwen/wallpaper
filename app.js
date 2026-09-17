(() => {
  const PRESETS = {
    phone: { width: 1080, height: 1920 },
    phone4k: { width: 2160, height: 3840 },
    desktop: { width: 1920, height: 1080 },
    desktop4k: { width: 3840, height: 2160 },
  };

  const canvas = document.getElementById("preview");
  const dimsLabel = document.getElementById("dimsLabel");
  const customSizeRow = document.getElementById("customSizeRow");
  const customWidthInput = document.getElementById("customWidth");
  const customHeightInput = document.getElementById("customHeight");
  const exportBtn = document.getElementById("exportBtn");
  const exportStatus = document.getElementById("exportStatus");
  const exportHtmlBtn = document.getElementById("exportHtmlBtn");
  const exportHtmlStatus = document.getElementById("exportHtmlStatus");
  const togglePlayBtn = document.getElementById("togglePlay");
  const darkenTopInput = document.getElementById("darkenTop");
  const supersampleSelect = document.getElementById("supersample");
  const colorInputs = [1, 2, 3, 4].map((n) => document.getElementById(`color${n}`));

  const state = {
    preset: "phone",
    width: PRESETS.phone.width,
    height: PRESETS.phone.height,
    colors: colorInputs.map((el) => el.value),
    darkenTop: false,
    seed: Math.random() * 1000,
    playing: true,
  };

  // Live preview renders at a capped-but-DPR-aware resolution so it stays
  // crisp on the screen without paying full export cost every frame; the
  // PNG export always re-renders from scratch at full target resolution
  // with extra supersampling (see exportPNG below). The *logical* size
  // passed to the renderer (see initRenderer) is always state.width/height
  // regardless of this pixel resolution, so the noise pattern's frequency
  // matches what export produces - only pixel density differs.
  const MAX_PREVIEW_LONG_EDGE = 1400;

  function previewResolution(width, height) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const longEdge = Math.max(width, height);
    const scale = Math.min(dpr, MAX_PREVIEW_LONG_EDGE / longEdge) || dpr;
    return {
      w: Math.max(2, Math.round(width * scale)),
      h: Math.max(2, Math.round(height * scale)),
    };
  }

  let renderer = null;

  function syncPlayButton() {
    togglePlayBtn.textContent = state.playing ? "Pause" : "Resume";
  }

  function initRenderer() {
    const { w, h } = previewResolution(state.width, state.height);
    if (renderer) renderer.pause();
    renderer = new GradientRenderer(canvas, {
      colors: state.colors,
      darkenTop: state.darkenTop,
      seed: state.seed,
    });
    renderer.init(w, h, 1.4, state.width, state.height);
    if (state.playing) {
      renderer.play();
    } else {
      // Not playing: draw one static frame so the new layout/seed is
      // reflected immediately instead of showing a blank canvas until Resume.
      renderer.renderFrame(renderer.time);
    }
    syncPlayButton();
  }

  function applyLayout() {
    canvas.style.aspectRatio = `${state.width} / ${state.height}`;
    dimsLabel.textContent = `${state.width} × ${state.height}px`;
    initRenderer();
  }

  // While paused there is no animation loop redrawing the canvas, so any
  // state change (color, darken-top) needs an explicit repaint to show up.
  function refreshIfPaused() {
    if (renderer && !state.playing) renderer.renderFrame(renderer.time);
  }

  function setPreset(name) {
    state.preset = name;
    document.querySelectorAll(".preset-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.preset === name);
    });
    customSizeRow.hidden = name !== "custom";
    if (name === "custom") {
      state.width = clampDim(parseInt(customWidthInput.value, 10) || 1080);
      state.height = clampDim(parseInt(customHeightInput.value, 10) || 1920);
    } else {
      state.width = PRESETS[name].width;
      state.height = PRESETS[name].height;
    }
    applyLayout();
  }

  function clampDim(v) {
    return Math.max(16, Math.min(8000, v));
  }

  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => setPreset(btn.dataset.preset));
  });

  [customWidthInput, customHeightInput].forEach((input) => {
    input.addEventListener("change", () => {
      if (state.preset !== "custom") return;
      state.width = clampDim(parseInt(customWidthInput.value, 10) || state.width);
      state.height = clampDim(parseInt(customHeightInput.value, 10) || state.height);
      applyLayout();
    });
  });

  colorInputs.forEach((input, i) => {
    input.addEventListener("input", () => {
      state.colors[i] = input.value;
      if (renderer) renderer.setColors(state.colors);
      refreshIfPaused();
    });
  });

  document.getElementById("randomizeColors").addEventListener("click", () => {
    const hue = Math.floor(Math.random() * 360);
    const hexColors = [0, 90, 180, 270].map((offset) => {
      const h = (hue + offset + (Math.random() * 40 - 20)) % 360;
      return hslToHex(h, 70 + Math.random() * 20, 45 + Math.random() * 15);
    });
    hexColors.forEach((hex, i) => {
      state.colors[i] = hex;
      colorInputs[i].value = hex;
    });
    if (renderer) renderer.setColors(state.colors);
    refreshIfPaused();
  });

  function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const toHex = (x) => Math.round(255 * x).toString(16).padStart(2, "0");
    return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
  }

  darkenTopInput.addEventListener("change", () => {
    state.darkenTop = darkenTopInput.checked;
    if (renderer) renderer.setDarkenTop(state.darkenTop);
    refreshIfPaused();
  });

  togglePlayBtn.addEventListener("click", () => {
    if (!renderer) return;
    state.playing = !state.playing;
    if (state.playing) {
      renderer.play();
    } else {
      renderer.pause();
    }
    syncPlayButton();
  });

  document.getElementById("reshuffle").addEventListener("click", () => {
    state.seed = Math.random() * 1000;
    applyLayout();
  });

  window.addEventListener("resize", () => {
    // Preview backing resolution depends on devicePixelRatio, so a monitor
    // change or browser zoom should re-render at the correct resolution.
    applyLayout();
  });

  async function exportPNG() {
    exportBtn.disabled = true;
    exportStatus.textContent = "Rendering...";
    try {
      await new Promise((r) => requestAnimationFrame(r));
      const supersample = parseFloat(supersampleSelect.value);
      const outCanvas = GradientRenderer.renderStill({
        width: state.width,
        height: state.height,
        colors: state.colors,
        darkenTop: state.darkenTop,
        seed: state.seed,
        time: renderer ? renderer.time : undefined,
        supersample,
        meshQuality: 2.2,
      });
      const blob = await new Promise((resolve) => outCanvas.toBlob(resolve, "image/png"));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gradient-wallpaper-${state.width}x${state.height}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      exportStatus.textContent = `Done: ${state.width}×${state.height}px PNG downloaded.`;
    } catch (err) {
      console.error(err);
      exportStatus.textContent = "Something went wrong during export.";
    } finally {
      exportBtn.disabled = false;
    }
  }

  exportBtn.addEventListener("click", exportPNG);

  // A literal "</script" anywhere in the embedded source would close the
  // <script> tag early when the browser's HTML parser scans for it - it
  // doesn't care that the text is inside a JS string. None of our own
  // source contains that sequence, but this is cheap insurance.
  function escapeScriptClose(str) {
    return str.replace(/<\/script/gi, "<\\/script");
  }

  function buildStandaloneHtml(engineSource, config) {
    const configJson = escapeScriptClose(JSON.stringify(config));
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Animated Gradient Wallpaper</title>
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000; }
  canvas { display: block; width: 100vw; height: 100vh; }
</style>
</head>
<body>
<canvas id="gradient"></canvas>
<script>
${escapeScriptClose(engineSource)}
</script>
<script>
(function () {
  var config = ${configJson};
  var canvas = document.getElementById("gradient");
  // Denser than the live preview (matches export quality) since this
  // renders continuously at whatever size OBS (or the browser) gives it,
  // with no further supersampling pass to clean up mesh facets.
  var MESH_QUALITY = 1.6;
  var renderer = null;

  // Real pixel resolution follows the actual window/OBS-source size, capped
  // devicePixelRatio like the live preview; config.logicalWidth/Height (the
  // size chosen in the studio) stays fixed so the waves keep the same
  // scale/shape regardless of what size this ends up displayed at.
  function pixelSize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    return {
      w: Math.max(2, Math.round(window.innerWidth * dpr)),
      h: Math.max(2, Math.round(window.innerHeight * dpr)),
    };
  }

  function start() {
    var size = pixelSize();
    renderer = new GradientRenderer(canvas, {
      colors: config.colors,
      darkenTop: config.darkenTop,
      seed: config.seed,
    });
    renderer.init(size.w, size.h, MESH_QUALITY, config.logicalWidth, config.logicalHeight);
    renderer.play();
  }

  var resizeTimeout;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function () {
      if (!renderer) return;
      var size = pixelSize();
      renderer.setSize(size.w, size.h, MESH_QUALITY, config.logicalWidth, config.logicalHeight);
    }, 150);
  });

  start();
})();
</script>
</body>
</html>
`;
  }

  async function exportAnimatedHTML() {
    exportHtmlBtn.disabled = true;
    exportHtmlStatus.textContent = "Building file...";
    try {
      // Read the engine's source from the inline <script type="text/plain">
      // block index.html embeds it in (see index.template.html) instead of
      // fetch()-ing gradient-engine.js: fetch of a local file is blocked by
      // the browser when this page itself was just opened from disk
      // (file://), which is exactly how most people will open this tool.
      const engineSourceEl = document.getElementById("engineSource");
      if (!engineSourceEl || !engineSourceEl.textContent.trim()) {
        throw new Error("Could not find the embedded engine source.");
      }
      const engineSource = engineSourceEl.textContent;

      const html = buildStandaloneHtml(engineSource, {
        colors: state.colors,
        darkenTop: state.darkenTop,
        seed: state.seed,
        logicalWidth: state.width,
        logicalHeight: state.height,
      });

      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gradient-wallpaper-animated-${state.width}x${state.height}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      exportHtmlStatus.textContent = "Done: animated .html file downloaded - add it as a Browser Source in OBS.";
    } catch (err) {
      console.error(err);
      exportHtmlStatus.textContent = "Something went wrong while building the file. See the browser console for details.";
    } finally {
      exportHtmlBtn.disabled = false;
    }
  }

  exportHtmlBtn.addEventListener("click", exportAnimatedHTML);

  setPreset("phone");
})();
