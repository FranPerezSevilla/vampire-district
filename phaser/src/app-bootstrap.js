const PHASER_VERSION = "3.90.0";
const query = new URLSearchParams(window.location.search);

window.NBD_RC_TEST_MODE = query.get("rcTest") === "1";
window.NBD_APP_READY = false;

function scriptSourceCandidates() {
  return [
    {
      id: "local",
      url: new URL("../../node_modules/phaser/dist/phaser.min.js", import.meta.url).href
    },
    {
      id: "jsdelivr",
      url: `https://cdn.jsdelivr.net/npm/phaser@${PHASER_VERSION}/dist/phaser.min.js`
    },
    {
      id: "cdnjs",
      url: `https://cdnjs.cloudflare.com/ajax/libs/phaser/${PHASER_VERSION}/phaser.min.js`
    }
  ];
}

function loadScript(candidate, timeoutMs = 12_000) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    let settled = false;
    const timeout = window.setTimeout(() => finish(new Error(`Timed out loading ${candidate.id}`)), timeoutMs);

    const finish = error => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      script.onload = null;
      script.onerror = null;
      if (error) {
        script.remove();
        reject(error);
      } else {
        resolve();
      }
    };

    script.src = candidate.url;
    script.async = true;
    script.dataset.nbdPhaserSource = candidate.id;
    script.onload = () => {
      if (!window.Phaser) {
        finish(new Error(`${candidate.id} loaded without exposing Phaser`));
        return;
      }
      window.NBD_PHASER_SOURCE = candidate.id;
      finish();
    };
    script.onerror = () => finish(new Error(`Failed to load ${candidate.id}`));
    document.head.appendChild(script);
  });
}

async function ensurePhaser() {
  if (window.Phaser) {
    window.NBD_PHASER_SOURCE ||= "preloaded";
    return;
  }

  const errors = [];
  for (const candidate of scriptSourceCandidates()) {
    try {
      await loadScript(candidate);
      return;
    } catch (error) {
      errors.push(`${candidate.id}: ${error.message}`);
    }
  }

  throw new Error(`Unable to load Phaser ${PHASER_VERSION}. ${errors.join(" · ")}`);
}

function showFatalError(error) {
  console.error(error);
  const root = document.getElementById("game-root") || document.body;
  const message = document.createElement("div");
  message.setAttribute("role", "alert");
  message.style.cssText = "padding:24px;background:#210813;color:#ffe4eb;font:700 16px/1.45 system-ui,sans-serif;border:1px solid #ff526b";
  message.textContent = `Vampire District could not start: ${error.message}`;
  root.replaceChildren(message);
}

try {
  await ensurePhaser();
  await import("./main.js");
  await import("./ui/AccessibilityKeyboardBridge.js");
  await import("./responsive-layout.js");
  await import("./tutorial/bootstrap.js");
  if (window.NBD_RC_TEST_MODE) await import("./testing/bootstrap.js");
  window.NBD_APP_READY = true;
  window.dispatchEvent(new CustomEvent("nbd:app-ready", {
    detail: {
      phaserVersion: PHASER_VERSION,
      source: window.NBD_PHASER_SOURCE,
      rcTestMode: window.NBD_RC_TEST_MODE
    }
  }));
} catch (error) {
  showFatalError(error);
  throw error;
}
