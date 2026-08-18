(function () {
  "use strict";

  const CONFIG = window.BIRTHDAY_CONFIG || {};
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = () => window.innerWidth <= 820;

  const ui = {
    scene: document.getElementById("scene"),
    title: document.getElementById("heroTitle"),
    description: document.getElementById("heroDescription"),
    eyebrow: document.getElementById("eyebrow"),
    photoInput: document.getElementById("photoInput"),
    cameraVideo: document.getElementById("cameraVideo"),
    cameraOverlay: document.getElementById("cameraOverlay"),
    cameraPlaceholder: document.getElementById("cameraPlaceholder"),
    cameraStatus: document.getElementById("cameraStatus"),
    cameraButton: document.getElementById("startCamera"),
    statusDot: document.getElementById("statusDot"),
    gestureReadout: document.getElementById("gestureReadout"),
    toast: document.getElementById("toast"),
    restart: document.getElementById("restartButton"),
    soundToggle: document.getElementById("soundToggle"),
    photoToolbar: document.getElementById("photoToolbar"),
    photoCounter: document.getElementById("photoCounter"),
    previousPhoto: document.getElementById("previousPhoto"),
    nextPhoto: document.getElementById("nextPhoto"),
  };

  const copy = {
    ready: ["先握紧一份愿望", "对着镜头握拳，散落的星光会为你做成一只双层蛋糕。"],
    cake: ["愿望有了形状", "蛋糕已经准备好。现在比个耶，让这一岁的烛光亮起来。"],
    candles: [`${CONFIG.age || 22} 岁，亮起来`, "张开手掌，把蛋糕、彩纸和收藏的回忆一起释放到夜空。"],
    scatter: ["回忆开始发光", "左右移动手掌选择照片，再捏合拇指和食指，把它带到眼前。"],
    focus: ["这一刻，值得被看见", "再次捏合可以翻到下一张；张开手掌，回到整片回忆。"],
  };

  let stage = "ready";
  let selectedPhoto = 0;
  let hoverPhoto = 0;
  let soundEnabled = true;
  let audioContext = null;
  let toastTimer = null;
  let cameraController = null;
  let handTracker = null;
  let gestureCandidate = "NONE";
  let gestureCandidateSince = 0;
  let lastGestureTrigger = 0;
  const gestureMetrics = { closedness: 0, extension: 1.7, pinch: 1 };

  let scene;
  let camera;
  let renderer;
  let clock;
  let cakePoints;
  let cakePositions;
  let targetPositions;
  let readyTargets;
  let cakeTargets;
  let scatterTargets;
  let starField;
  let candleGroup;
  let flames = [];
  let photoGroup;
  let photoCards = [];
  let bursts = [];
  let raycaster;
  let pointer;
  let cakeOffsetX = 1.45;

  function init() {
    ui.title.textContent = CONFIG.title || copy.ready[0];
    ui.eyebrow.textContent = `${CONFIG.name || "FOR YOU"} · ${CONFIG.birthdayDate || "MAKE A WISH"}`;
    initThree();
    bindEvents();
    loadInitialPhotos();
    updateUI();
    animate();
  }

  function initThree() {
    if (!window.THREE) {
      showToast("3D 组件没有载入，请检查网络后刷新。");
      return;
    }

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x100b1b, 0.047);

    camera = new THREE.PerspectiveCamera(43, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0.25, isMobile() ? 11.5 : 10.6);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setClearColor(0x000000, 0);
    ui.scene.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffe4d0, 0.8));
    const pinkLight = new THREE.PointLight(0xff7394, 1.8, 18);
    pinkLight.position.set(4, 2, 5);
    scene.add(pinkLight);
    const goldLight = new THREE.PointLight(0xffd27c, 1.2, 16);
    goldLight.position.set(-2, 4, 3);
    scene.add(goldLight);

    clock = new THREE.Clock();
    raycaster = new THREE.Raycaster();
    pointer = new THREE.Vector2();
    createStars();
    createCakeParticles();
    createCandles();
    photoGroup = new THREE.Group();
    scene.add(photoGroup);
    applyResponsiveLayout();
  }

  function createStars() {
    const count = isMobile() ? 700 : 1100;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const warm = new THREE.Color(0xffd8bf);
    const rose = new THREE.Color(0xff86a2);
    for (let i = 0; i < count; i += 1) {
      const radius = 8 + Math.random() * 20;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
      positions[i * 3 + 1] = Math.cos(phi) * radius;
      positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius - 4;
      const color = warm.clone().lerp(rose, Math.random());
      colors.set([color.r, color.g, color.b], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    starField = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ size: 0.027, transparent: true, opacity: 0.55, vertexColors: true })
    );
    scene.add(starField);
  }

  function createCakeParticles() {
    const count = isMobile() ? 3900 : 6200;
    cakePositions = new Float32Array(count * 3);
    readyTargets = new Float32Array(count * 3);
    cakeTargets = new Float32Array(count * 3);
    scatterTargets = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const palette = [
      new THREE.Color(CONFIG.cakeColors?.vanilla || "#ffd9bd"),
      new THREE.Color(CONFIG.cakeColors?.blush || "#ff8c9b"),
      new THREE.Color(CONFIG.cakeColors?.berry || "#bf4d78"),
      new THREE.Color("#fff2dd"),
    ];

    for (let i = 0; i < count; i += 1) {
      const index = i * 3;
      const ready = pointOnCloud(2.6, 5.7);
      readyTargets.set([ready.x, ready.y, ready.z], index);
      cakePositions.set([ready.x, ready.y, ready.z], index);

      const cakePoint = pointOnCake(i / count);
      cakeTargets.set([cakePoint.x, cakePoint.y, cakePoint.z], index);

      const scatter = pointOnCloud(3.8, isMobile() ? 6.3 : 8.2);
      scatterTargets.set([scatter.x, scatter.y, scatter.z], index);

      let color;
      if (cakePoint.band === 0) color = palette[0].clone().lerp(palette[1], Math.random() * 0.35);
      else if (cakePoint.band === 1) color = palette[1].clone().lerp(palette[2], Math.random() * 0.35);
      else color = palette[3].clone().lerp(palette[1], Math.random() * 0.18);
      colors.set([color.r, color.g, color.b], index);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(cakePositions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size: isMobile() ? 0.052 : 0.043,
      map: makeParticleTexture(),
      alphaTest: 0.04,
      transparent: true,
      opacity: 0.96,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    cakePoints = new THREE.Points(geometry, material);
    cakePoints.position.x = cakeOffsetX;
    scene.add(cakePoints);
    targetPositions = readyTargets;
  }

  function pointOnCake(progress) {
    const roll = Math.random();
    let radius;
    let centerY;
    let height;
    let band;
    if (progress < 0.56) {
      radius = 2.15;
      centerY = -0.82;
      height = 1.28;
      band = 0;
    } else if (progress < 0.88) {
      radius = 1.52;
      centerY = 0.42;
      height = 1.02;
      band = 1;
    } else {
      radius = progress < 0.95 ? 2.35 : 1.7;
      centerY = progress < 0.95 ? -1.5 : -0.12;
      height = 0.12;
      band = 2;
    }

    const theta = Math.random() * Math.PI * 2;
    const surface = Math.random();
    if (surface < 0.7 || band === 2) {
      const ripple = 1 + Math.sin(theta * 8) * (band === 2 ? 0.025 : 0.012);
      return {
        x: Math.cos(theta) * radius * ripple,
        y: centerY + (Math.random() - 0.5) * height,
        z: Math.sin(theta) * radius * ripple,
        band,
      };
    }
    const discRadius = Math.sqrt(Math.random()) * radius;
    const top = roll > 0.16;
    return {
      x: Math.cos(theta) * discRadius,
      y: centerY + (top ? height / 2 : -height / 2),
      z: Math.sin(theta) * discRadius,
      band,
    };
  }

  function pointOnCloud(minRadius, maxRadius) {
    const radius = minRadius + Math.pow(Math.random(), 0.55) * (maxRadius - minRadius);
    const theta = Math.random() * Math.PI * 2;
    const y = (Math.random() - 0.5) * radius * 1.35;
    return {
      x: Math.cos(theta) * radius + (Math.random() - 0.5) * 0.5,
      y,
      z: Math.sin(theta) * radius * 0.65 + (Math.random() - 0.5) * 0.7,
    };
  }

  function makeParticleTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d");
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.28, "rgba(255,255,255,.95)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
  }

  function createCandles() {
    candleGroup = new THREE.Group();
    const candleMaterial = new THREE.MeshStandardMaterial({
      color: CONFIG.cakeColors?.candle || "#fff1c9",
      roughness: 0.46,
      metalness: 0.04,
    });
    const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0xff7894, roughness: 0.44 });
    const wickMaterial = new THREE.MeshBasicMaterial({ color: 0x4a2834 });
    const flameMaterial = new THREE.MeshBasicMaterial({
      color: CONFIG.cakeColors?.flame || "#ffcc62",
      transparent: true,
      opacity: 0,
    });

    const createBar = (width, height, x, y, material) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.13), material);
      bar.position.set(x, y, 0);
      bar.geometry.translate(0, 0, 0);
      return bar;
    };

    // 用五段立体烛体组成数字 2：上横、右上竖、中横、左下竖、下横。
    [-0.42, 0.42].forEach((centerX) => {
      const digit = new THREE.Group();
      const digitBottom = 1.01;
      const width = 0.48;
      const height = 0.78;
      const thickness = 0.085;
      const segments = [
        createBar(width, thickness, 0, digitBottom + height, candleMaterial),
        createBar(thickness, height / 2, width / 2, digitBottom + height * 0.75, candleMaterial),
        createBar(width, thickness, 0, digitBottom + height / 2, edgeMaterial),
        createBar(thickness, height / 2, -width / 2, digitBottom + height * 0.25, candleMaterial),
        createBar(width, thickness, 0, digitBottom, edgeMaterial),
      ];
      segments.forEach((segment) => digit.add(segment));
      digit.position.x = centerX;
      digit.position.z = 0.02;
      candleGroup.add(digit);

      const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.13, 8), wickMaterial);
      wick.position.set(centerX, digitBottom + height + 0.1, 0.02);
      candleGroup.add(wick);

      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 12), flameMaterial.clone());
      flame.scale.set(0.7, 1.42, 0.7);
      flame.position.set(centerX, digitBottom + height + 0.27, 0.02);
      flame.userData.phase = Math.random() * Math.PI * 2;
      flames.push(flame);
      candleGroup.add(flame);
    });
    candleGroup.position.x = cakeOffsetX;
    candleGroup.visible = false;
    scene.add(candleGroup);
  }

  async function loadInitialPhotos() {
    const configured = Array.isArray(CONFIG.defaultPhotos) ? CONFIG.defaultPhotos : [];
    if (configured.length) {
      await buildPhotoCards(configured);
      return;
    }
    const placeholders = (CONFIG.placeholderCaptions || []).map((caption, index) => ({
      caption,
      placeholder: true,
      index,
    }));
    await buildPhotoCards(placeholders);
  }

  async function buildPhotoCards(items) {
    photoCards.forEach((card) => {
      photoGroup.remove(card);
      card.geometry.dispose();
      card.material.map?.dispose();
      card.material.dispose();
    });
    photoCards = [];

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const texture = await makePolaroidTexture(item, index);
      const geometry = new THREE.PlaneGeometry(1.44, 1.82);
      const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
      const card = new THREE.Mesh(geometry, material);
      card.userData.index = index;
      card.userData.tilt = (Math.random() - 0.5) * 0.22;
      card.userData.home = new THREE.Vector3();
      card.visible = false;
      photoGroup.add(card);
      photoCards.push(card);
    }
    selectedPhoto = Math.min(selectedPhoto, Math.max(0, photoCards.length - 1));
    layoutPhotos();
    updatePhotoCounter();
  }

  async function makePolaroidTexture(item, index) {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 760;
    const context = canvas.getContext("2d");
    context.fillStyle = "#fffaf2";
    context.fillRect(0, 0, canvas.width, canvas.height);

    const imageX = 36;
    const imageY = 36;
    const imageWidth = 528;
    const imageHeight = 560;
    let image = null;
    if (item.src) image = await loadImage(item.src).catch(() => null);

    if (image) {
      drawCover(context, image, imageX, imageY, imageWidth, imageHeight);
      context.fillStyle = "rgba(255,219,191,.08)";
      context.fillRect(imageX, imageY, imageWidth, imageHeight);
    } else {
      const palettes = [
        ["#e87f91", "#713753"],
        ["#f1b986", "#a54c68"],
        ["#c786a2", "#4d315d"],
        ["#e1a66f", "#6f3b64"],
        ["#d66980", "#3c2855"],
        ["#efa8a5", "#7b4466"],
      ];
      const pair = palettes[index % palettes.length];
      const gradient = context.createLinearGradient(imageX, imageY, imageX + imageWidth, imageY + imageHeight);
      gradient.addColorStop(0, pair[0]);
      gradient.addColorStop(1, pair[1]);
      context.fillStyle = gradient;
      context.fillRect(imageX, imageY, imageWidth, imageHeight);
      context.strokeStyle = "rgba(255,255,255,.32)";
      context.lineWidth = 2;
      for (let ring = 0; ring < 6; ring += 1) {
        context.beginPath();
        context.arc(300, 310, 35 + ring * 38, 0, Math.PI * 2);
        context.stroke();
      }
      context.fillStyle = "rgba(255,255,255,.9)";
      context.textAlign = "center";
      context.font = "600 26px DM Sans, sans-serif";
      context.fillText(`YOUR PHOTO ${String(index + 1).padStart(2, "0")}`, 300, 322);
    }

    context.fillStyle = "#2a1d2a";
    context.textAlign = "center";
    context.font = "600 27px 'Noto Serif SC', serif";
    context.fillText((item.caption || `回忆 ${index + 1}`).slice(0, 18), 300, 664);
    context.fillStyle = "#967d87";
    context.font = "500 15px DM Sans, sans-serif";
    context.letterSpacing = "2px";
    context.fillText(CONFIG.birthdayDate || "MAKE A WISH", 300, 705);

    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = Math.min(8, renderer?.capabilities.getMaxAnisotropy() || 1);
    return texture;
  }

  function drawCover(context, image, x, y, width, height) {
    const scale = Math.max(width / image.width, height / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  function layoutPhotos() {
    if (!photoCards.length) return;
    const mobile = isMobile();
    const xRadius = mobile ? 2.7 : 4.3;
    const yRadius = mobile ? 3.25 : 2.45;
    photoCards.forEach((card, index) => {
      const angle = (index / photoCards.length) * Math.PI * 2 - Math.PI * 0.15;
      const layer = index % 2 === 0 ? 1 : 0.78;
      card.userData.home.set(
        cakeOffsetX + Math.cos(angle) * xRadius * layer,
        Math.sin(angle) * yRadius * layer - (mobile ? 0.25 : 0),
        Math.sin(angle * 1.7) * 0.75 + 0.2
      );
      if (stage === "ready") card.position.copy(card.userData.home);
    });
  }

  function bindEvents() {
    document.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => runAction(button.dataset.action, "touch"));
    });
    ui.photoInput.addEventListener("change", handlePhotoUpload);
    ui.cameraButton.addEventListener("click", startCamera);
    ui.restart.addEventListener("click", restartExperience);
    ui.soundToggle.addEventListener("click", () => {
      soundEnabled = !soundEnabled;
      ui.soundToggle.setAttribute("aria-pressed", String(soundEnabled));
      ui.soundToggle.style.opacity = soundEnabled ? "1" : "0.48";
      if (soundEnabled) playNotes([523.25], 0.05);
    });
    ui.previousPhoto.addEventListener("click", () => cyclePhoto(-1));
    ui.nextPhoto.addEventListener("click", () => cyclePhoto(1));
    renderer?.domElement.addEventListener("pointerdown", handleScenePointer);
    window.addEventListener("resize", handleResize);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && audioContext?.state === "running") audioContext.suspend();
    });
  }

  async function handlePhotoUpload(event) {
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith("image/"));
    if (!files.length) return;
    showToast(`正在制作 ${files.length} 张拍立得…`);
    const items = [];
    for (const file of files.slice(0, 16)) {
      const src = await resizeImageFile(file, 1400);
      items.push({
        src,
        caption: cleanFileName(file.name),
      });
    }
    await buildPhotoCards(items);
    showToast(`已临时放入 ${items.length} 张照片；永久替换请放进 assets/photos 文件夹。`, 4400);
    event.target.value = "";
  }

  function resizeImageFile(file, maxSide) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const image = new Image();
        image.onerror = reject;
        image.onload = () => {
          const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(image.width * scale);
          canvas.height = Math.round(image.height * scale);
          canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.86));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function cleanFileName(name) {
    return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 18) || "生日回忆";
  }

  function expectedAction() {
    if (stage === "ready") return "cake";
    if (stage === "cake") return "candles";
    if (stage === "candles") return "scatter";
    if (stage === "scatter") return "focus";
    return null;
  }

  function runAction(action, source) {
    ensureAudio();
    const expected = expectedAction();
    if (stage === "focus" && action === "scatter") {
      leavePhotoFocus();
      return;
    }
    if (stage === "focus" && action === "focus") {
      cyclePhoto(1);
      return;
    }
    if (stage === "scatter" && action === "scatter") return;
    if (action !== expected) {
      const prompts = { cake: "先握拳聚合蛋糕", candles: "先比耶点亮蜡烛", scatter: "先张开手掌释放回忆", focus: "现在捏合选择照片" };
      showToast(prompts[expected] || "点击“再许一次愿”重新开始");
      return;
    }

    if (action === "cake") assembleCake();
    if (action === "candles") lightCandles();
    if (action === "scatter") releaseMemories();
    if (action === "focus") focusPhoto(hoverPhoto);
    if (source === "gesture" && navigator.vibrate) navigator.vibrate(35);
  }

  function assembleCake() {
    stage = "cake";
    targetPositions = cakeTargets;
    candleGroup.visible = true;
    flames.forEach((flame) => { flame.material.opacity = 0; });
    photoCards.forEach((card) => { card.visible = false; });
    playWhoosh();
    window.setTimeout(() => playNotes([261.63, 329.63, 392], 0.16), reducedMotion ? 20 : 550);
    updateUI();
  }

  function lightCandles() {
    stage = "candles";
    candleGroup.visible = true;
    flames.forEach((flame) => { flame.material.opacity = 1; });
    createBurst(cakeOffsetX, 1.65, 0, [0xffd27c, 0xff8fa2], 90);
    playNotes([392, 523.25, 659.25, 783.99], 0.13);
    updateUI();
  }

  function releaseMemories() {
    stage = "scatter";
    targetPositions = scatterTargets;
    flames.forEach((flame) => { flame.material.opacity = 0; });
    photoCards.forEach((card) => {
      card.visible = true;
      card.position.set(cakeOffsetX, 0, 0);
      card.scale.setScalar(0.04);
    });
    createBurst(cakeOffsetX, 0, 0, [0xffd27c, 0xff8fa2, 0xfff3d6], 180);
    playWhoosh();
    playNotes([523.25, 659.25, 783.99, 1046.5], 0.1);
    updateUI();
  }

  function focusPhoto(index) {
    if (!photoCards.length) return;
    selectedPhoto = ((index % photoCards.length) + photoCards.length) % photoCards.length;
    stage = "focus";
    document.body.classList.add("is-focus");
    ui.photoToolbar.hidden = false;
    ui.restart.hidden = false;
    playNotes([659.25, 880], 0.12);
    updatePhotoCounter();
    updateUI();
  }

  function leavePhotoFocus() {
    stage = "scatter";
    document.body.classList.remove("is-focus");
    ui.photoToolbar.hidden = true;
    updateUI();
  }

  function cyclePhoto(direction) {
    if (!photoCards.length) return;
    selectedPhoto = (selectedPhoto + direction + photoCards.length) % photoCards.length;
    hoverPhoto = selectedPhoto;
    if (stage !== "focus") stage = "focus";
    document.body.classList.add("is-focus");
    ui.photoToolbar.hidden = false;
    ui.restart.hidden = false;
    playNotes([direction > 0 ? 783.99 : 659.25], 0.06);
    updatePhotoCounter();
    updateUI();
  }

  function restartExperience() {
    stage = "ready";
    selectedPhoto = 0;
    hoverPhoto = 0;
    targetPositions = readyTargets;
    candleGroup.visible = false;
    flames.forEach((flame) => { flame.material.opacity = 0; });
    photoCards.forEach((card) => { card.visible = false; });
    document.body.classList.remove("is-focus");
    ui.photoToolbar.hidden = true;
    ui.restart.hidden = true;
    updateUI();
    showToast("新的愿望已经准备好了。");
  }

  function updateUI() {
    const text = copy[stage] || copy.scatter;
    ui.title.textContent = stage === "ready" ? (CONFIG.title || text[0]) : text[0];
    ui.description.textContent = text[1];

    const order = ["cake", "candles", "scatter", "focus"];
    const active = expectedAction();
    const completedCount = stage === "ready" ? 0 : stage === "cake" ? 1 : stage === "candles" ? 2 : stage === "scatter" ? 3 : 4;
    order.forEach((key, index) => {
      const item = document.querySelector(`[data-step="${key}"]`);
      item.classList.toggle("is-complete", index < completedCount);
      item.classList.toggle("is-active", key === active);
      const button = item.querySelector("button");
      button.setAttribute("aria-current", key === active ? "step" : "false");
    });
    if (stage === "focus") document.querySelector('[data-step="focus"]').classList.add("is-active");
    if (stage === "scatter") ui.restart.hidden = false;
  }

  function updatePhotoCounter() {
    ui.photoCounter.textContent = `${String(selectedPhoto + 1).padStart(2, "0")} / ${String(photoCards.length || 0).padStart(2, "0")}`;
  }

  async function startCamera() {
    if (cameraController) return;
    if (!window.Hands || !window.Camera) {
      showToast("手势组件没有载入；仍可点击底部四个动作体验。", 4200);
      return;
    }
    if (!window.isSecureContext && location.hostname !== "localhost") {
      showToast("摄像头需要 HTTPS；发布到 GitHub Pages 后即可使用。", 4800);
      return;
    }

    ui.cameraButton.disabled = true;
    ui.cameraButton.textContent = "正在连接…";
    try {
      handTracker = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`,
      });
      handTracker.setOptions({
        maxNumHands: 1,
        modelComplexity: isMobile() ? 0 : 1,
        minDetectionConfidence: 0.62,
        minTrackingConfidence: 0.58,
      });
      handTracker.onResults(handleHandResults);
      cameraController = new Camera(ui.cameraVideo, {
        onFrame: async () => handTracker.send({ image: ui.cameraVideo }),
        width: isMobile() ? 480 : 640,
        height: isMobile() ? 640 : 480,
        facingMode: "user",
      });
      await cameraController.start();
      ui.cameraPlaceholder.hidden = true;
      ui.statusDot.classList.add("is-live");
      ui.cameraStatus.textContent = "镜头识别中";
      ui.cameraButton.textContent = "手势控制已开启";
      showToast("镜头已开启，请将一只手完整放进画面。", 3200);
    } catch (error) {
      cameraController = null;
      ui.cameraButton.disabled = false;
      ui.cameraButton.textContent = "重新开启镜头";
      ui.cameraStatus.textContent = "镜头不可用，已保留触控模式";
      showToast("未能使用摄像头；你仍可点击底部四个动作完整体验。", 4800);
    }
  }

  function handleHandResults(results) {
    drawHandOverlay(results.multiHandLandmarks?.[0]);
    const landmarks = results.multiHandLandmarks?.[0];
    if (!landmarks) {
      ui.gestureReadout.textContent = "NO HAND";
      gestureCandidate = "NONE";
      gestureMetrics.closedness *= 0.8;
      return;
    }

    const gesture = classifyGesture(landmarks);
    ui.gestureReadout.textContent = gesture;
    const mirroredX = 1 - landmarks[9].x;
    if (stage === "scatter" && photoCards.length) {
      hoverPhoto = Math.min(photoCards.length - 1, Math.max(0, Math.floor(mirroredX * photoCards.length)));
    }

    const now = performance.now();
    if (gesture !== gestureCandidate) {
      gestureCandidate = gesture;
      gestureCandidateSince = now;
      return;
    }
    if (gesture === "NONE" || now - lastGestureTrigger < 850) return;

    const dwell = gesture === "PINCH" ? 360 : gesture === "VICTORY" ? 560 : 470;
    if (now - gestureCandidateSince < dwell) return;

    if (stage === "ready" && gesture === "FIST") triggerGesture("cake", now);
    else if (stage === "cake" && gesture === "VICTORY") triggerGesture("candles", now);
    else if (stage === "candles" && gesture === "OPEN") triggerGesture("scatter", now);
    else if (stage === "scatter" && gesture === "PINCH") triggerGesture("focus", now);
    else if (stage === "focus" && gesture === "OPEN") {
      lastGestureTrigger = now;
      leavePhotoFocus();
    } else if (stage === "focus" && gesture === "PINCH") {
      lastGestureTrigger = now;
      cyclePhoto(1);
    }
  }

  function triggerGesture(action, now) {
    lastGestureTrigger = now;
    runAction(action, "gesture");
  }

  function classifyGesture(points) {
    // 手掌尺寸归一化沿用 gesture-Christmas_tree 的思路，避免手离镜头远近改变阈值；
    // 手指闭合度的平滑方式参考 gesture-particles，减少拳头/张开之间的闪烁误判。
    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const wrist = points[0];
    const handSize = Math.max(distance(wrist, points[9]), 0.02);
    const fingerPairs = [[8, 6], [12, 10], [16, 14], [20, 18]];
    const fingerRatios = fingerPairs.map(([tip, pip]) => distance(points[tip], wrist) / Math.max(distance(points[pip], wrist), 0.0001));
    const fingers = fingerRatios.map((ratio) => ratio > 1.06);
    const averageTipDistance = [8, 12, 16, 20].reduce((sum, index) => sum + distance(points[index], wrist), 0) / 4;
    const rawClosedness = fingerRatios.reduce((sum, ratio) => {
      return sum + (1 - clamp((ratio - 0.85) / (1.15 - 0.85), 0, 1));
    }, 0) / fingerRatios.length;
    const extensionRatio = averageTipDistance / handSize;
    const pinchRatio = distance(points[4], points[8]) / handSize;
    gestureMetrics.closedness += (rawClosedness - gestureMetrics.closedness) * 0.25;
    gestureMetrics.extension += (extensionRatio - gestureMetrics.extension) * 0.32;
    gestureMetrics.pinch += (pinchRatio - gestureMetrics.pinch) * 0.38;

    if (gestureMetrics.pinch < 0.35 && fingers[0]) return "PINCH";
    if (fingers[0] && fingers[1] && !fingers[2] && !fingers[3]) return "VICTORY";
    if (gestureMetrics.closedness > 0.72 || gestureMetrics.extension < 1.5) return "FIST";
    if (gestureMetrics.closedness < 0.28 && gestureMetrics.extension > 1.7) return "OPEN";
    return "NONE";
  }

  function drawHandOverlay(landmarks) {
    const canvas = ui.cameraOverlay;
    const width = ui.cameraVideo.videoWidth || 640;
    const height = ui.cameraVideo.videoHeight || 480;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, width, height);
    if (!landmarks) return;
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [5, 9], [9, 10], [10, 11], [11, 12],
      [9, 13], [13, 14], [14, 15], [15, 16],
      [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
    ];
    context.strokeStyle = "rgba(255,210,124,.78)";
    context.lineWidth = Math.max(2, width / 280);
    context.beginPath();
    connections.forEach(([from, to]) => {
      context.moveTo(landmarks[from].x * width, landmarks[from].y * height);
      context.lineTo(landmarks[to].x * width, landmarks[to].y * height);
    });
    context.stroke();
    context.fillStyle = "rgba(255,142,163,.96)";
    landmarks.forEach((point, index) => {
      context.beginPath();
      context.arc(point.x * width, point.y * height, index === 4 || index === 8 ? 5 : 3, 0, Math.PI * 2);
      context.fill();
    });
  }

  function handleScenePointer(event) {
    if (!photoCards.length || (stage !== "scatter" && stage !== "focus")) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(photoCards.filter((card) => card.visible))[0];
    if (hit) focusPhoto(hit.object.userData.index);
    else if (stage === "focus") leavePhotoFocus();
  }

  function ensureAudio() {
    if (!soundEnabled) return null;
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") audioContext.resume();
    return audioContext;
  }

  function playNotes(frequencies, spacing) {
    const context = ensureAudio();
    if (!context || !soundEnabled) return;
    frequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + index * spacing;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.075, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.34);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.36);
    });
  }

  function playWhoosh() {
    const context = ensureAudio();
    if (!context || !soundEnabled) return;
    const duration = 0.55;
    const buffer = context.createBuffer(1, context.sampleRate * duration, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(300, context.currentTime);
    filter.frequency.exponentialRampToValueAtTime(1600, context.currentTime + duration);
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    source.connect(filter).connect(gain).connect(context.destination);
    source.start();
  }

  function createBurst(x, y, z, palette, count) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i += 1) {
      positions.set([x, y, z], i * 3);
      const color = new THREE.Color(palette[i % palette.length]);
      colors.set([color.r, color.g, color.b], i * 3);
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.4 + Math.random() * 4.2;
      velocities.push(new THREE.Vector3(Math.cos(angle) * speed, (Math.random() - 0.15) * speed, Math.sin(angle) * speed));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ size: 0.075, vertexColors: true, transparent: true, opacity: 1, depthWrite: false })
    );
    scene.add(points);
    bursts.push({ points, velocities, life: 1 });
  }

  function animate() {
    requestAnimationFrame(animate);
    if (!renderer || !scene || !camera) return;
    const delta = Math.min(clock.getDelta(), 0.04);
    const time = clock.elapsedTime;
    const positionAttribute = cakePoints.geometry.attributes.position;
    const positions = positionAttribute.array;
    const ease = reducedMotion ? 1 : 1 - Math.pow(stage === "scatter" ? 0.93 : 0.9, delta * 60);
    for (let i = 0; i < positions.length; i += 1) {
      positions[i] += (targetPositions[i] - positions[i]) * ease;
    }
    positionAttribute.needsUpdate = true;

    cakePoints.rotation.y += delta * (stage === "scatter" ? 0.075 : 0.13);
    cakePoints.rotation.z = Math.sin(time * 0.35) * 0.015;
    starField.rotation.y -= delta * 0.007;
    candleGroup.rotation.y = cakePoints.rotation.y;

    flames.forEach((flame) => {
      if (flame.material.opacity <= 0) return;
      const flicker = 1 + Math.sin(time * 9 + flame.userData.phase) * 0.13 + Math.random() * 0.05;
      flame.scale.set(0.72 / flicker, 1.35 * flicker, 0.72 / flicker);
      flame.material.opacity = 0.86 + Math.random() * 0.14;
    });

    updatePhotos(delta, time);
    updateBursts(delta);
    renderer.render(scene, camera);
  }

  function updatePhotos(delta, time) {
    if (!photoCards.length) return;
    const ease = reducedMotion ? 1 : 1 - Math.pow(0.9, delta * 60);
    photoCards.forEach((card, index) => {
      if (!card.visible) return;
      const focused = stage === "focus" && index === selectedPhoto;
      const target = focused
        ? new THREE.Vector3(isMobile() ? 0 : 0.65, isMobile() ? -0.15 : 0.05, 4.35)
        : card.userData.home;
      card.position.lerp(target, ease);
      const baseScale = focused ? (isMobile() ? 1.72 : 1.82) : index === hoverPhoto && stage === "scatter" ? 1.08 : 0.82;
      const currentScale = card.scale.x + (baseScale - card.scale.x) * ease;
      card.scale.setScalar(currentScale);
      card.lookAt(camera.position);
      card.rotateZ(focused ? Math.sin(time * 0.6) * 0.015 : card.userData.tilt);
      card.material.opacity += ((stage === "focus" && !focused ? 0.1 : 1) - card.material.opacity) * ease;
      card.renderOrder = focused ? 10 : 1;
    });
  }

  function updateBursts(delta) {
    bursts = bursts.filter((burst) => {
      burst.life -= delta * 0.82;
      const positions = burst.points.geometry.attributes.position.array;
      burst.velocities.forEach((velocity, index) => {
        velocity.y -= delta * 1.7;
        positions[index * 3] += velocity.x * delta;
        positions[index * 3 + 1] += velocity.y * delta;
        positions[index * 3 + 2] += velocity.z * delta;
        velocity.multiplyScalar(0.992);
      });
      burst.points.geometry.attributes.position.needsUpdate = true;
      burst.points.material.opacity = Math.max(0, burst.life);
      if (burst.life > 0) return true;
      scene.remove(burst.points);
      burst.points.geometry.dispose();
      burst.points.material.dispose();
      return false;
    });
  }

  function handleResize() {
    if (!renderer || !camera) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.position.z = isMobile() ? 11.5 : 10.6;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    renderer.setSize(window.innerWidth, window.innerHeight);
    applyResponsiveLayout();
  }

  function applyResponsiveLayout() {
    cakeOffsetX = isMobile() ? 0 : 1.45;
    if (cakePoints) {
      cakePoints.position.x = cakeOffsetX;
      cakePoints.position.y = isMobile() ? -0.35 : 0;
      cakePoints.scale.setScalar(isMobile() ? 0.82 : 1);
    }
    if (candleGroup) {
      candleGroup.position.x = cakeOffsetX;
      candleGroup.position.y = isMobile() ? -0.35 : 0;
      candleGroup.scale.setScalar(isMobile() ? 0.82 : 1);
    }
    layoutPhotos();
  }

  function showToast(message, duration = 3000) {
    ui.toast.textContent = message;
    ui.toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => ui.toast.classList.remove("is-visible"), duration);
  }

  init();
})();
