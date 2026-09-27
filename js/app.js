/* =========================================================
   Tamayura Virtual Try-on  —  試着ページの動き
   ---------------------------------------------------------
   ・写真はブラウザの中（canvas）だけで処理します。
     サーバーへ送る処理は一切ありません。
   ・画面の表示と保存画像は同じ描画処理（drawScene）を使うので、
     見たままの画像が保存されます。
   ========================================================= */
(function () {
  'use strict';

  const CONFIG = window.TAMAYURA_CONFIG;
  const DESIGNS = window.TAMAYURA_DESIGNS;
  const $ = (id) => document.getElementById(id);

  /* ---------- 状態 ---------- */
  const state = {
    photo: null,          // 読み込んだ写真（縮小済みの canvas）
    photoIsSample: false,
    layers: [],           // 配置したデザイン { design, img, x, y, size, rot, flip }
    selected: -1,         // 選択中のデザイン番号
    showAfter: true,      // Before / After
    bodyPart: CONFIG.DEFAULT_BODY_PART,
    blendMode: 'jagua',   // 'jagua' | 'original'
    inkId: CONFIG.DEFAULT_INK,
    opacity: CONFIG.DEFAULT_OPACITY / 100,
    category: 'すべて',
    interacting: false,   // 操作中は軽い描画にする
  };

  const canvas = $('stageCanvas');
  const ctx = canvas.getContext('2d');
  const view = { dpr: 1, w: 0, h: 0, scale: 1, ox: 0, oy: 0 };

  /* =========================================================
     画像の読み込み
     ========================================================= */
  const imageCache = new Map();
  function loadDesignImage(design) {
    if (imageCache.has(design.id)) return imageCache.get(design.id);
    const p = new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('design load failed: ' + design.src));
      img.src = design.src;
    });
    imageCache.set(design.id, p);
    return p;
  }

  // 写真を読み込み、大きすぎる場合は縮小して canvas に描き写す
  function loadPhotoFile(file) {
    if (!file) return;
    if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|heic|heif|gif)$/i.test(file.name)) {
      toast('画像ファイルを選んでください');
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setPhoto(imageToCanvas(img), false);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      toast('この画像は読み込めませんでした。JPEG か PNG でお試しください');
    };
    img.src = url;
  }

  function imageToCanvas(img) {
    const max = CONFIG.MAX_PHOTO_SIZE;
    const w0 = img.naturalWidth, h0 = img.naturalHeight;
    const k = Math.min(1, max / Math.max(w0, h0));
    const c = document.createElement('canvas');
    c.width = Math.round(w0 * k);
    c.height = Math.round(h0 * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  // サンプル写真（腕のイメージ）をその場で描く。外部画像は使いません
  function makeSamplePhoto() {
    const W = 1200, H = 1600;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#d7dbe3'); bg.addColorStop(1, '#b9bfcb');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);

    // 腕の形
    g.save();
    g.translate(W / 2, H / 2);
    g.rotate(-0.18);
    const arm = new Path2D();
    arm.moveTo(-300, -1000);
    arm.bezierCurveTo(-330, -300, -270, 300, -210, 1000);
    arm.lineTo(250, 1000);
    arm.bezierCurveTo(300, 300, 340, -300, 320, -1000);
    arm.closePath();
    const skin = g.createLinearGradient(-320, 0, 320, 0);
    skin.addColorStop(0, '#b77c5c');
    skin.addColorStop(0.18, '#d9a584');
    skin.addColorStop(0.55, '#e8bb9c');
    skin.addColorStop(0.85, '#d19a79');
    skin.addColorStop(1, '#a86e50');
    g.shadowColor = 'rgba(40,30,30,.35)'; g.shadowBlur = 60; g.shadowOffsetX = 20;
    g.fillStyle = skin; g.fill(arm);
    g.shadowColor = 'transparent';
    g.clip(arm);
    // 肌のきめ（細かな点）
    for (let i = 0; i < 9000; i++) {
      const x = -340 + Math.random() * 680, y = -1000 + Math.random() * 2000;
      g.fillStyle = Math.random() < .5 ? 'rgba(120,70,50,.06)' : 'rgba(255,235,220,.07)';
      g.beginPath(); g.arc(x, y, 1 + Math.random() * 2.2, 0, Math.PI * 2); g.fill();
    }
    g.restore();

    g.fillStyle = 'rgba(22,26,38,.45)';
    g.font = '600 30px sans-serif';
    g.fillText('SAMPLE', 40, H - 40);
    return c;
  }

  function setPhoto(photoCanvas, isSample) {
    state.photo = photoCanvas;
    state.photoIsSample = isSample;
    // 写真を変えても、置いたデザインは同じ位置関係で残す
    state.layers.forEach((l) => fitLayerToPhoto(l));
    $('emptyState').hidden = true;
    $('stageTools').hidden = false;
    $('changePhotoBtn').hidden = false;
    showHint();
    updateUI();
    requestDraw();
  }

  /* =========================================================
     サイズ（cm の目安）
     ========================================================= */
  function bodyPart() {
    return CONFIG.BODY_PARTS.find((p) => p.id === state.bodyPart) || CONFIG.BODY_PARTS[0];
  }
  // 写真 1cm あたりのピクセル数（目安）
  function pxPerCm() {
    if (!state.photo) return 1;
    return Math.min(state.photo.width, state.photo.height) / bodyPart().frameCm;
  }
  // サイズは「面積」で区分：デザインの縦×横と同じ面積の正方形の一辺を cm とする
  // （丸や正方形のデザインは見た目どおり、細長いデザインは長くなる）
  function areaFactor(layer) {
    const a = layer.img.naturalWidth / layer.img.naturalHeight || 1;
    return Math.sqrt(Math.max(a, 1 / a));
  }
  function layerCm(layer) { return layer.size / areaFactor(layer) / pxPerCm(); }
  function setLayerCm(layer, cm) { layer.size = clampSize(cm * pxPerCm() * areaFactor(layer)); }

  // その cm がどの料金区分に入るか（区分の上限を超えないいちばん小さい区分）
  function sizeTier(cm) {
    const tiers = CONFIG.SIZE_TIERS;
    return tiers.find((t) => cm <= t.cm + 0.25) || null;
  }
  const yen = (n) => '¥' + n.toLocaleString('ja-JP');
  function tierPriceText(t) {
    if (!t) return CONFIG.OVER_SIZE_TEXT;
    return t.price ? yen(t.price) : (t.note || '要相談');
  }
  function clampSize(size) {
    if (!state.photo) return size;
    const min = Math.min(state.photo.width, state.photo.height) * 0.03;
    const max = Math.max(state.photo.width, state.photo.height) * 2.5;
    return Math.max(min, Math.min(max, size));
  }

  /* =========================================================
     デザインの配置
     ========================================================= */
  function layerBox(layer) {
    const a = layer.img.naturalWidth / layer.img.naturalHeight || 1;
    return a >= 1 ? { w: layer.size, h: layer.size / a } : { w: layer.size * a, h: layer.size };
  }

  function newLayer(design, img) {
    const p = state.photo;
    const layer = { design, img, x: p.width / 2, y: p.height / 2, size: 0, rot: 0, flip: false };
    setLayerCm(layer, 5); // 最初は 5cm で置く
    // 写真からはみ出すほど大きい場合は小さくする
    const maxSize = Math.min(p.width, p.height) * 0.7;
    if (layer.size > maxSize) layer.size = maxSize;
    return layer;
  }

  function fitLayerToPhoto(layer) {
    const p = state.photo;
    layer.x = Math.max(0, Math.min(p.width, layer.x));
    layer.y = Math.max(0, Math.min(p.height, layer.y));
    layer.size = clampSize(layer.size);
  }

  async function chooseDesign(design) {
    if (!state.photo) {
      toast('先に写真を選んでください');
      return;
    }
    let img;
    try {
      img = await loadDesignImage(design);
    } catch (e) {
      toast('デザイン画像を読み込めませんでした（' + design.src + '）');
      return;
    }
    const current = state.layers[state.selected];
    if (current && state.layers.length >= CONFIG.MAX_LAYERS) {
      // 置いてあるデザインを差し替え（位置・サイズ区分・角度はそのまま）
      const cm = layerCm(current);
      current.design = design;
      current.img = img;
      setLayerCm(current, cm);
    } else if (state.layers.length >= CONFIG.MAX_LAYERS) {
      const l = state.layers[state.layers.length - 1];
      const cm = layerCm(l);
      l.design = design; l.img = img;
      setLayerCm(l, cm);
      state.selected = state.layers.length - 1;
    } else {
      state.layers.push(newLayer(design, img));
      state.selected = state.layers.length - 1;
    }
    state.showAfter = true;
    updateUI();
    requestDraw();
  }

  function selectedLayer() { return state.layers[state.selected] || null; }

  function deleteSelected() {
    if (!selectedLayer()) return;
    state.layers.splice(state.selected, 1);
    state.selected = state.layers.length ? state.layers.length - 1 : -1;
    updateUI();
    requestDraw();
  }

  function resetSelected() {
    const l = selectedLayer();
    if (!l) return;
    const fresh = newLayer(l.design, l.img);
    Object.assign(l, { x: fresh.x, y: fresh.y, size: fresh.size, rot: 0, flip: false });
    updateUI();
    requestDraw();
  }

  /* =========================================================
     描画
     ========================================================= */
  // デザインをジャグアの色に染めた画像を作る（色ごとにキャッシュ）
  const tintCache = new WeakMap();
  function tintedImage(img, color) {
    let perImg = tintCache.get(img);
    if (!perImg) { perImg = new Map(); tintCache.set(img, perImg); }
    if (perImg.has(color)) return perImg.get(color);
    const max = 1400;
    const a = img.naturalWidth / img.naturalHeight || 1;
    const c = document.createElement('canvas');
    c.width = Math.round(a >= 1 ? max : max * a);
    c.height = Math.round(a >= 1 ? max / a : max);
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, c.width, c.height);
    g.globalCompositeOperation = 'source-in';  // 形はそのまま、色だけ塗り替える
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    perImg.set(color, c);
    return c;
  }

  function inkColor() {
    const ink = CONFIG.INK_COLORS.find((i) => i.id === state.inkId) || CONFIG.INK_COLORS[0];
    return ink.color;
  }

  /**
   * 写真とデザインを描く（画面表示・保存の共通処理）
   * g        : 描画先
   * deviceK  : 写真1px が描画先の何pxになるか（にじみの強さ計算用）
   * light    : true なら軽い描画（ドラッグ中など）
   */
  function drawScene(g, { after = true, deviceK = 1, light = false } = {}) {
    g.drawImage(state.photo, 0, 0);
    if (!after) return;
    for (const l of state.layers) {
      const { w, h } = layerBox(l);
      g.save();
      g.translate(l.x, l.y);
      g.rotate(l.rot);
      if (l.flip) g.scale(-1, 1);
      g.globalAlpha = state.opacity;
      if (state.blendMode === 'jagua') {
        // 乗算で重ねると、肌の陰影やきめが透けて「描いた」ように見える
        g.globalCompositeOperation = 'multiply';
        const color = inkColor();
        if (!light) {
          // ほんの少しのにじみ
          g.shadowColor = color;
          g.shadowBlur = Math.max(0.6, l.size * 0.004 * deviceK);
        }
        g.drawImage(tintedImage(l.img, color), -w / 2, -h / 2, w, h);
      } else {
        g.drawImage(l.img, -w / 2, -h / 2, w, h);
      }
      g.restore();
    }
  }

  let drawQueued = false;
  function requestDraw() {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(() => { drawQueued = false; drawStage(); });
  }

  function resizeCanvas() {
    const r = canvas.getBoundingClientRect();
    view.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    view.w = r.width; view.h = r.height;
    canvas.width = Math.round(r.width * view.dpr);
    canvas.height = Math.round(r.height * view.dpr);
    requestDraw();
  }

  function drawStage() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!state.photo) return;
    const p = state.photo;
    const pad = 0;
    view.scale = Math.min((view.w - pad * 2) / p.width, (view.h - pad * 2) / p.height);
    view.ox = (view.w - p.width * view.scale) / 2;
    view.oy = (view.h - p.height * view.scale) / 2;

    const k = view.dpr * view.scale;
    ctx.setTransform(k, 0, 0, k, view.ox * view.dpr, view.oy * view.dpr);
    ctx.imageSmoothingQuality = 'high';
    drawScene(ctx, { after: state.showAfter, deviceK: k, light: state.interacting });

    // 選択枠とハンドル（画面上だけに表示。保存画像には入りません）
    const l = selectedLayer();
    if (l && state.showAfter) drawSelection(l);
  }

  function toScreen(px, py) { return { x: view.ox + px * view.scale, y: view.oy + py * view.scale }; }
  function toPhoto(sx, sy) { return { x: (sx - view.ox) / view.scale, y: (sy - view.oy) / view.scale }; }

  // 選択枠の四隅（画面座標）
  function layerCorners(l) {
    const { w, h } = layerBox(l);
    const cos = Math.cos(l.rot), sin = Math.sin(l.rot);
    const m = 8 / view.scale; // 枠を少し外側に
    const pts = [[-w / 2 - m, -h / 2 - m], [w / 2 + m, -h / 2 - m], [w / 2 + m, h / 2 + m], [-w / 2 - m, h / 2 + m]];
    return pts.map(([x, y]) => toScreen(l.x + x * cos - y * sin, l.y + x * sin + y * cos));
  }

  function drawSelection(l) {
    const c = layerCorners(l);
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,.95)';
    ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 4;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    c.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    // 削除（左上）
    drawHandle(c[0], '#ffffff', (g, x, y) => {
      g.strokeStyle = '#c23a4a'; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(x - 5, y - 5); g.lineTo(x + 5, y + 5); g.moveTo(x + 5, y - 5); g.lineTo(x - 5, y + 5); g.stroke();
    });
    // 拡大・回転（右下）
    drawHandle(c[2], '#3346e0', (g, x, y) => {
      g.strokeStyle = '#ffffff'; g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, 6, -Math.PI * 0.9, Math.PI * 0.4); g.stroke();
      g.beginPath(); g.moveTo(x + 2, y + 7); g.lineTo(x + 7, y + 5); g.lineTo(x + 5, y + 10); g.stroke();
    });
    ctx.restore();
  }
  function drawHandle(p, fill, icon) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 8;
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = 'transparent';
    icon(ctx, p.x, p.y);
    ctx.restore();
  }

  /* =========================================================
     指・マウスでの操作
     ========================================================= */
  const pointers = new Map();
  let gesture = null;

  function localPoint(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function hitLayer(sp) {
    const p = toPhoto(sp.x, sp.y);
    for (let i = state.layers.length - 1; i >= 0; i--) {
      const l = state.layers[i];
      const { w, h } = layerBox(l);
      const dx = p.x - l.x, dy = p.y - l.y;
      const cos = Math.cos(-l.rot), sin = Math.sin(-l.rot);
      const lx = dx * cos - dy * sin, ly = dx * sin + dy * cos;
      const m = 12 / view.scale;
      if (Math.abs(lx) <= w / 2 + m && Math.abs(ly) <= h / 2 + m) return i;
    }
    return -1;
  }
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function beginGesture() {
    const l = selectedLayer();
    const pts = [...pointers.values()];
    if (!l || !state.showAfter) { gesture = null; return; }
    if (pts.length >= 2) {
      const [a, b] = pts;
      gesture = {
        type: 'pinch',
        d0: Math.max(10, dist(a, b)),
        a0: Math.atan2(b.y - a.y, b.x - a.x),
        m0: toPhoto((a.x + b.x) / 2, (a.y + b.y) / 2),
        start: { x: l.x, y: l.y, size: l.size, rot: l.rot },
      };
    } else if (pts.length === 1) {
      const p = toPhoto(pts[0].x, pts[0].y);
      gesture = { type: 'drag', p0: p, start: { x: l.x, y: l.y } };
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!state.photo) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
    const sp = localPoint(e);
    pointers.set(e.pointerId, sp);

    if (pointers.size === 1) {
      const l = selectedLayer();
      if (l && state.showAfter) {
        const c = layerCorners(l);
        if (dist(sp, c[0]) < 24) { pointers.clear(); deleteSelected(); return; }
        if (dist(sp, c[2]) < 26) {
          const center = toScreen(l.x, l.y);
          gesture = {
            type: 'handle', center,
            d0: Math.max(10, dist(sp, center)),
            a0: Math.atan2(sp.y - center.y, sp.x - center.x),
            start: { size: l.size, rot: l.rot },
          };
          state.interacting = true;
          return;
        }
      }
      const hit = hitLayer(sp);
      if (hit >= 0) state.selected = hit;
      if (!state.showAfter && state.layers.length) {
        // Before 表示中に触ったら After に戻す
        state.showAfter = true;
        updateUI();
      }
    }
    state.interacting = true;
    beginGesture();
    requestDraw();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const sp = localPoint(e);
    pointers.set(e.pointerId, sp);
    const l = selectedLayer();
    if (!gesture || !l) return;

    if (gesture.type === 'drag') {
      const p = toPhoto(sp.x, sp.y);
      l.x = gesture.start.x + (p.x - gesture.p0.x);
      l.y = gesture.start.y + (p.y - gesture.p0.y);
      fitLayerToPhoto(l);
    } else if (gesture.type === 'pinch') {
      const [a, b] = [...pointers.values()];
      const d = dist(a, b);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const m = toPhoto((a.x + b.x) / 2, (a.y + b.y) / 2);
      l.size = clampSize(gesture.start.size * (d / gesture.d0));
      l.rot = normAngle(gesture.start.rot + (ang - gesture.a0));
      l.x = gesture.start.x + (m.x - gesture.m0.x);
      l.y = gesture.start.y + (m.y - gesture.m0.y);
      fitLayerToPhoto(l);
    } else if (gesture.type === 'handle') {
      const c = gesture.center;
      const d = dist(sp, c);
      const ang = Math.atan2(sp.y - c.y, sp.x - c.x);
      l.size = clampSize(gesture.start.size * (d / gesture.d0));
      l.rot = normAngle(gesture.start.rot + (ang - gesture.a0));
    }
    fadeHint();
    syncControls();
    requestDraw();
  });

  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
      gesture = null;
      state.interacting = false;
      syncControls();
      requestDraw();
    } else {
      beginGesture(); // 2本指 → 1本指になったとき飛ばないように基準を取り直す
    }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('lostpointercapture', endPointer);

  // PC：ホイールで拡大縮小、Shift + ホイールで回転
  let wheelTimer = 0;
  canvas.addEventListener('wheel', (e) => {
    const l = selectedLayer();
    if (!l) return;
    e.preventDefault();
    if (e.shiftKey) l.rot = normAngle(l.rot + (e.deltaY > 0 ? 1 : -1) * Math.PI / 90);
    else l.size = clampSize(l.size * Math.exp(-e.deltaY * 0.0015));
    state.interacting = true;
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => { state.interacting = false; requestDraw(); }, 150);
    syncControls();
    requestDraw();
  }, { passive: false });

  function normAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  /* =========================================================
     操作パネル
     ========================================================= */
  function buildDesignUI() {
    const cats = ['すべて', ...new Set(DESIGNS.map((d) => d.category))];
    const tabs = $('categoryTabs');
    tabs.innerHTML = '';
    cats.forEach((c) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = c;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(c === state.category));
      b.addEventListener('click', () => { state.category = c; buildDesignUI(); });
      tabs.appendChild(b);
    });

    const list = $('designList');
    list.innerHTML = '';
    const current = selectedLayer();
    DESIGNS.filter((d) => state.category === 'すべて' || d.category === state.category).forEach((d) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'design-card';
      b.setAttribute('aria-pressed', String(!!current && current.design.id === d.id));
      b.innerHTML = '<span class="design-thumb"><img alt="" loading="lazy"></span>' +
        '<span class="design-name"></span><span class="design-cat"></span>';
      b.querySelector('img').src = d.thumb || d.src;
      b.querySelector('.design-name').textContent = d.name;
      b.querySelector('.design-cat').textContent = d.category;
      b.addEventListener('click', () => chooseDesign(d));
      list.appendChild(b);
    });
  }

  function buildSizeUI() {
    const presets = $('sizePresets');
    CONFIG.SIZE_TIERS.forEach((t) => {
      const cm = t.cm;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.dataset.cm = cm;
      b.textContent = cm + 'cm';
      b.addEventListener('click', () => {
        const l = selectedLayer(); if (!l) return;
        setLayerCm(l, cm); syncControls(); requestDraw();
      });
      presets.appendChild(b);
    });

    const sel = $('bodyPartSelect');
    CONFIG.BODY_PARTS.forEach((p) => {
      const o = document.createElement('option');
      o.value = p.id; o.textContent = p.label;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => {
      const l = selectedLayer();
      const cm = l ? layerCm(l) : null;
      state.bodyPart = sel.value;
      if (l) setLayerCm(l, cm); // 同じ cm のまま、部位に合わせて大きさを取り直す
      syncControls(); requestDraw();
    });

    $('sizeRange').addEventListener('input', (e) => {
      const l = selectedLayer(); if (!l) return;
      setLayerCm(l, parseFloat(e.target.value)); syncControls(); requestDraw();
    });
  }

  function buildRotateUI() {
    $('rotateRange').addEventListener('input', (e) => {
      const l = selectedLayer(); if (!l) return;
      l.rot = parseFloat(e.target.value) * Math.PI / 180; syncControls(); requestDraw();
    });
    document.querySelectorAll('[data-rotate]').forEach((b) => b.addEventListener('click', () => {
      const l = selectedLayer(); if (!l) return;
      const v = parseFloat(b.dataset.rotate);
      l.rot = v === 0 ? 0 : normAngle(l.rot + v * Math.PI / 180);
      syncControls(); requestDraw();
    }));
    $('flipBtn').addEventListener('click', () => {
      const l = selectedLayer(); if (!l) return;
      l.flip = !l.flip; syncControls(); requestDraw();
    });
  }

  function buildBlendUI() {
    document.querySelectorAll('.segmented [data-mode]').forEach((b) => b.addEventListener('click', () => {
      state.blendMode = b.dataset.mode; syncControls(); requestDraw();
    }));
    const list = $('inkList');
    CONFIG.INK_COLORS.forEach((ink) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ink'; b.dataset.ink = ink.id;
      b.setAttribute('role', 'radio');
      b.innerHTML = '<span class="ink-dot"></span><span class="ink-label"></span>';
      b.querySelector('.ink-dot').style.background = ink.color;
      b.querySelector('.ink-label').textContent = ink.label;
      b.addEventListener('click', () => { state.inkId = ink.id; syncControls(); requestDraw(); });
      list.appendChild(b);
    });
    $('opacityRange').addEventListener('input', (e) => {
      state.opacity = parseFloat(e.target.value) / 100; syncControls(); requestDraw();
    });
  }

  // タブ切り替え
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => {
      const on = x === t;
      x.classList.toggle('is-active', on);
      x.setAttribute('aria-selected', String(on));
    });
    document.querySelectorAll('.pane').forEach((p) => { p.hidden = p.dataset.pane !== t.dataset.tab; });
  }));

  // 画面の表示を今の状態に合わせる
  function syncControls() {
    const l = selectedLayer();
    const has = !!l;
    const cm = has ? layerCm(l) : null;
    const tier = has ? sizeTier(cm) : null;
    $('sizeValue').textContent = has ? '約' + (Math.round(cm * 2) / 2) + 'cm' : '—';
    $('sizePrice').textContent = has ? (tier ? tier.cm + 'cm区分 ' + tierPriceText(tier) : CONFIG.OVER_SIZE_TEXT) : '';
    $('sizeCompare').textContent = has && tier ? tier.cm + 'cm は ' + tier.compare : '';
    if (has) $('sizeRange').value = Math.max(1, Math.min(20, cm));
    document.querySelectorAll('#sizePresets .chip').forEach((b) => {
      b.setAttribute('aria-pressed', String(has && Math.abs(cm - b.dataset.cm) < 0.25));
    });
    $('bodyPartSelect').value = state.bodyPart;

    const deg = has ? Math.round(l.rot * 180 / Math.PI) : 0;
    $('rotateValue').textContent = deg + '°';
    $('rotateRange').value = deg;
    $('flipBtn').setAttribute('aria-pressed', String(has && l.flip));

    document.querySelectorAll('.segmented [data-mode]').forEach((b) => {
      b.setAttribute('aria-checked', String(b.dataset.mode === state.blendMode));
    });
    document.querySelectorAll('#inkList .ink').forEach((b) => {
      b.setAttribute('aria-checked', String(b.dataset.ink === state.inkId));
    });
    $('inkList').classList.toggle('is-disabled', state.blendMode !== 'jagua');
    const ink = CONFIG.INK_COLORS.find((i) => i.id === state.inkId);
    $('inkNote').textContent = state.blendMode === 'jagua'
      ? (ink ? ink.label + '：' + ink.note : '')
      : 'デザイン画像の色そのままで重ねます';
    $('opacityRange').value = Math.round(state.opacity * 100);
    $('opacityValue').textContent = Math.round(state.opacity * 100) + '%';

    ['sizeRange', 'rotateRange', 'flipBtn', 'resetBtn', 'deleteBtn'].forEach((id) => { $(id).disabled = !has; });
    document.querySelectorAll('#sizePresets .chip, [data-rotate]').forEach((b) => { b.disabled = !has; });
    $('layerActions').hidden = !has;

    $('baToggle').setAttribute('aria-pressed', String(!state.showAfter));
    $('baToggle').disabled = !state.layers.length;
    $('finishBtn').disabled = !(state.photo && state.layers.length);
  }

  function updateUI() {
    buildDesignUI();
    syncControls();
  }

  /* ---------- ヒント表示 ---------- */
  let hintTimer = 0;
  function showHint() {
    const h = $('stageHint');
    h.hidden = false; h.classList.remove('is-faded');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(fadeHint, 6000);
  }
  function fadeHint() { $('stageHint').classList.add('is-faded'); }

  /* ---------- トースト ---------- */
  let toastTimer = 0;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
  }

  /* =========================================================
     写真の選択
     ========================================================= */
  $('cameraBtn').addEventListener('click', () => $('cameraInput').click());
  $('libraryBtn').addEventListener('click', () => $('libraryInput').click());
  $('changePhotoBtn').addEventListener('click', () => $('libraryInput').click());
  $('sampleBtn').addEventListener('click', () => setPhoto(makeSamplePhoto(), true));
  ['cameraInput', 'libraryInput'].forEach((id) => $(id).addEventListener('change', (e) => {
    loadPhotoFile(e.target.files && e.target.files[0]);
    e.target.value = ''; // 同じ写真をもう一度選べるように
  }));

  // PC：ドラッグ＆ドロップ
  const stage = $('stage');
  let dragDepth = 0;
  stage.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; $('dropOverlay').hidden = false; });
  stage.addEventListener('dragover', (e) => e.preventDefault());
  stage.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('dropOverlay').hidden = true; } });
  stage.addEventListener('drop', (e) => {
    e.preventDefault(); dragDepth = 0; $('dropOverlay').hidden = true;
    loadPhotoFile(e.dataTransfer.files && e.dataTransfer.files[0]);
  });

  /* ---------- Before / After ---------- */
  $('baToggle').addEventListener('click', () => {
    state.showAfter = !state.showAfter;
    syncControls(); requestDraw();
  });

  $('resetBtn').addEventListener('click', resetSelected);
  $('deleteBtn').addEventListener('click', deleteSelected);

  /* =========================================================
     完成画面・保存
     ========================================================= */
  function renderExport(after) {
    const p = state.photo;
    const c = document.createElement('canvas');
    c.width = p.width; c.height = p.height;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    drawScene(g, { after, deviceK: 1 });
    if (CONFIG.WATERMARK.enabled && CONFIG.WATERMARK.text) drawWatermark(g, c.width, c.height);
    return c;
  }

  function drawWatermark(g, w, h) {
    const fs = Math.max(12, Math.round(Math.min(w, h) * 0.024));
    g.save();
    g.globalCompositeOperation = 'source-over';
    g.font = `italic 600 ${fs}px Fraunces, Georgia, serif`;
    g.textAlign = 'right'; g.textBaseline = 'bottom';
    g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = fs * 0.4;
    g.fillStyle = 'rgba(255,255,255,.9)';
    g.fillText(CONFIG.WATERMARK.text, w - fs, h - fs * 0.8);
    g.restore();
  }

  function canvasToBlob(c) {
    return new Promise((resolve, reject) => {
      try {
        c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.92);
      } catch (e) { reject(e); }
    });
  }

  const result = { afterUrl: '', beforeUrl: '', blob: null, showingAfter: true };

  async function openResult() {
    if (!state.photo || !state.layers.length) return;
    try {
      const [a, b] = await Promise.all([canvasToBlob(renderExport(true)), canvasToBlob(renderExport(false))]);
      if (result.afterUrl) URL.revokeObjectURL(result.afterUrl);
      if (result.beforeUrl) URL.revokeObjectURL(result.beforeUrl);
      result.blob = a;
      result.afterUrl = URL.createObjectURL(a);
      result.beforeUrl = URL.createObjectURL(b);
    } catch (e) {
      // index.html をファイルとして直接開いている場合などに起こる
      toast('画像を作れませんでした。サイトを公開URL（https://〜）で開いてお試しください');
      console.error(e);
      return;
    }
    result.showingAfter = true;
    $('resultImage').src = result.afterUrl;
    $('resultBaToggle').setAttribute('aria-pressed', 'false');

    const l = state.layers[0];
    const cm = layerCm(l);
    const tier = sizeTier(cm);
    const rows = [
      ['デザイン', state.layers.map((x) => x.design.name).join(' / ')],
      ['部位', bodyPart().label],
      ['サイズ目安', tier ? tier.cm + 'cm区分（約' + (Math.round(cm * 2) / 2) + 'cm）' : '約' + Math.round(cm) + 'cm'],
      ['料金目安', tierPriceText(tier)],
    ];
    const dl = $('resultSummary');
    dl.innerHTML = '';
    rows.forEach(([k, v]) => {
      const d = document.createElement('div');
      d.innerHTML = '<dt></dt><dd></dd>';
      d.querySelector('dt').textContent = k;
      d.querySelector('dd').textContent = v;
      dl.appendChild(d);
    });
    result.summaryText = rows.map(([k, v]) => `${k}：${v}`).join('\n');

    const booking = $('bookingBtn');
    booking.href = CONFIG.BOOKING_URL || '#';
    $('shareBtn').hidden = !canShareFiles();
    $('result').hidden = false;
    $('result').scrollTop = 0;
  }

  function canShareFiles() {
    try {
      const f = new File([new Blob(['x'], { type: 'image/jpeg' })], 'x.jpg', { type: 'image/jpeg' });
      return !!(navigator.canShare && navigator.canShare({ files: [f] }));
    } catch (_) { return false; }
  }

  function fileName() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${CONFIG.FILE_PREFIX}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.jpg`;
  }

  $('finishBtn').addEventListener('click', openResult);
  $('backToEdit').addEventListener('click', () => { $('result').hidden = true; });

  $('resultBaToggle').addEventListener('click', () => {
    result.showingAfter = !result.showingAfter;
    $('resultImage').src = result.showingAfter ? result.afterUrl : result.beforeUrl;
    $('resultBaToggle').setAttribute('aria-pressed', String(!result.showingAfter));
  });

  $('saveBtn').addEventListener('click', () => {
    if (!result.afterUrl) return;
    const a = document.createElement('a');
    a.href = result.afterUrl;
    a.download = fileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('画像を保存しました');
  });

  $('shareBtn').addEventListener('click', async () => {
    if (!result.blob) return;
    const file = new File([result.blob], fileName(), { type: 'image/jpeg' });
    try {
      await navigator.share({ files: [file], title: 'Tamayura Virtual Try-on', text: 'ジャグアタトゥーのバーチャル試着' });
    } catch (e) {
      if (e && e.name !== 'AbortError') toast('シェアできませんでした。画像を保存してから投稿してください');
    }
  });

  $('bookingBtn').addEventListener('click', (e) => {
    if (!CONFIG.BOOKING_URL) {
      e.preventDefault();
      toast('予約ページは準備中です（js/config.js の BOOKING_URL に設定します）');
    }
  });

  $('copySummaryBtn').addEventListener('click', async () => {
    const text = result.summaryText || '';
    try {
      await navigator.clipboard.writeText(text);
      toast('コピーしました');
    } catch (_) {
      toast(text.replace(/\n/g, ' / '));
    }
  });

  /* =========================================================
     起動
     ========================================================= */
  buildSizeUI();
  buildRotateUI();
  buildBlendUI();
  updateUI();
  new ResizeObserver(resizeCanvas).observe(canvas);
  resizeCanvas();
  // よく使うデザインを先読み
  DESIGNS.slice(0, 4).forEach((d) => loadDesignImage(d).catch(() => {}));

  // 開発・確認用（ブラウザのコンソールから状態を見られます）
  window.__tryon = { state };
})();
