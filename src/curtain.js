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
  let strandCount = 32;
  const segmentCount = 20;
  const fixedStep = 1 / 90;
  const pointer = { active: false, x: 0, y: 0 };
  let width = 0;
  let height = 0;
  let strands = [];
  let parted = false;
  // A little slack leaves a view through the centre even before interaction.
  const restingGather = 0.34;
  let gathered = restingGather;
  let gatherVelocity = 0;
  let frame = 0;
  let lastTime = 0;
  let elapsed = 0;
  let accumulator = 0;
  let visible = true;
  let audioEnabled = false;
  let audio;
  let lastChime = -Infinity;
  let linkSprites = [];
  let linkLength = 5.2;

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
      y: strand.anchorY + strand.length * 0.55,
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
      let y = strand.anchorY + p * strand.length;
      if (j <= tieIndex) {
        y +=
          (tie.y - strand.anchorY - (tieIndex / segmentCount) * strand.length) *
          amount *
          t;
      } else {
        y +=
          (tie.y - strand.anchorY - (tieIndex / segmentCount) * strand.length) *
          amount;
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
    strandCount = width < 350 ? 24 : 32;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    buildLinkSprites();
    strands = Array.from({ length: strandCount }, (_, index) => {
      const u = (index + 0.5) / strandCount;
      const arch =
        canvas.dataset.arch === "true"
          ? 0.3 * (1 - Math.sqrt(1 - ((2 * u - 1) * 0.98) ** 2)) +
            0.005 * Math.sin(u * Math.PI * 10) ** 2
          : 0;
      const anchorY = height * arch;
      const strand = {
        index,
        anchor:
          u * width + Math.sin(index * 5.37) * Math.min(1.3, width * 0.002),
        anchorY,
        length: height * (0.972 + Math.sin(index * 2.71) * 0.008) - anchorY,
        phase: index * 0.61,
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
      ((parted ? 1 : restingGather) - gathered) * 35 - gatherVelocity * 12;
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
        nodes[0].y = strand.anchorY;
        if (gathered > 0.0001) {
          const node = nodes[13];
          const tieX = strand.anchor + (tie.x - strand.anchor) * gathered;
          const hangingY = strand.anchorY + (13 / segmentCount) * strand.length;
          const tieY = hangingY + (tie.y - hangingY) * gathered;
          node.x += (tieX - node.x) * 0.38;
          node.y += (tieY - node.y) * 0.38;
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
      nodes[0].y = strand.anchorY;
    }
  }

  function buildLinkSprites() {
    // Each link is a small piece of tubing, with an open centre. Drawing these
    // once keeps thousands of shaded metal surfaces inexpensive to animate.
    linkLength = clamp(height / 115, 4.1, 5.6);
    const scale = 4;
    const size = 12;
    linkSprites = Array.from({ length: 6 }, (_, light) =>
      Array.from({ length: 3 }, (_, turn) =>
        Array.from({ length: 2 }, (_, worn) => {
          const sprite = document.createElement("canvas");
          sprite.width = sprite.height = size * scale;
          const metal = sprite.getContext("2d");
          metal.scale(scale, scale);
          metal.translate(size / 2, size / 2);
          const tube = 0.72;
          const rx = [0.66, 0.42, 0.12][turn];
          const ry = (linkLength - tube) / 2;
          const cap = Math.min(rx, 0.7);
          const path = new Path2D();
          path.moveTo(-rx, -ry + cap);
          path.bezierCurveTo(-rx, -ry, rx, -ry, rx, -ry + cap);
          path.lineTo(rx, ry - cap);
          path.bezierCurveTo(rx, ry, -rx, ry, -rx, ry - cap);
          path.closePath();

          // The unlit silhouette and cool reflected edge remain visible over
          // both the pale mountains and the dark timber beside the opening.
          metal.save();
          metal.translate(0.35, 0.38);
          metal.strokeStyle = "rgba(5, 8, 10, .65)";
          metal.lineWidth = 1.02;
          metal.stroke(path);
          metal.restore();
          const shine = light / 5;
          const face = metal.createLinearGradient(-1, 0, 1, 0);
          face.addColorStop(0, "#20282a");
          face.addColorStop(0.23, "#3d3428");
          face.addColorStop(0.52, worn ? "#51432e" : "#6a5132");
          face.addColorStop(
            0.76,
            `rgb(${128 + shine * 56}, ${97 + shine * 48}, ${59 + shine * 35})`,
          );
          face.addColorStop(1, "#3d3328");
          metal.strokeStyle = face;
          metal.lineWidth = tube;
          metal.lineJoin = "round";
          metal.lineCap = "round";
          metal.stroke(path);

          // Broken, narrow reflections avoid the uniform yellow outline of a
          // drawn chain. Adjacent links alternate between face-on and edge-on.
          metal.beginPath();
          metal.moveTo(rx + 0.12, -ry + cap * 0.7);
          metal.lineTo(rx + 0.12, ry * (worn ? -0.05 : 0.5));
          metal.strokeStyle = `rgba(239, 205, 148, ${0.2 + shine * 0.44})`;
          metal.lineWidth = turn === 2 ? 0.29 : 0.24;
          metal.stroke();
          metal.beginPath();
          metal.moveTo(-rx - 0.1, -ry * 0.45);
          metal.lineTo(-rx - 0.1, ry * 0.4);
          metal.strokeStyle = "rgba(100, 123, 131, .26)";
          metal.lineWidth = 0.19;
          metal.stroke();
          // A contact shadow where the next link threads through this one.
          metal.beginPath();
          metal.moveTo(-rx * 0.5, ry - 0.15);
          metal.lineTo(rx * 0.55, ry - 0.15);
          metal.strokeStyle = "rgba(13, 14, 12, .74)";
          metal.lineWidth = 0.32;
          metal.stroke();
          return sprite;
        }),
      ),
    );
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    if (!width || !height) return;
    for (const strand of strands) {
      let travelled = 0;
      let nextLink = linkLength * 0.38;
      let linkNumber = 0;
      for (let j = 0; j < segmentCount; j++) {
        const a = strand.nodes[j];
        const b = strand.nodes[j + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);
        const angle = -Math.atan2(dx, dy);
        while (distance > 0 && nextLink <= travelled + distance) {
          const t = (nextLink - travelled) / distance;
          const x = a.x + dx * t;
          const y = a.y + dy * t;
          const edgeOn = (linkNumber + strand.index) % 2;
          const turn = edgeOn
            ? 2
            : (linkNumber + strand.index * 3) % 7 === 0
              ? 1
              : 0;
          const wear = (linkNumber * 7 + strand.index * 11) % 17 < 4 ? 1 : 0;
          // Sunset enters from the right. Patches of patina break up the rim
          // light without flickering or changing as the simulation advances.
          const light = clamp(
            Math.round(
              1.2 +
                (x / width) * 2.5 +
                (1 - y / height) * 0.6 +
                Math.sin(linkNumber * 0.39 + strand.phase) * 0.7,
            ),
            0,
            5,
          );
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(angle);
          ctx.drawImage(linkSprites[light][turn][wear], -6, -6, 12, 12);
          ctx.restore();
          // Interlocking links overlap; separated ellipses read as beads.
          nextLink += linkLength * 0.76;
          linkNumber++;
        }
        travelled += distance;
      }
    }
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
    gathered = parted ? 1 : restingGather;
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
    document.querySelector("#home")?.scrollIntoView({
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
