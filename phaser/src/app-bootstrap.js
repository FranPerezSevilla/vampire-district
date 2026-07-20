const PHASER_VERSION = "3.90.0";
const PHASER_SCRIPT_SOURCES = Object.freeze([
  Object.freeze({
    kind: "local",
    src: "./vendor/phaser-3.90.0.min.js"
  }),
  Object.freeze({
    kind: "jsdelivr",
    src: `https://cdn.jsdelivr.net/npm/phaser@${PHASER_VERSION}/dist/phaser.min.js`
  }),
  Object.freeze({
    kind: "unpkg",
    src: `https://unpkg.com/phaser@${PHASER_VERSION}/dist/phaser.min.js`
  })
]);

function loadScript(source) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-nbd-phaser="${source.kind}"]`);
    if (existing) {
      if (window.Phaser) {
        resolve(source);
        return;
      }
      existing.addEventListener("load", () => resolve(source), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Unable to load ${source.src}`)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = source.src;
    script.async = false;
    script.dataset.nbdPhaser = source.kind;
    script.addEventListener("load", () => resolve(source), { once: true });
    script.addEventListener("error", () => reject(new Error(`Unable to load ${source.src}`)), { once: true });
    document.head.appendChild(script);
  });
}

async function ensurePhaser() {
  if (window.Phaser) return { kind: "existing", version: window.Phaser.VERSION || "unknown" };

  let lastError = null;
  for (const source of PHASER_SCRIPT_SOURCES) {
    try {
      await loadScript(source);
      if (window.Phaser) {
        window.NBD_PHASER_SOURCE = Object.freeze({
          kind: source.kind,
          src: source.src,
          version: window.Phaser.VERSION || PHASER_VERSION
        });
        return window.NBD_PHASER_SOURCE;
      }
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Phaser could not be loaded.");
}

function renderBootFailure(error) {
  console.error("Vampire District failed to boot", error);
  const root = document.getElementById("game-root");
  if (!root) return;
  root.innerHTML = `
    <div style="display:grid;place-items:center;min-height:320px;padding:32px;text-align:center;background:#090a12;color:#f4ecff;border:1px solid #513c65">
      <div>
        <strong style="display:block;margin-bottom:10px;color:#ffb02e">Vampire District could not start</strong>
        <span style="font-size:13px;line-height:1.5;color:#c9bfd7">${String(error?.message || error || "Unknown boot error")}</span>
      </div>
    </div>
  `;
}

try {
  await ensurePhaser();
  await import("./campaign/preload.js");
  await import("./main.js");
  await import("./ui/AccessibilityKeyboardBridge.js");
  await import("./responsive-layout.js");
  await import("./campaign/bootstrap.js");
  await import("./tutorial/bootstrap.js");
  if (new URLSearchParams(window.location.search).has("rcTest")) {
    await import("./testing/bootstrap.js");
  }
  window.NBD_APP_READY = true;
  window.dispatchEvent(new CustomEvent("nbd:app-ready", {
    detail: {
      phaser: window.NBD_PHASER_SOURCE || {
        kind: "existing",
        version: window.Phaser?.VERSION || PHASER_VERSION
      },
      campaign: true
    }
  }));
} catch (error) {
  window.NBD_APP_READY = false;
  window.NBD_APP_ERROR = error;
  renderBootFailure(error);
}
