import { initCurtain } from "./curtain.js";

// Keep the photograph and chain overlay in one coordinate space when the
// full-bleed scene is cropped for different screens.
const viewport = document.querySelector(".hero-visual");
const scene = document.querySelector(".scene-art");
const photograph = document.querySelector(".gate-photo");
const mobile = matchMedia("(max-width: 860px)");
function positionScene() {
  const bounds = viewport.getBoundingClientRect();
  const imageWidth =
    photograph.naturalWidth || Number(photograph.getAttribute("width"));
  const imageHeight =
    photograph.naturalHeight || Number(photograph.getAttribute("height"));
  const scale = Math.max(
    bounds.width / imageWidth,
    bounds.height / imageHeight,
  );
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  const left = mobile.matches
    ? bounds.width * 0.5 - width * 0.668
    : (bounds.width - width) / 2 + Math.max(0, 1100 - bounds.width) * 0.3;
  Object.assign(scene.style, {
    width: `${width}px`,
    height: `${height}px`,
    left: `${left}px`,
    top: `${(bounds.height - height) / 2}px`,
  });
}
new ResizeObserver(positionScene).observe(viewport);
photograph.addEventListener("load", positionScene);
mobile.addEventListener("change", positionScene);
positionScene();
initCurtain();

// Draw directional icons as vectors so they remain available without system symbol fonts.
const arrow =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg>';
document
  .querySelectorAll("nav a span,.primary-link span,.project-info button span")
  .forEach((el) => (el.innerHTML = arrow));
const contact = document.querySelector("footer a");
contact.innerHTML = "Let’s open a conversation. " + arrow;
document.querySelectorAll(".small-star,.project-art>span").forEach((el) => {
  el.innerHTML =
    '<svg viewBox="0 0 32 32" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M16 2v28M2 16h28M6 6l20 20M6 26 26 6"/></svg>';
  el.style.color = "var(--brass)";
});
