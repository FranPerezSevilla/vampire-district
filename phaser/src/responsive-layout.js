// The DOM viewport is authoritative. Only the world canvas uses cover/crop.
// Never assign a logical resolution or a scale transform to the UI tree.
export function coverSize(width, height, renderWidth, renderHeight) {
  const ratio = renderWidth > 0 && renderHeight > 0 ? renderWidth / renderHeight : 1.5;
  const w = Math.max(width, height * ratio), h = w / ratio;
  return { width: w, height: h, left: (width - w) / 2, top: (height - h) / 2 };
}
export function installResponsiveLayout(documentRef = globalThis.document, windowRef = globalThis.window) {
  const app = documentRef?.getElementById("viceblood-app"), host = documentRef?.getElementById("game-root");
  if (!app || !host || !windowRef) return () => {};
  let scheduled = 0;
  const resize = () => {
    scheduled = 0;
    const canvas = host.querySelector("canvas");
    if (!canvas) return;
    const rect = app.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0)) return;
    const scale = windowRef.NBD_PHASER_GAME?.scale;
    const gameSize = scale?.gameSize;
    const layout = coverSize(rect.width, rect.height, gameSize?.width || canvas.width, gameSize?.height || canvas.height);
    for (const name of ["width", "height", "left", "top"]) canvas.style[name] = `${layout[name]}px`;
    canvas.style.margin = "0";
    canvas.style.transform = "none";
    // CSS cover changes are outside ScaleManager.refresh. Synchronize its input
    // conversion AFTER writing styles, without letting it restyle/center the UI.
    scale?.updateBounds?.();
    const inputWidth = scale?.baseSize?.width || gameSize?.width || canvas.width;
    const inputHeight = scale?.baseSize?.height || gameSize?.height || canvas.height;
    scale?.displayScale?.set?.(inputWidth / layout.width, inputHeight / layout.height);
    windowRef.NBD_VIEWPORT_LAYOUT = Object.freeze({ width: rect.width, height: rect.height, canvas: layout, uiScale: 1, devicePixelRatio: windowRef.devicePixelRatio || 1, textSize: windowRef.getComputedStyle?.(app)?.fontSize || null });
  };
  const schedule = () => { if (!scheduled) scheduled = windowRef.requestAnimationFrame(resize); };
  const observer = windowRef.ResizeObserver ? new windowRef.ResizeObserver(schedule) : null;
  observer?.observe(app);
  const mutation = windowRef.MutationObserver ? new windowRef.MutationObserver(schedule) : null;
  mutation?.observe(host, { childList: true });
  windowRef.addEventListener("resize", schedule);
  windowRef.addEventListener("nbd:app-ready", schedule);
  windowRef.visualViewport?.addEventListener("resize", schedule);
  schedule();
  return () => { observer?.disconnect(); mutation?.disconnect(); windowRef.removeEventListener("resize", schedule); windowRef.removeEventListener("nbd:app-ready", schedule); windowRef.visualViewport?.removeEventListener("resize", schedule); if (scheduled) windowRef.cancelAnimationFrame(scheduled); };
}
if (typeof document !== "undefined") installResponsiveLayout();
