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

  setPreset("phone");
})();
