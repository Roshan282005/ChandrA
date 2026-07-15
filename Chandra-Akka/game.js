(() => {
  "use strict";

  // ================= DOM refs =================
  const lobbyScreen = document.getElementById("lobbyScreen");
  const playBtn = document.getElementById("playBtn");
  const operatorPhoto = document.getElementById("operatorPhoto");
  const operatorSpecialty = document.getElementById("operatorSpecialty");
  const lobbyRank = document.getElementById("lobbyRank");
  const lobbyBest = document.getElementById("lobbyBest");
  const muteBtn = document.getElementById("muteBtn");
  const toastStack = document.getElementById("toastStack");
  const newBestFlash = document.getElementById("newBestFlash");
  const glitchFlash = document.getElementById("glitchFlash");
  const bootScreen = document.getElementById("bootScreen");
  const calibrateScreen = document.getElementById("calibrateScreen");
  const gameScreen = document.getElementById("gameScreen");
  const micBtn = document.getElementById("micBtn");
  const noMicBtn = document.getElementById("noMicBtn");
  const bootNote = document.getElementById("bootNote");
  const calFill = document.getElementById("calFill");
  const calStatus = document.getElementById("calStatus");
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const scoreValueEl = document.getElementById("scoreValue");
  const clearedValueEl = document.getElementById("clearedValue");
  const bestValueEl = document.getElementById("bestValue");
  const micFill = document.getElementById("micFill");
  const micThreshold = document.getElementById("micThreshold");
  const micHint = document.getElementById("micHint");
  const pressHoldBtn = document.getElementById("pressHoldBtn");
  const finaleOverlay = document.getElementById("finaleOverlay");
  const finalePhoto = document.getElementById("finalePhoto");
  const finaleTitle = document.getElementById("finaleTitle");
  const finaleVerdict = document.getElementById("finaleVerdict");
  const finalScoreValueEl = document.getElementById("finalScoreValue");
  const replayBtn = document.getElementById("replayBtn");
  const dangerVignette = document.getElementById("dangerVignette");
  const comboBadge = document.getElementById("comboBadge");
  const comboValueEl = document.getElementById("comboValue");
  const micMeter = document.getElementById("micMeter");
  const calVisualizer = document.getElementById("calVisualizer");
  const finaleBurst = document.getElementById("finaleBurst");

  // ================= Audio SFX (reaction clips, not voice input) =================
  let muted = localStorage.getItem("screamRoyaleMuted") === "1";

  function playClip(src, volume = 1) {
    if (muted) return;
    try {
      const a = new Audio(src);
      a.volume = Math.min(1, Math.max(0, volume));
      a.play().catch(() => {});
    } catch (e) { /* ignore */ }
  }
  const SFX = {
    jump: () => playClip("hmm_mm.mp3", 0.7),
    land: () => playClip("reveal-sound.mp3", 0.5),
    pass: () => playClip("reveal-sound2.mp3", 0.35),
    crash: () => playClip("bleh.mp3", 0.9),
    crowd: () => playClip("Arhhh_.mp3", 0.6),
    finale: () => playClip("finale-sound.mp3", 0.8),
  };

  // ================= Procedural music + UI blips (no extra audio assets needed) =================
  const Music = (() => {
    let ctx = null, master = null, filter = null, padGain = null, tickTimer = null;
    let intensity = 0; // 0..1, driven by game speed
    let started = false;

    function ensureCtx() {
      if (ctx) return;
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);

      filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 700;
      filter.connect(master);

      padGain = ctx.createGain();
      padGain.gain.value = 0.16;
      padGain.connect(filter);

      // three detuned oscillators = a slow ambient pad
      [55, 55.4, 110].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = i === 2 ? "triangle" : "sawtooth";
        osc.frequency.value = freq;
        osc.connect(padGain);
        osc.start();
      });

      // slow LFO sweeping the filter for movement
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.06;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 260;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();
    }

    function tick() {
      if (!ctx || muted) return;
      const prob = 0.15 + intensity * 0.7;
      if (Math.random() < prob) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = 180 + intensity * 500;
        g.gain.value = 0.05 + intensity * 0.05;
        osc.connect(g);
        g.connect(master);
        const t = ctx.currentTime;
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        osc.start(t);
        osc.stop(t + 0.09);
      }
    }

    function start() {
      ensureCtx();
      if (ctx.state === "suspended") ctx.resume();
      if (started) return;
      started = true;
      tickTimer = setInterval(tick, 130);
    }

    function setIntensity(v) {
      intensity = Math.max(0, Math.min(1, v));
      if (filter) filter.frequency.setTargetAtTime(600 + intensity * 2200, ctx.currentTime, 0.4);
      if (padGain) padGain.gain.setTargetAtTime(0.12 + intensity * 0.1, ctx.currentTime, 0.4);
    }

    function setMuted(m) {
      muted = m;
      if (master) master.gain.setTargetAtTime(m ? 0 : 0.5, ctx ? ctx.currentTime : 0, 0.15);
    }

    function blip(freq = 880, dur = 0.05, vol = 0.06) {
      if (!ctx || muted) return;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      g.gain.value = vol;
      osc.connect(g);
      g.connect(master);
      const t = ctx.currentTime;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }

    return { start, setIntensity, setMuted, blip };
  })();

  function wireBlip(el, freq) {
    if (!el) return;
    el.addEventListener("pointerenter", () => Music.blip(freq, 0.04, 0.035));
    el.addEventListener("click", () => Music.blip(freq * 1.4, 0.06, 0.06));
  }

  // ================= Toasts =================
  function showToast(text) {
    if (!toastStack) return;
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = text;
    toastStack.appendChild(el);
    setTimeout(() => el.remove(), 3400);
  }

  // ================= Obstacle tiers (reusing site's award-tier language) =================
  const TIERS = [
    { key: "common", color: "#b7c9c2", img: "pottaCloseup.jpg", hRange: [46, 62], points: 1,
      verdict: "Confirmed unable to take a bad photo. Also confirmed unable to clear a knee-high crate." },
    { key: "rare", color: "#4fc3ff", img: "modernpotta.jpg", hRange: [64, 84], points: 2,
      verdict: "We get it, you can see through the sunglasses. Shame you couldn't see the crate." },
    { key: "epic", color: "#b06bff", img: "PottaPortrait.jpg", hRange: [86, 108], points: 3,
      verdict: "The hair cleared the jump. You did not." },
    { key: "legendary", color: "#ff7a1a", img: "couplePotta.jpg", hRange: [110, 132], points: 5,
      verdict: "Award for Best Supporting Role in Your Own Faceplant." },
    { key: "mythic", color: "#ff3b4e", img: "potta.jpg", hRange: [134, 158], points: 8,
      verdict: "Mythic tier crate. Mythic tier scream needed. You brought a whisper to a scream fight." },
  ];
  const images = {};
  TIERS.forEach(t => { const im = new Image(); im.src = t.img; images[t.img] = im; });

  // ================= State =================
  let audioCtx = null, analyser = null, dataArray = null, micStream = null;
  let usingMic = false;
  let noiseFloor = 0.02;
  let screamThreshold = 0.16;
  let smoothedVolume = 0;
  let rawVolume = 0;

  let manualActive = false;   // press/hold or keyboard fallback engaged
  let manualPressStart = 0;

  let W = 0, H = 0, DPR = 1, GROUND_Y = 0;
  const player = { x: 0, y: 0, w: 34, h: 44, vy: 0, grounded: true };
  let obstacles = [];
  let spawnTimer = 0;
  let scrollSpeed = 220;      // px/sec, ramps up
  let distance = 0;
  let cleared = 0;
  let best = Number(localStorage.getItem("screamRoyaleBest") || 0);
  let jumpCooldown = 0;
  let running = false;
  let lastTs = 0;

  // ---- juice: particles, shake, combo ----
  let particles = [];       // spark bursts + dust puffs
  let floaters = [];        // floating "+N" score text
  let shakeMag = 0;         // current screen-shake magnitude (px)
  let comboCount = 0;
  let comboHideTimer = null;
  let playerSquash = 1;     // 1 = normal, <1 squashed, >1 stretched
  let legPhase = 0;
  let crashing = false;
  let crashTimer = 0;
  const CRASH_OUTRO_MS = 320;
  let runStartBest = 0;
  let beatBestThisRun = false;

  const GRAVITY = 2200;       // px/sec^2
  const JUMP_BASE = 620;      // px/sec upward
  const JUMP_EXTRA = 520;     // added based on scream intensity
  const JUMP_COOLDOWN_MS = 260;

  bestValueEl.textContent = best;

  // ================= Lobby / main menu =================
  const OPERATORS = [
    { img: "pottaCloseup.jpg", specialty: "Specialty: Never taking a bad photo" },
    { img: "modernpotta.jpg", specialty: "Specialty: Sees you through the sunglasses" },
    { img: "PottaPortrait.jpg", specialty: "Specialty: Weaponized hair flip" },
    { img: "pottaSaree.jpg", specialty: "Specialty: Overdressed for every occasion" },
    { img: "couplePotta.jpg", specialty: "Specialty: Steals scenes as a supporting role" },
    { img: "potta.jpg", specialty: "Specialty: Mythic-tier drama reserves" },
    { img: "Potta-Hip.jpg", specialty: "Specialty: Still posing when the camera's off" },
  ];
  let opIndex = 0;

  function rankForBest(d) {
    if (d >= 6000) return "Heroic 👑";
    if (d >= 3500) return "Diamond 💎";
    if (d >= 1800) return "Gold 🥇";
    if (d >= 700) return "Silver 🥈";
    return "Bronze 🥉";
  }

  function refreshLobbyStats() {
    if (lobbyBest) lobbyBest.textContent = best;
    if (lobbyRank) lobbyRank.textContent = rankForBest(best);
  }

  function cycleOperator() {
    if (!operatorPhoto) return;
    opIndex = (opIndex + 1) % OPERATORS.length;
    const op = OPERATORS[opIndex];
    operatorPhoto.src = op.img;
    operatorPhoto.classList.remove("operator-photo");
    void operatorPhoto.offsetWidth;
    operatorPhoto.classList.add("operator-photo");
    if (operatorSpecialty) operatorSpecialty.textContent = op.specialty;
  }

  refreshLobbyStats();
  setInterval(cycleOperator, 2600);

  if (playBtn) {
    playBtn.addEventListener("click", () => {
      Music.start();
      Music.setIntensity(0.1);
      lobbyScreen.classList.add("hidden");
      bootScreen.classList.remove("hidden");
    });
  }

  // ---- mute toggle, shared across every screen ----
  function applyMuteUI() {
    if (!muteBtn) return;
    muteBtn.textContent = muted ? "🔇" : "🔊";
    muteBtn.classList.toggle("is-muted", muted);
  }
  applyMuteUI();
  if (muteBtn) {
    muteBtn.addEventListener("click", () => {
      muted = !muted;
      localStorage.setItem("screamRoyaleMuted", muted ? "1" : "0");
      Music.setMuted(muted);
      applyMuteUI();
    });
  }

  [playBtn, micBtn, noMicBtn, replayBtn].forEach((el, i) => wireBlip(el, 620 + i * 90));

  // ================= Mic setup =================
  async function initMic() {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") await audioCtx.resume();
    const source = audioCtx.createMediaStreamSource(micStream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    dataArray = new Uint8Array(analyser.fftSize);
    usingMic = true;
  }

  function readVolume() {
    if (!analyser) return 0;
    analyser.getByteTimeDomainData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const v = (dataArray[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / dataArray.length); // RMS 0..1
  }

  function calibrate() {
    return new Promise((resolve) => {
      const DURATION = 2200;
      const start = performance.now();
      const samples = [];
      function step(ts) {
        const elapsed = ts - start;
        const pct = Math.min(100, (elapsed / DURATION) * 100);
        calFill.style.width = pct + "%";
        const v = readVolume();
        samples.push(v);
        calStatus.textContent = pct < 100 ? "Listening…" : "Locked in.";
        if (calVisualizer) calVisualizer.style.filter = "brightness(" + (1 + Math.min(2, v * 6)) + ")";
        if (elapsed < DURATION) {
          requestAnimationFrame(step);
        } else {
          const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
          const peak = Math.max(...samples);
          noiseFloor = avg;
          // threshold sits well above both the average floor AND the noisiest
          // ambient spike we saw, so a loud room doesn't false-trigger jumps.
          screamThreshold = Math.min(0.55, Math.max(noiseFloor * 3.2, peak * 1.6, 0.09));
          resolve();
        }
      }
      requestAnimationFrame(step);
    });
  }

  // ================= Boot flow =================
  micBtn.addEventListener("click", async () => {
    bootNote.textContent = "";
    micBtn.disabled = true;
    micBtn.textContent = "Requesting mic…";
    try {
      await initMic();
      bootScreen.classList.add("hidden");
      calibrateScreen.classList.remove("hidden");
      calFill.style.width = "0%";
      await calibrate();
      calibrateScreen.classList.add("hidden");
      micHint.textContent = "whisper = walk · scream past the red line = jump";
      startGame();
    } catch (err) {
      micBtn.disabled = false;
      micBtn.textContent = "🎙️ Enable Mic & Drop In";
      bootNote.textContent = "Mic blocked (" + (err.message || "permission denied") + "). Try tap/hold mode below, or allow mic access in your browser settings and retry.";
    }
  });

  noMicBtn.addEventListener("click", () => {
    usingMic = false;
    bootScreen.classList.add("hidden");
    pressHoldBtn.classList.remove("hidden");
    micHint.textContent = "no mic mode: hold to walk, quick strong tap to jump";
    startGame();
  });

  // ================= Fallback manual controls =================
  function manualStart(e) {
    if (e) e.preventDefault();
    manualActive = true;
    manualPressStart = performance.now();
  }
  function manualEnd(e) {
    if (e) e.preventDefault();
    const duration = performance.now() - manualPressStart;
    manualActive = false;
    if (duration < 220 && running) {
      triggerJump(1); // quick strong tap == scream
    }
  }
  pressHoldBtn.addEventListener("mousedown", manualStart);
  pressHoldBtn.addEventListener("mouseup", manualEnd);
  pressHoldBtn.addEventListener("mouseleave", () => { manualActive = false; });
  pressHoldBtn.addEventListener("touchstart", manualStart, { passive: false });
  pressHoldBtn.addEventListener("touchend", manualEnd, { passive: false });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !e.repeat && running) manualStart();
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space" && running) manualEnd();
  });

  // ================= Canvas sizing =================
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    const rect = gameScreen.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    GROUND_Y = H * 0.76;
    player.x = W * 0.16;
    if (player.grounded) player.y = GROUND_Y - player.h;
  }
  window.addEventListener("resize", resize);

  // ================= Jump / physics =================
  function triggerJump(intensity) {
    if (!player.grounded || jumpCooldown > 0) return;
    player.grounded = false;
    player.vy = -(JUMP_BASE + JUMP_EXTRA * Math.max(0, Math.min(1, intensity)));
    jumpCooldown = JUMP_COOLDOWN_MS;
    playerSquash = 1.35; // stretch on launch, eases back to 1 in the loop
    if (micMeter) {
      micMeter.classList.add("spike");
      setTimeout(() => micMeter.classList.remove("spike"), 180);
    }
    spawnDust(player.x + player.w / 2, GROUND_Y, 6, "#00ffc2");
    SFX.jump();
  }

  function pickTier() {
    // difficulty ramps with distance: harder tiers appear more often over time
    const t = Math.min(1, distance / 4000);
    const roll = Math.random();
    const weights = [
      0.42 - 0.2 * t, // common
      0.28,
      0.16 + 0.05 * t,
      0.09 + 0.08 * t,
      0.05 + 0.12 * t, // mythic
    ];
    let acc = 0;
    for (let i = 0; i < TIERS.length; i++) {
      acc += Math.max(0.02, weights[i]);
      if (roll <= acc) return TIERS[i];
    }
    return TIERS[0];
  }

  // ================= Juice helpers: particles & feedback =================
  function spawnSparks(x, y, color) {
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 140;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        life: 0.5 + Math.random() * 0.3,
        age: 0,
        size: 2 + Math.random() * 2,
        color,
      });
    }
  }

  function spawnDust(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 16,
        y,
        vx: (Math.random() - 0.5) * 60,
        vy: -20 - Math.random() * 40,
        life: 0.35 + Math.random() * 0.2,
        age: 0,
        size: 2 + Math.random() * 2.5,
        color,
      });
    }
  }

  function spawnFloater(x, y, text, color) {
    floaters.push({ x, y, text, color, age: 0, life: 0.8 });
  }

  function bumpStat(el) {
    if (!el) return;
    el.classList.remove("bump");
    void el.offsetWidth; // restart animation
    el.classList.add("bump");
  }

  function registerClear() {
    comboCount++;
    if (comboCount >= 2 && comboBadge && comboValueEl) {
      comboValueEl.textContent = "x" + comboCount;
      comboBadge.classList.remove("hidden");
      comboBadge.classList.add("show");
      if (comboHideTimer) clearTimeout(comboHideTimer);
      comboHideTimer = setTimeout(() => {
        comboBadge.classList.remove("show");
      }, 1400);
    }
    if (comboCount === 4) showToast("⚡ CRATE STREAK x4!");
    if (comboCount === 8) showToast("💎 UNSTOPPABLE x8!");
  }

  function resetCombo() {
    comboCount = 0;
    if (comboBadge) comboBadge.classList.remove("show");
  }

  function triggerShake(mag) {
    shakeMag = Math.max(shakeMag, mag);
  }
  function spawnObstacle() {
    const tier = pickTier();
    const h = tier.hRange[0] + Math.random() * (tier.hRange[1] - tier.hRange[0]);
    const w = 44;
    obstacles.push({
      x: W + 20, width: w, height: h, tier, passed: false,
    });
  }

  // ================= Game over =================
  function handleCrash() {
    if (crashing) return;
    crashing = true;
    crashTimer = 0;
    running = true; // keep the loop alive for the outro frames
    triggerShake(16);
    spawnSparks(player.x + player.w / 2, player.y + player.h / 2, "#ff3b4e");
    if (glitchFlash) {
      glitchFlash.classList.remove("active");
      void glitchFlash.offsetWidth;
      glitchFlash.classList.add("active");
    }
    SFX.crash();
    setTimeout(() => SFX.crowd(), 200);
  }

  function finalizeGameOver() {
    running = false;
    crashing = false;
    if (distance > best) {
      best = Math.floor(distance);
      localStorage.setItem("screamRoyaleBest", String(best));
    }
    bestValueEl.textContent = best;
    refreshLobbyStats();
    if (newBestFlash) newBestFlash.classList.add("hidden");
    Music.setIntensity(0);
    const lastHit = obstacles.find(o => !o.passed) || TIERS[0];
    const tier = lastHit.tier || lastHit;
    finalePhoto.src = tier.img;
    finaleTitle.textContent = "THE \"" + tier.key.toUpperCase() + " CRATE CONCUSSION\" AWARD";
    finaleVerdict.textContent = tier.verdict;
    animateCountUp(finalScoreValueEl, Math.floor(distance), 700);
    finaleOverlay.classList.add("active");
    setTimeout(() => SFX.finale(), 300);
  }

  function animateCountUp(el, target, durationMs) {
    const start = performance.now();
    function step(ts) {
      const p = Math.min(1, (ts - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.floor(eased * target);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = target;
    }
    requestAnimationFrame(step);
  }

  replayBtn.addEventListener("click", () => {
    finaleOverlay.classList.remove("active");
    resetRun();
    running = true;
    lastTs = performance.now();
    requestAnimationFrame(loop);
  });

  function resetRun() {
    obstacles = [];
    particles = [];
    floaters = [];
    shakeMag = 0;
    crashing = false;
    crashTimer = 0;
    resetCombo();
    spawnTimer = 900;
    scrollSpeed = 220;
    distance = 0;
    cleared = 0;
    runStartBest = best;
    beatBestThisRun = false;
    if (newBestFlash) newBestFlash.classList.add("hidden");
    if (glitchFlash) glitchFlash.classList.remove("active");
    player.grounded = true;
    player.vy = 0;
    player.y = GROUND_Y - player.h;
    scoreValueEl.textContent = "0";
    clearedValueEl.textContent = "0";
  }

  function startGame() {
    gameScreen.classList.remove("hidden");
    resize();
    resetRun();
    running = true;
    lastTs = performance.now();
    requestAnimationFrame(loop);
  }

  function stepJuice(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      if (p.age >= p.life) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt;
    }
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.age += dt;
      if (f.age >= f.life) { floaters.splice(i, 1); continue; }
      f.y -= 34 * dt;
    }
    shakeMag *= Math.max(0, 1 - dt * 8);
    if (shakeMag < 0.1) shakeMag = 0;
  }

  // ================= Main loop =================
  function loop(ts) {
    if (!running) return;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;

    // --- crash outro: freeze gameplay, let shake/particles play out, then show the modal ---
    if (crashing) {
      crashTimer += dt * 1000;
      stepJuice(dt);
      draw();
      if (crashTimer >= CRASH_OUTRO_MS) {
        finalizeGameOver();
        return;
      }
      requestAnimationFrame(loop);
      return;
    }

    // --- voice sampling ---
    if (usingMic) {
      rawVolume = readVolume();
      smoothedVolume = smoothedVolume + (rawVolume - smoothedVolume) * 0.3;
    } else {
      rawVolume = manualActive ? 1 : 0;
      smoothedVolume = manualActive ? 1 : smoothedVolume * 0.85;
    }

    // --- meter UI ---
    if (usingMic) {
      const pct = Math.min(100, Math.round((rawVolume / (screamThreshold * 1.6)) * 100));
      micFill.style.width = pct + "%";
      const threshPct = Math.min(95, Math.round((screamThreshold / (screamThreshold * 1.6)) * 100));
      micThreshold.style.left = threshPct + "%";
    }

    if (jumpCooldown > 0) jumpCooldown -= dt * 1000;

    // --- scream detection -> jump ---
    if (usingMic) {
      if (rawVolume > screamThreshold) {
        const spike = (rawVolume - screamThreshold) / Math.max(0.001, (1 - screamThreshold));
        triggerJump(spike);
      }
    }

    // --- walk speed from voice level ---
    let walkFactor;
    if (usingMic) {
      const range = Math.max(0.001, screamThreshold - noiseFloor);
      walkFactor = Math.max(0, Math.min(1, (smoothedVolume - noiseFloor) / range));
    } else {
      walkFactor = smoothedVolume;
    }
    const speedMult = 0.32 + 0.85 * walkFactor;
    scrollSpeed = Math.min(520, 220 + distance / 22); // base ramp with distance
    const effectiveSpeed = scrollSpeed * speedMult;
    const dangerLevel = Math.max(0, Math.min(1, (scrollSpeed - 220) / 300));
    gameScreen.style.setProperty("--danger", dangerLevel.toFixed(3));
    Music.setIntensity(dangerLevel);

    if (!beatBestThisRun && distance > runStartBest && runStartBest > 0) {
      beatBestThisRun = true;
      if (newBestFlash) newBestFlash.classList.remove("hidden");
      showToast("🔥 NEW RECORD!");
    }

    // --- physics ---
    if (!player.grounded) {
      player.vy += GRAVITY * dt;
      player.y += player.vy * dt;
      if (player.y >= GROUND_Y - player.h) {
        player.y = GROUND_Y - player.h;
        player.vy = 0;
        player.grounded = true;
        playerSquash = 0.72; // squash on impact, eases back below
        spawnDust(player.x + player.w / 2, GROUND_Y, 8, "#7fa89a");
        SFX.land();
      }
    }
    // ease squash/stretch back toward 1 every frame
    playerSquash += (1 - playerSquash) * Math.min(1, dt * 10);
    legPhase += dt * (player.grounded ? 10 + effectiveSpeed / 40 : 0);

    // --- obstacles ---
    spawnTimer -= dt * 1000 * (0.6 + speedMult);
    if (spawnTimer <= 0) {
      spawnObstacle();
      spawnTimer = Math.max(650, 1400 - distance / 6) + Math.random() * 400;
    }

    const margin = 6; // forgiveness on hitboxes
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= effectiveSpeed * dt;

      if (!o.passed && o.x + o.width < player.x) {
        o.passed = true;
        cleared++;
        distance += o.tier.points * 8;
        clearedValueEl.textContent = cleared;
        bumpStat(clearedValueEl);
        spawnSparks(o.x + o.width / 2, GROUND_Y - o.height / 2, o.tier.color);
        spawnFloater(o.x + o.width / 2, GROUND_Y - o.height - 10, "+" + o.tier.points, o.tier.color);
        registerClear();
        SFX.pass();
      }

      const oy = GROUND_Y - o.height;
      const overlap =
        player.x + margin < o.x + o.width - margin &&
        player.x + player.w - margin > o.x + margin &&
        player.y + margin < oy + o.height &&
        player.y + player.h - margin > oy;

      if (overlap) {
        handleCrash();
        break;
      }

      if (o.x + o.width < -20) obstacles.splice(i, 1);
    }

    distance += effectiveSpeed * dt * 0.12;
    scoreValueEl.textContent = Math.floor(distance);

    stepJuice(dt);

    draw();
    requestAnimationFrame(loop);
  }

  // ================= Rendering =================
  function draw() {
    ctx.save();

    // screen shake: small random jitter proportional to current shakeMag
    if (shakeMag > 0) {
      const sx = (Math.random() - 0.5) * shakeMag;
      const sy = (Math.random() - 0.5) * shakeMag;
      ctx.translate(sx, sy);
    }

    ctx.clearRect(-20, -20, W + 40, H + 40);

    // sky gradient drifts hue slightly with distance for a sense of progress
    const huettle = Math.min(1, distance / 6000);
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    sky.addColorStop(0, `rgba(${10 + huettle * 20}, ${21 - huettle * 6}, ${18 - huettle * 4}, 1)`);
    sky.addColorStop(1, "#050908");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, GROUND_Y);

    // distant parallax skyline (slow-scrolling silhouette)
    ctx.save();
    ctx.fillStyle = "rgba(0, 255, 194, 0.05)";
    const skyOffset = (distance * 0.12) % 220;
    for (let x = -skyOffset; x < W + 220; x += 220) {
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y);
      ctx.lineTo(x + 30, GROUND_Y - 70);
      ctx.lineTo(x + 70, GROUND_Y - 40);
      ctx.lineTo(x + 110, GROUND_Y - 110);
      ctx.lineTo(x + 150, GROUND_Y - 55);
      ctx.lineTo(x + 190, GROUND_Y - 90);
      ctx.lineTo(x + 220, GROUND_Y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // parallax grid
    ctx.save();
    ctx.strokeStyle = "rgba(0,255,194,0.06)";
    ctx.lineWidth = 1;
    const gridOffset = (distance * 0.5) % 40;
    for (let x = -gridOffset; x < W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    ctx.restore();

    // speed lines when moving fast (reinforces momentum, BR-chase feel)
    const speedRatio = Math.min(1, scrollSpeed / 480);
    if (speedRatio > 0.35) {
      ctx.save();
      ctx.strokeStyle = `rgba(255, 122, 26, ${0.05 + speedRatio * 0.12})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const ly = (H * 0.15) + i * (H * 0.16) + Math.sin(distance * 0.02 + i) * 6;
        const len = 40 + speedRatio * 60;
        const lx = (W - ((distance * 3 + i * 140) % (W + len)));
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + len, ly);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ground line
    ctx.strokeStyle = "rgba(0,255,194,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(W, GROUND_Y);
    ctx.stroke();

    ctx.strokeStyle = "rgba(0,255,194,0.15)";
    ctx.setLineDash([10, 14]);
    const dashOffset = (distance * 1.4) % 24;
    ctx.beginPath();
    ctx.moveTo(-dashOffset, GROUND_Y + 6);
    ctx.lineTo(W, GROUND_Y + 6);
    ctx.stroke();
    ctx.setLineDash([]);

    // obstacles
    obstacles.forEach(o => {
      const oy = GROUND_Y - o.height;
      const img = images[o.tier.img];
      ctx.save();
      ctx.shadowColor = o.tier.color;
      ctx.shadowBlur = 14;
      // frame
      ctx.fillStyle = "rgba(10,20,18,0.9)";
      roundRect(ctx, o.x, oy, o.width, o.height, 6);
      ctx.fill();
      if (img && img.complete && img.naturalWidth) {
        ctx.save();
        roundRect(ctx, o.x + 3, oy + 3, o.width - 6, o.height - 6, 4);
        ctx.clip();
        // cover-fit crop
        const scale = Math.max((o.width - 6) / img.naturalWidth, (o.height - 6) / img.naturalHeight);
        const iw = img.naturalWidth * scale, ih = img.naturalHeight * scale;
        ctx.drawImage(img, o.x + 3 - (iw - (o.width - 6)) / 2, oy + 3 - (ih - (o.height - 6)) / 2, iw, ih);
        ctx.restore();
      }
      ctx.strokeStyle = o.tier.color;
      ctx.lineWidth = 2;
      roundRect(ctx, o.x, oy, o.width, o.height, 6);
      ctx.stroke();
      // little rarity corner tick, echoes the site's HUD-corner motif
      ctx.strokeStyle = o.tier.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(o.x + 2, oy + 10); ctx.lineTo(o.x + 2, oy + 2); ctx.lineTo(o.x + 10, oy + 2);
      ctx.stroke();
      ctx.restore();
    });

    // player shadow (shrinks with jump height)
    const heightAbove = GROUND_Y - (player.y + player.h);
    const shadowScale = Math.max(0.35, 1 - heightAbove / 160);
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.ellipse(player.x + player.w / 2, GROUND_Y + 4, (player.w / 1.6) * shadowScale, 5 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // player (stylized HUD trooper diamond, with squash/stretch + running legs)
    ctx.save();
    const cx = player.x + player.w / 2;
    const cy = player.y + player.h / 2;
    ctx.translate(cx, cy);
    ctx.scale(1 / Math.sqrt(playerSquash), playerSquash);
    ctx.shadowColor = "#00ffc2";
    ctx.shadowBlur = 16;

    // running legs (only visible while grounded)
    if (player.grounded) {
      ctx.strokeStyle = "#e1ff00";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      const swing = Math.sin(legPhase) * (player.w * 0.28);
      ctx.beginPath();
      ctx.moveTo(-4, player.h / 2 - 2); ctx.lineTo(-4 + swing, player.h / 2 + 10);
      ctx.moveTo(4, player.h / 2 - 2); ctx.lineTo(4 - swing, player.h / 2 + 10);
      ctx.stroke();
    }

    ctx.fillStyle = "#eafff5";
    ctx.strokeStyle = "#00ff33";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -player.h / 2);
    ctx.lineTo(player.w / 2, 0);
    ctx.lineTo(0, player.h / 2);
    ctx.lineTo(-player.w / 2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // visor line
    ctx.strokeStyle = "#ff7a1a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-6, -4);
    ctx.lineTo(6, -4);
    ctx.stroke();
    ctx.restore();

    // particles: sparks + dust
    particles.forEach(p => {
      const t = p.age / p.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - t * 0.4), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // floating "+N" score text
    floaters.forEach(f => {
      const t = f.age / f.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.font = "700 15px 'Orbitron', sans-serif";
      ctx.fillStyle = f.color;
      ctx.textAlign = "center";
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 6;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    });

    ctx.restore(); // matches the shake translate at the top
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
})();