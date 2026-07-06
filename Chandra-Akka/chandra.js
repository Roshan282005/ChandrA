document.addEventListener("DOMContentLoaded", () => {
  const body = document.body;
  const spotlightOverlay = document.getElementById("spotlightOverlay");
  const startShowBtn = document.getElementById("startShowBtn");
  const awardsGrid = document.getElementById("awardsGrid");
  const meterFill = document.getElementById("meterFill");
  const scoreValueEl = document.getElementById("scoreValue");
  const awardsOpenedEl = document.getElementById("awardsOpened");
  const rankLabelEl = document.getElementById("rankLabel");
  const finaleBtn = document.getElementById("finaleBtn");
  const finaleOverlay = document.getElementById("finaleOverlay");
  const finalScoreValueEl = document.getElementById("finalScoreValue");
  const replayBtn = document.getElementById("replayBtn");
  const closeButtons = document.querySelectorAll(".goback");
  const confettiLayer = document.getElementById("confettiLayer");
  const soundToggle = document.getElementById("soundToggle");

  // Only the "real" award cards count toward totals — the mystery card unlocks separately.
  const realCards = () => Array.from(document.querySelectorAll(".award-card:not(.mystery)"));
  const mysteryCard = document.querySelector(".award-card.mystery");
  const TOTAL_AWARDS = realCards().length;
  const MAX_POSSIBLE = realCards().reduce((sum, c) => sum + Number(c.dataset.points || 0), 0);

  let score = 0;
  let opened = 0;
  let muted = false;
  let ambientAudio = null;

  // ---------- Audio engine ----------
  // Every clip is optional: if the mp3 file isn't present yet, playback just
  // fails silently (console warning only) so the site never breaks waiting on assets.
  function playClip(src, { volume = 1 } = {}) {
    if (muted) return;
    try {
      const clip = new Audio(src);
      clip.volume = Math.min(1, Math.max(0, volume));
      clip.currentTime = 0;
      clip.play().catch((err) => console.warn(`Audio blocked/missing (${src}):`, err.message));
    } catch (err) {
      console.warn(`Audio setup failed (${src}):`, err.message);
    }
  }

  const SOUND = {
    reveal: () => playClip("reveal-sound2.mp3"),
    finale: () => playClip("finale-sound.mp3"),
    drumroll: () => playClip("Anhh_.mp3", { volume: 6 }),
    whoosh: () => playClip("hmm_mm.mp3", { volume: 2 }),
    rankUp: () => playClip("reveal-sound2.mp3"),
    secretUnlock: () => playClip("bleh.mp3"),
    crowdCheer: () => playClip("Arhhh_.mp3", { volume: 0.9 }),
  };

  function toggleSound() {
    muted = !muted;
    soundToggle.classList.toggle("muted", muted);
    soundToggle.textContent = muted ? "🔇" : "🔊";
    if (ambientAudio) {
      if (muted) ambientAudio.pause();
      else ambientAudio.play().catch(() => {});
    }
  }

  soundToggle.addEventListener("click", () => {
    // Ambient loop only starts on first unmuted interaction (browser autoplay rules).
    if (!ambientAudio && !muted) {
      ambientAudio = new Audio("ambient-loop.mp3");
      ambientAudio.loop = true;
      ambientAudio.volume = 0.25;
      ambientAudio.play().catch((err) => console.warn("Ambient loop missing/blocked:", err.message));
    }
    toggleSound();
  });

  // ---------- Cinematic sequential reveal ----------
  // Cards start hidden via opacity:0 + visibility:hidden (not literal
  // display:none, so the grid doesn't jump/reflow as each one lands), then
  // get unveiled one-by-one with a shutter-flash + blur-to-focus cut — a
  // montage beat rather than everything loading in at once.
  const revealFlash = document.getElementById("revealFlash");
  const pendingCards = () => Array.from(document.querySelectorAll(".award-card.reveal-pending"));

  function fireShutter() {
    revealFlash.classList.remove("fire");
    void revealFlash.offsetWidth;
    revealFlash.classList.add("fire");
  }

  function runCinematicReveal() {
    const cards = pendingCards();
    const STEP_MS = 420;
    cards.forEach((card, i) => {
      setTimeout(() => {
        fireShutter();
        card.classList.remove("reveal-pending");
        card.classList.add("reveal-in");
        SOUND.whoosh();
      }, i * STEP_MS);
    });
  }

  // ---------- Spotlight intro ----------
  function dismissSpotlight() {
    SOUND.whoosh();
    spotlightOverlay.classList.add("hidden");
    body.classList.remove("locked");
    runCinematicReveal();
  }

  body.classList.add("locked");
  spotlightOverlay.addEventListener("click", dismissSpotlight, { once: true });
  startShowBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dismissSpotlight();
    document.querySelector(".scoreboard-card").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // ---------- Rank labels ----------
  function rankFor(pct) {
    if (pct >= 100) return "Icon 👑";
    if (pct >= 70) return "Certified Menace";
    if (pct >= 40) return "Rising Diva";
    if (pct >= 15) return "Warming Up";
    return "Rookie";
  }

  let currentRank = rankFor(0);

  function updateScoreboard() {
    const pct = Math.min(100, Math.round((score / MAX_POSSIBLE) * 100));
    meterFill.style.width = pct + "%";
    scoreValueEl.textContent = score;
    awardsOpenedEl.textContent = opened;

    const newRank = rankFor(pct);
    if (newRank !== currentRank) {
      currentRank = newRank;
      rankLabelEl.textContent = newRank;
      rankLabelEl.classList.remove("rank-flash");
      // Force reflow so the animation can re-trigger on repeated rank-ups.
      void rankLabelEl.offsetWidth;
      rankLabelEl.classList.add("rank-flash");
      SOUND.rankUp();
    } else {
      rankLabelEl.textContent = newRank;
    }

    // Every real award opened, check if the mystery card should unlock.
    if (opened >= TOTAL_AWARDS && mysteryCard && !mysteryCard.classList.contains("unlocked")) {
      unlockMystery();
    }
  }

  updateScoreboard();

  function unlockMystery() {
    mysteryCard.classList.add("unlocked");
    const lockNote = mysteryCard.querySelector(".mystery-lock-note");
    if (lockNote) lockNote.remove();
    SOUND.secretUnlock();
    burstConfetti(30);
  }

  // ---------- Award card reveal logic (with drumroll suspense beat) ----------
  const DRUMROLL_MS = 650;

  awardsGrid.addEventListener("click", (e) => {
    const btn = e.target.closest(".reveal-btn");
    if (!btn) return;
    const card = btn.closest(".award-card");
    if (card.classList.contains("opened") || card.classList.contains("suspense")) return;
    if (card.classList.contains("mystery") && !card.classList.contains("unlocked")) return;

    // Suspense beat: drumroll plays, button locks and jitters, THEN the verdict lands.
    card.classList.add("suspense");
    SOUND.drumroll();

    setTimeout(() => {
      card.classList.remove("suspense");
      card.classList.add("opened");

      const points = Number(card.dataset.points || 0);
      score += points;
      opened += 1;
      updateScoreboard();

      SOUND.reveal();

      if (card.classList.contains("wide") || card.classList.contains("mystery")) {
        body.classList.add("screen-shake");
        setTimeout(() => body.classList.remove("screen-shake"), 450);
        burstConfetti(28);
      } else {
        burstConfetti(14);
      }
    }, DRUMROLL_MS);
  });

  // ---------- Finale modal ----------
  function openFinale() {
    finaleOverlay.classList.add("active");
    finaleOverlay.setAttribute("aria-hidden", "false");
    body.classList.add("locked");
    finalScoreValueEl.textContent = score;
    SOUND.finale();
    setTimeout(() => SOUND.crowdCheer(), 150);
    burstConfetti(60);
  }

  function closeFinale() {
    finaleOverlay.classList.remove("active");
    finaleOverlay.setAttribute("aria-hidden", "true");
    body.classList.remove("locked");
  }

  finaleBtn.addEventListener("click", openFinale);
  closeButtons.forEach((btn) => btn.addEventListener("click", closeFinale));
  finaleOverlay.addEventListener("click", (e) => {
    if (e.target === finaleOverlay) closeFinale();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeFinale();
  });

  replayBtn.addEventListener("click", () => {
    score = 0;
    opened = 0;
    currentRank = rankFor(0);
    updateScoreboard();
    document.querySelectorAll(".award-card.opened").forEach((c) => c.classList.remove("opened"));
    if (mysteryCard) {
      mysteryCard.classList.remove("unlocked");
      if (!mysteryCard.querySelector(".mystery-lock-note")) {
        const note = document.createElement("div");
        note.className = "mystery-lock-note";
        note.innerHTML = "<strong>🔒 LOCKED</strong>Open all 6 awards above to unlock this one.";
        mysteryCard.querySelector(".award-body").prepend(note);
      }
    }
    closeFinale();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // ---------- Confetti ----------
  const confettiColors = ["#ffd60a", "#ff3d81", "#00f5d4", "#ff8a3d"];

  function burstConfetti(count) {
    for (let i = 0; i < count; i++) {
      const piece = document.createElement("div");
      piece.className = "confetti-piece";
      piece.style.left = Math.random() * 100 + "vw";
      piece.style.background = confettiColors[Math.floor(Math.random() * confettiColors.length)];
      piece.style.animationDuration = 2.2 + Math.random() * 1.6 + "s";
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;
      confettiLayer.appendChild(piece);
      piece.addEventListener("animationend", () => piece.remove());
    }
  }
});