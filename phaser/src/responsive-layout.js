const DESIGN_WIDTH = 1440;
const DESIGN_HEIGHT = 960;
const MIN_FRAME_WIDTH = 360;
const MAX_FRAME_WIDTH = 1920;

function installResponsiveStyles() {
  if (document.getElementById("nbd-responsive-layout-style")) return;

  const style = document.createElement("style");
  style.id = "nbd-responsive-layout-style";
  style.textContent = `
    html,
    body {
      width: 100%;
      min-height: 100%;
      overflow-x: hidden;
    }

    .shell {
      max-width: none !important;
    }

    .game-frame,
    #game-root {
      max-width: none !important;
      min-height: 0 !important;
      aspect-ratio: auto !important;
    }

    #game-root {
      display: block !important;
    }

    #game-root canvas {
      display: block;
      width: 100% !important;
      max-width: none !important;
      height: 100% !important;
    }

    .game-ui {
      inset: 0 auto auto 0 !important;
      transform-origin: 0 0;
    }

    body.nbd-height-constrained .notes {
      display: none;
    }

    @media (max-width: 720px) {
      .shell {
        padding-top: 8px !important;
      }

      .topbar {
        margin-bottom: 7px !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function renameQualitySelector() {
  const label = document.querySelector(".resolution-control");
  const select = document.getElementById("resolution-select");
  if (!label || !select || label.dataset.responsiveCopy === "true") return;

  for (const node of label.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
      node.textContent = "Render quality ";
      break;
    }
  }

  const labels = {
    compact: "Low",
    large: "High",
    qhd: "Very high",
    ultra: "Ultra"
  };
  for (const option of select.options) option.textContent = labels[option.value] || option.textContent;
  label.dataset.responsiveCopy = "true";
}

function viewportSize() {
  const viewport = window.visualViewport;
  return {
    width: viewport?.width || window.innerWidth,
    height: viewport?.height || window.innerHeight
  };
}

function resizeGameFrame() {
  const shell = document.querySelector(".shell");
  const frame = document.querySelector(".game-frame");
  const root = document.getElementById("game-root");
  const ui = document.getElementById("game-ui");
  if (!shell || !frame || !root || !ui) return;

  const viewport = viewportSize();
  const frameTop = frame.getBoundingClientRect().top;
  const notes = document.querySelector(".notes");
  const notesHeight = notes && getComputedStyle(notes).display !== "none" ? notes.offsetHeight + 14 : 0;
  const widthAllowance = Math.max(MIN_FRAME_WIDTH, viewport.width - 24);
  const availableHeight = Math.max(240, viewport.height - frameTop - notesHeight - 12);
  const widthFromHeight = availableHeight * (DESIGN_WIDTH / DESIGN_HEIGHT);
  const frameWidth = Math.max(
    Math.min(MIN_FRAME_WIDTH, widthAllowance),
    Math.min(MAX_FRAME_WIDTH, widthAllowance, widthFromHeight)
  );
  const frameHeight = frameWidth * (DESIGN_HEIGHT / DESIGN_WIDTH);
  const heightConstrained = widthFromHeight + 3 < widthAllowance;

  document.body.classList.toggle("nbd-height-constrained", heightConstrained && viewport.height < 860);
  document.documentElement.style.setProperty("--game-width", `${Math.round(frameWidth)}px`);
  document.documentElement.style.setProperty("--game-height", `${Math.round(frameHeight)}px`);
  document.documentElement.style.setProperty("--game-ui-scale", String(frameWidth / DESIGN_WIDTH));

  shell.style.width = `${Math.round(frameWidth)}px`;
  frame.style.width = `${Math.round(frameWidth)}px`;
  frame.style.height = `${Math.round(frameHeight)}px`;
  root.style.width = "100%";
  root.style.height = "100%";

  ui.style.width = `${DESIGN_WIDTH}px`;
  ui.style.height = `${DESIGN_HEIGHT}px`;
  ui.style.transform = `scale(${frameWidth / DESIGN_WIDTH})`;
}

function installResponsiveLayout() {
  installResponsiveStyles();
  renameQualitySelector();
  resizeGameFrame();

  let resizeFrame = 0;
  const scheduleResize = () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(resizeGameFrame);
  };

  window.addEventListener("resize", scheduleResize, { passive: true });
  window.addEventListener("orientationchange", scheduleResize, { passive: true });
  window.visualViewport?.addEventListener("resize", scheduleResize, { passive: true });

  const observer = new ResizeObserver(scheduleResize);
  const topbar = document.querySelector(".topbar");
  const notes = document.querySelector(".notes");
  if (topbar) observer.observe(topbar);
  if (notes) observer.observe(notes);
}

installResponsiveLayout();
