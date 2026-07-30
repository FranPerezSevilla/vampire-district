const ENDPOINT = "https://script.google.com/macros/s/AKfycbx2bwgRkz2kA1l19wOnLQ-A0nFuVYC3gQhHssH79NYMFLpNWOD4kEXMREhFp5s9mNJ44g/exec";
const STORAGE_KEY = "viceblood-playtest-feedback-queue";
const BUILD_VERSION = "playtest-0.1-hunt-feed-escape";

function clean(value) {
  return String(value ?? "").trim();
}

export function buildPlaytestFeedbackPayload({ values = {}, session = null, result = null, client = {} } = {}) {
  const sessionSnapshot = session && typeof session === "object" ? session : {};
  const resultSnapshot = result && typeof result === "object" ? result : null;
  const metrics = sessionSnapshot.metrics || {};
  const current = sessionSnapshot.current || {};
  const understood = clean(values.understood);
  const systemsClarity = clean(values.systemsClarity);
  const playAgain = clean(values.playAgain);
  const extra = clean(values.extra);
  const missing = [
    understood ? `Objective understood: ${understood}` : "",
    systemsClarity ? `Systems clarity: ${systemsClarity}` : "",
    playAgain ? `Would play again: ${playAgain}` : "",
    extra ? `Extra: ${extra}` : ""
  ].filter(Boolean).join(" · ");

  const legacySnapshot = {
    buildVersion: BUILD_VERSION,
    missionVerdict: clean(resultSnapshot?.status || sessionSnapshot.status),
    exposure: Math.round(Number(metrics.maxExposure) || 0),
    hunger: Math.round(Number(metrics.finalHunger) || 0),
    objective: clean(sessionSnapshot.objectiveText),
    layer: Number.isFinite(Number(current.layer)) ? Number(current.layer) : "",
    visibility: clean(client.visibility),
    lastMessage: extra,
    timePlayedSeconds: Math.max(0, Math.round(Number(sessionSnapshot.elapsedSeconds) || 0)),
    pageUrl: clean(client.pageUrl),
    userAgent: clean(client.userAgent),
    viewport: clean(client.viewport),
    timestampClient: clean(client.timestamp)
  };

  return {
    schemaVersion: 2,
    buildVersion: BUILD_VERSION,
    reason: clean(values.reason || client.reason || "manual"),
    rating: Number(values.rating) || 0,

    // Compatibility fields consumed by the existing Google Apps Script sheet.
    liked: clean(values.mostFun),
    disliked: clean(values.frustration),
    missing,
    playerName: clean(values.playerName),
    snapshot: legacySnapshot,

    // Structured fields retained for a future collector migration.
    understood,
    mostFun: clean(values.mostFun),
    frustration: clean(values.frustration),
    systemsClarity,
    playAgain,
    extra,
    session: sessionSnapshot,
    result: resultSnapshot,
    client: { ...client }
  };
}

function queuedFeedback() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function queueFeedback(payload) {
  try {
    const next = [...queuedFeedback(), payload].slice(-50);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Feedback still remains visible in the form when storage is unavailable.
  }
}

export class PlaytestFeedback {
  constructor(session, gameScene) {
    this.session = session;
    this.gameScene = gameScene;
    this.opened = false;
    this.wasGamePaused = false;
    this.mount();
    this.bind();
    window.NBD_PLAYTEST_FEEDBACK = Object.freeze({
      open: reason => this.open(reason),
      close: () => this.close()
    });
  }

  mount() {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <button id="playtest-feedback-fab" class="playtest-feedback-fab" type="button">Feedback <kbd>P</kbd></button>
      <div id="playtest-feedback-overlay" class="playtest-overlay playtest-feedback-overlay" aria-hidden="true">
        <section class="playtest-panel playtest-feedback-panel" role="dialog" aria-modal="true" aria-labelledby="playtest-feedback-title">
          <header class="playtest-panel-header">
            <div>
              <p>EARLY PLAYTEST</p>
              <h2 id="playtest-feedback-title">Tell me how the loop felt</h2>
            </div>
            <button class="playtest-close" type="button" data-feedback-close aria-label="Close feedback">×</button>
          </header>
          <form id="playtest-feedback-form" class="playtest-feedback-form">
            <fieldset>
              <legend>How fun was this run?</legend>
              <div class="playtest-rating" role="radiogroup" aria-label="Fun rating from one to five">
                ${[1, 2, 3, 4, 5].map(value => `<label><input type="radio" name="rating" value="${value}" required><span>${value}</span></label>`).join("")}
              </div>
            </fieldset>
            <label>Did you understand what to do?
              <select name="understood" required>
                <option value="">Choose one</option>
                <option value="yes">Yes</option>
                <option value="mostly">Mostly</option>
                <option value="no">No</option>
              </select>
            </label>
            <label>What was the most fun?
              <textarea name="mostFun" rows="3" maxlength="1200" placeholder="Feeding, driving, escaping, powers, something else..."></textarea>
            </label>
            <label>Where did you feel lost or frustrated?
              <textarea name="frustration" rows="3" maxlength="1200" placeholder="Controls, objective, police, readability, bugs..."></textarea>
            </label>
            <label>Were Hunger, Police Heat and Exposure understandable?
              <select name="systemsClarity" required>
                <option value="">Choose one</option>
                <option value="clear">Clear</option>
                <option value="mixed">Partly clear</option>
                <option value="unclear">Unclear</option>
              </select>
            </label>
            <label>Would you play another run or a longer version?
              <select name="playAgain" required>
                <option value="">Choose one</option>
                <option value="yes">Yes</option>
                <option value="maybe">Maybe</option>
                <option value="no">No</option>
              </select>
            </label>
            <label>Name / handle <span>(optional)</span>
              <input type="text" name="playerName" maxlength="120" autocomplete="off">
            </label>
            <label>Bug or extra comment <span>(optional)</span>
              <textarea name="extra" rows="3" maxlength="1600"></textarea>
            </label>
            <p class="playtest-feedback-privacy">A technical snapshot of this run and browser is included. Name or handle is optional.</p>
            <div class="playtest-feedback-actions">
              <button class="playtest-primary" type="submit">Send feedback</button>
              <button class="playtest-secondary" type="button" data-feedback-close>Not now</button>
            </div>
            <p id="playtest-feedback-status" class="playtest-feedback-status" role="status" aria-live="polite"></p>
          </form>
        </section>
      </div>`;
    while (wrapper.firstElementChild) document.body.appendChild(wrapper.firstElementChild);
    this.fab = document.getElementById("playtest-feedback-fab");
    this.overlay = document.getElementById("playtest-feedback-overlay");
    this.form = document.getElementById("playtest-feedback-form");
    this.status = document.getElementById("playtest-feedback-status");
  }

  bind() {
    this.fab?.addEventListener("click", () => this.open("button"));
    this.overlay?.querySelectorAll?.("[data-feedback-close]").forEach(button => {
      button.addEventListener("click", () => this.close());
    });
    this.overlay?.addEventListener("pointerdown", event => {
      if (event.target === this.overlay) this.close();
    });
    this.form?.addEventListener("submit", event => {
      event.preventDefault();
      void this.submit();
    });
    this.onKeyDown = event => {
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(String(event.target?.tagName || "").toUpperCase());
      if (!typing && event.code === "KeyP") {
        event.preventDefault();
        this.opened ? this.close() : this.open("hotkey");
      } else if (event.code === "Escape" && this.opened) {
        event.preventDefault();
        this.close();
      }
    };
    window.addEventListener("keydown", this.onKeyDown, true);
  }

  open(reason = "manual") {
    if (this.opened) return;
    this.opened = true;
    this.reason = reason;
    this.wasGamePaused = Boolean(this.gameScene?.sys?.isPaused?.());
    if (!this.wasGamePaused && this.gameScene?.sys?.isActive?.()) this.gameScene.scene.pause();
    this.overlay?.classList.add("open");
    this.overlay?.setAttribute("aria-hidden", "false");
    window.requestAnimationFrame?.(() => this.form?.querySelector("input, select, textarea")?.focus?.());
  }

  close() {
    if (!this.opened) return;
    this.opened = false;
    this.overlay?.classList.remove("open");
    this.overlay?.setAttribute("aria-hidden", "true");
    if (!this.wasGamePaused && this.session.snapshot().status === "active") this.gameScene?.scene?.resume?.();
  }

  payload() {
    const values = Object.fromEntries(new FormData(this.form).entries());
    return buildPlaytestFeedbackPayload({
      values: {
        ...values,
        reason: this.reason || "manual"
      },
      session: this.session.snapshot(),
      result: this.session.result(),
      client: {
        reason: this.reason || "manual",
        pageUrl: window.location.href,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      }
    });
  }

  async submit() {
    if (!this.form?.reportValidity?.()) return;
    const payload = this.payload();
    this.setStatus("Sending…");
    try {
      await fetch(ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });
      this.setStatus("Feedback sent. Thank you.", "ok");
      this.form.reset();
    } catch (error) {
      queueFeedback(payload);
      this.setStatus("The network request failed. A local backup was saved in this browser.", "warn");
      console.warn("Viceblood playtest feedback submission failed", error);
    }
  }

  setStatus(message, kind = "") {
    if (!this.status) return;
    this.status.className = `playtest-feedback-status ${kind}`.trim();
    this.status.textContent = message;
  }

  destroy() {
    window.removeEventListener("keydown", this.onKeyDown, true);
    this.fab?.remove?.();
    this.overlay?.remove?.();
    if (window.NBD_PLAYTEST_FEEDBACK) delete window.NBD_PLAYTEST_FEEDBACK;
  }
}
