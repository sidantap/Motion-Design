// The strands are pinned ropes; the links follow the ropes' local direction.
// Everything is in CSS pixels so resizing and high-density displays agree.
export function initCurtain() {
  const canvas = document.querySelector("#curtain");
  const control = document.querySelector(".curtain-control");
  const soundControl = document.querySelector(".sound");
  const replay = document.querySelector("#replay");
  const ctx = canvas?.getContext("2d", { alpha: true });
  if (!canvas || !ctx || !control) return () => {};

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const Audio = window.AudioContext || window.webkitAudioContext;
  const strandCount = 34;
  const segmentCount = 20;
  const fixedStep = 1 / 90;
  const pointer = { active: false, x: 0, y: 0 };
  let width = 0;
  let height = 0;
  let strands = [];
  let parted = false;
  let gathered = 0;
  let gatherVelocity = 0;
  let frame = 0;
  let lastTime = 0;
  let elapsed = 0;
  let accumulator = 0;
  let visible = true;
  let audioEnabled = false;
  let audio;
  let lastChime = -Infinity;

  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const canAnimate = () =>
    visible && !document.hidden && !reducedMotion.matches;

  function targetFor(strand) {
    const left = strand.index < strandCount / 2;
    const order = left ? strand.index : strandCount - 1 - strand.index;
    return {
      x: left
        ? width * (0.035 + order * 0.004)
        : width * (0.965 - order * 0.004),
      y: strand.length * 0.55,
    };
  }

  function staticShape(strand, amount) {
    const tie = targetFor(strand);
    const tieIndex = 13;
    // A gathered curtain descends from its original hooks, folds toward the
    // jambs, then hangs freely below the gathering point.
    for (let j = 0; j <= segmentCount; j++) {
      const p = j / segmentCount;
      const t = Math.min(j / tieIndex, 1);
      const bend = t * t * (3 - 2 * t);
      let x = strand.anchor + (tie.x - strand.anchor) * amount * bend;
      let y = p * strand.length;
      if (j <= tieIndex) {
        y += (tie.y - (tieIndex / segmentCount) * strand.length) * amount * t;
      } else {
        y += (tie.y - (tieIndex / segmentCount) * strand.length) * amount;
        x +=
          Math.sin(((j - tieIndex) / (segmentCount - tieIndex)) * Math.PI) *
          width *
          0.006 *
          amount;
      }
      if (pointer.active && j > 0) {
        const dy = y - pointer.y;
        const dx = x - pointer.x;
        const radius = Math.max(16, width * 0.13);
        const distance = Math.hypot(dx, dy);
        if (distance < radius)
          x +=
            (dx < 0 ? -1 : 1) * (radius - distance) * 0.8 * Math.min(p * 5, 1);
      }
      const node = strand.nodes[j];
      node.x = node.previousX = x;
      node.y = node.previousY = y;
    }
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    strands = Array.from({ length: strandCount }, (_, index) => {
      const strand = {
        index,
        anchor: ((index + 0.5) / strandCount) * width,
        length: height * (0.965 + Math.sin(index * 2.71) * 0.012),
        phase: index * 0.14,
        nodes: Array.from({ length: segmentCount + 1 }, () => ({
          x: 0,
          y: 0,
          previousX: 0,
          previousY: 0,
        })),
      };
      staticShape(strand, gathered);
      return strand;
    });
    draw();
    requestTick();
  }

  function simulate(dt) {
    // A critically damped, time-based movement keeps the gathering gentle.
    const acceleration =
      ((parted ? 1 : 0) - gathered) * 35 - gatherVelocity * 12;
    gatherVelocity += acceleration * dt;
    gathered = clamp(gathered + gatherVelocity * dt, 0, 1);
    const damping = Math.exp(-5.2 * dt);

    for (const strand of strands) {
      const nodes = strand.nodes;
      const wind =
        Math.sin(elapsed * 0.65 + strand.phase) *
        height *
        0.016 *
        (1 - gathered * 0.7);
      for (let j = 1; j <= segmentCount; j++) {
        const node = nodes[j];
        const oldX = node.x;
        const oldY = node.y;
        node.x += (node.x - node.previousX) * damping + wind * dt * dt;
        node.y += (node.y - node.previousY) * damping + height * 3.5 * dt * dt;
        node.previousX = oldX;
        node.previousY = oldY;
      }

      const segmentLength = strand.length / segmentCount;
      const tie = targetFor(strand);
      for (let iteration = 0; iteration < 9; iteration++) {
        nodes[0].x = strand.anchor;
        nodes[0].y = 0;
        if (gathered > 0.0001) {
          const node = nodes[13];
          const strength = gathered * 0.38;
          node.x += (tie.x - node.x) * strength;
          node.y += (tie.y - node.y) * strength;
        }
        for (let j = 0; j < segmentCount; j++) {
          const a = nodes[j];
          const b = nodes[j + 1];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distance = Math.hypot(dx, dy) || 0.001;
          const correction = (distance - segmentLength) / distance;
          const share = j === 0 ? 1 : 0.5;
          if (j > 0) {
            a.x += dx * correction * 0.5;
            a.y += dy * correction * 0.5;
          }
          b.x -= dx * correction * share;
          b.y -= dy * correction * share;
        }
        if (pointer.active) {
          const radius = Math.max(16, width * 0.13);
          for (let j = 1; j <= segmentCount; j++) {
            const node = nodes[j];
            const dx = node.x - pointer.x;
            const dy = node.y - pointer.y;
            const distance = Math.hypot(dx, dy);
            if (distance < radius) {
              node.x += (dx < 0 ? -1 : 1) * (radius - distance) * 0.22;
            }
          }
        }
      }
      nodes[0].x = strand.anchor;
      nodes[0].y = 0;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    if (!width || !height) return;
    const linkHeight = clamp(height / 96, 3.2, 5.5);
    const linkWidth = linkHeight * 0.27;
    const links = [];
    for (const strand of strands) {
      let travelled = 0;
      let nextLink = linkHeight * 0.6;
      let linkNumber = 0;
      for (let j = 0; j < segmentCount; j++) {
        const a = strand.nodes[j];
        const b = strand.nodes[j + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);
        while (distance > 0 && nextLink <= travelled + distance) {
          const t = (nextLink - travelled) / distance;
          links.push({
            x: a.x + dx * t,
            y: a.y + dy * t,
            angle: -Math.atan2(dx, dy),
            edge: (linkNumber + strand.index) % 2,
            worn: (linkNumber * 7 + strand.index * 11) % 13 < 3,
          });
          nextLink += linkHeight * 1.43;
          linkNumber++;
        }
        travelled += distance;
      }
    }

    // A dark edge, a muted brass face, and a fine broken highlight give each
    // alternating link depth without a bright illustrated outline.
    ctx.beginPath();
    for (const link of links) {
      const radius = link.edge ? linkWidth * 0.28 : linkWidth;
      ctx.moveTo(
        link.x + 0.65 + radius * Math.cos(link.angle),
        link.y + 0.8 + radius * Math.sin(link.angle),
      );
      ctx.ellipse(
        link.x + 0.65,
        link.y + 0.8,
        radius,
        linkHeight,
        link.angle,
        0,
        Math.PI * 2,
      );
    }
    ctx.lineWidth = 0.95;
    ctx.strokeStyle = "rgba(8, 7, 5, .76)";
    ctx.stroke();

    ctx.beginPath();
    for (const link of links) {
      const radius = link.edge ? linkWidth * 0.28 : linkWidth;
      ctx.moveTo(
        link.x + radius * Math.cos(link.angle),
        link.y + radius * Math.sin(link.angle),
      );
      ctx.ellipse(
        link.x,
        link.y,
        radius,
        linkHeight,
        link.angle,
        0,
        Math.PI * 2,
      );
    }
    const brass = ctx.createLinearGradient(0, 0, width, height);
    brass.addColorStop(0, "#927441");
    brass.addColorStop(0.4, "#76603c");
    brass.addColorStop(1, "#54452e");
    ctx.strokeStyle = brass;
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.beginPath();
    for (const link of links) {
      if (link.worn) continue;
      const radius = link.edge ? linkWidth * 0.28 : linkWidth;
      const startAngle = Math.PI * 1.03;
      ctx.moveTo(
        link.x +
          Math.cos(startAngle) * radius * Math.cos(link.angle) -
          Math.sin(startAngle) * linkHeight * Math.sin(link.angle),
        link.y +
          Math.cos(startAngle) * radius * Math.sin(link.angle) +
          Math.sin(startAngle) * linkHeight * Math.cos(link.angle),
      );
      ctx.ellipse(
        link.x,
        link.y,
        radius,
        linkHeight,
        link.angle,
        startAngle,
        Math.PI * 1.65,
      );
    }
    ctx.strokeStyle = "rgba(201, 174, 113, .54)";
    ctx.lineWidth = 0.45;
    ctx.stroke();
  }

  function tick(time) {
    frame = 0;
    if (!canAnimate()) return;
    const delta = lastTime
      ? Math.min((time - lastTime) / 1000, 0.06)
      : fixedStep;
    lastTime = time;
    accumulator += delta;
    while (accumulator >= fixedStep) {
      elapsed += fixedStep;
      simulate(fixedStep);
      accumulator -= fixedStep;
    }
    draw();
    requestTick();
  }

  function requestTick() {
    if (!frame && canAnimate() && width && height)
      frame = requestAnimationFrame(tick);
  }

  function updateVisibility() {
    if (!canAnimate()) {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      accumulator = 0;
    } else requestTick();
  }

  function updateStatic() {
    if (!reducedMotion.matches) return;
    gathered = parted ? 1 : 0;
    gatherVelocity = 0;
    strands.forEach((strand) => staticShape(strand, gathered));
    draw();
  }

  function chime() {
    if (!audioEnabled || !audio || performance.now() - lastChime < 180) return;
    lastChime = performance.now();
    if (audio.state === "suspended") audio.resume().catch(() => {});
    const now = audio.currentTime;
    const base = [1108, 1244, 1397, 1661][Math.floor(Math.random() * 4)];
    [1, 2.76, 4.1].forEach((partial, index) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = base * partial;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.009 / (index + 1), now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36 / (index + 1));
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.4);
    });
  }

  function setParted(value) {
    parted = value;
    control.setAttribute("aria-pressed", String(parted));
    control.setAttribute(
      "aria-label",
      parted ? "Close the chain curtain" : "Part the chain curtain",
    );
    control.innerHTML = `<span aria-hidden="true">↔</span> ${parted ? "Let the chains fall" : "Move through the chains"}`;
    updateStatic();
    requestTick();
  }

  function onControl() {
    setParted(!parted);
    chime();
  }

  function onPointer(event) {
    const bounds = canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    if (pointer.active && Math.hypot(x - pointer.x, y - pointer.y) > 4) chime();
    pointer.active = true;
    pointer.x = x;
    pointer.y = y;
    updateStatic();
    requestTick();
  }

  function leavePointer() {
    pointer.active = false;
    updateStatic();
  }

  function onPointerUp(event) {
    if (event.pointerType !== "mouse") leavePointer();
  }

  function updateSoundControl() {
    if (!soundControl) return;
    soundControl.setAttribute("aria-pressed", String(audioEnabled));
    soundControl.setAttribute(
      "aria-label",
      audioEnabled ? "Disable chain sounds" : "Enable chain sounds",
    );
    soundControl.innerHTML = `Sound ${audioEnabled ? "on" : "off"} <span aria-hidden="true">≋</span>`;
  }

  function onSound() {
    if (!Audio) return;
    try {
      audioEnabled = !audioEnabled;
      if (audioEnabled) {
        audio ||= new Audio();
        if (audio.state === "suspended") audio.resume().catch(() => {});
        chime();
      }
    } catch {
      audioEnabled = false;
    }
    updateSoundControl();
  }

  function onReplay() {
    document
      .querySelector("#home")
      ?.scrollIntoView({
        behavior: reducedMotion.matches ? "instant" : "smooth",
      });
    pointer.active = false;
    setParted(false);
  }

  function onMotionChange() {
    pointer.active = false;
    updateStatic();
    updateVisibility();
  }

  control.addEventListener("click", onControl);
  soundControl?.addEventListener("click", onSound);
  replay?.addEventListener("click", onReplay);
  canvas.addEventListener("pointermove", onPointer);
  canvas.addEventListener("pointerdown", onPointer);
  canvas.addEventListener("pointerleave", leavePointer);
  canvas.addEventListener("pointercancel", leavePointer);
  canvas.addEventListener("pointerup", onPointerUp);
  document.addEventListener("visibilitychange", updateVisibility);
  reducedMotion.addEventListener("change", onMotionChange);
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  const intersection = new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      updateVisibility();
    },
    { rootMargin: "60px" },
  );
  intersection.observe(canvas);
  if (soundControl && !Audio) {
    soundControl.disabled = true;
    soundControl.title = "Chain sounds are unavailable in this browser";
  }
  setParted(false);
  updateSoundControl();
  resize();

  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    intersection.disconnect();
    document.removeEventListener("visibilitychange", updateVisibility);
    reducedMotion.removeEventListener("change", onMotionChange);
    control.removeEventListener("click", onControl);
    soundControl?.removeEventListener("click", onSound);
    replay?.removeEventListener("click", onReplay);
    canvas.removeEventListener("pointermove", onPointer);
    canvas.removeEventListener("pointerdown", onPointer);
    canvas.removeEventListener("pointerleave", leavePointer);
    canvas.removeEventListener("pointercancel", leavePointer);
    canvas.removeEventListener("pointerup", onPointerUp);
    audio?.close().catch(() => {});
  };
}
