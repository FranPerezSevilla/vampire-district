import { formatPlaytestDuration } from "./PlaytestSessionModel.js";
import { PlaytestFeedback } from "./PlaytestFeedback.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resultStatsMarkup(result) {
  const stats = result?.stats || {};
  return [
    ["Time", stats.time || "00:00"],
    ["Hunger remaining", `${stats.hunger ?? "--"}%`],
    ["Victims fed upon", stats.feedCount ?? 0],
    ["Quick Bites", stats.quickBites ?? 0],
    ["Full Feeds", stats.fullFeeds ?? 0],
    ["Drains", stats.drains ?? 0],
    ["Maximum Police Heat", stats.maxHeatLevel ?? 0],
    ["Maximum Exposure", stats.maxExposure ?? 0],
    ["Witness reports", stats.witnessReports ?? 0],
    ["Vehicle used", stats.vehicleUsed ? "Yes" : "No"],
    ["Rooftop / sewer route", stats.alternateRouteUsed ? "Yes" : "No"]
  ].map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
}

export class PlaytestUi {
  constructor(session, gameScene) {
    this.session = session;
    this.gameScene = gameScene;
    this.resultShown = false;
    this.mount();
    this.feedback = new PlaytestFeedback(session, gameScene);
    this.unsubscribe = session.subscribe((snapshot, result) => this.render(snapshot, result));
    this.pauseForIntro();
    this.bind();
    this.render(session.snapshot(), session.result());
  }

  mount() {
    document.body.classList.add("playtest-mode");
    const eyebrow = document.querySelector(".topbar .eyebrow");
    if (eyebrow) eyebrow.textContent = "Public playtest · Hunt, Feed, Escape";

    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <div id="playtest-intro" class="playtest-overlay open" role="dialog" aria-modal="true" aria-labelledby="playtest-intro-title">
        <section class="playtest-panel playtest-intro-panel">
          <p class="playtest-kicker">VICEBLOOD · EARLY PLAYTEST 0.1</p>
          <h2 id="playtest-intro-title">Hunt. Feed. Escape.</h2>
          <p class="playtest-lead">You are starving. Find prey, decide how far to feed, survive the city’s response and return to the refuge.</p>
          <div class="playtest-goal">
            <strong>Your goal</strong>
            <span>Lower Hunger to 25% or less, lose police pursuit and return safely within 15 minutes.</span>
          </div>
          <div class="playtest-control-grid" aria-label="Essential controls">
            <span><kbd>WASD</kbd> Move</span>
            <span><kbd>F</kbd> Blood Sense</span>
            <span><kbd>RMB</kbd> Hold to feed</span>
            <span><kbd>ENTER</kbd> Vehicle</span>
          </div>
          <p class="playtest-note">Early browser build. Art and audio are unfinished. The test is about whether the hunt–feed–escape loop is understandable and fun.</p>
          <button id="playtest-start" class="playtest-primary" type="button">Start playtest · Enter</button>
        </section>
      </div>
      <aside id="playtest-objective" class="playtest-objective" aria-live="polite">
        <div class="playtest-objective-top"><span>NEXT MOVE</span><strong id="playtest-step">1/3</strong></div>
        <h2 id="playtest-objective-title">Find prey and feed</h2>
        <p id="playtest-objective-hint"></p>
        <time id="playtest-timer">15:00</time>
      </aside>
      <div id="playtest-result" class="playtest-overlay" aria-hidden="true">
        <section class="playtest-panel playtest-result-panel" role="dialog" aria-modal="true" aria-labelledby="playtest-result-title">
          <p class="playtest-kicker">PLAYTEST COMPLETE</p>
          <h2 id="playtest-result-title">Night survived</h2>
          <p id="playtest-result-subtitle" class="playtest-lead"></p>
          <div id="playtest-result-stats" class="playtest-result-stats"></div>
          <div class="playtest-result-actions">
            <button id="playtest-restart" class="playtest-primary" type="button">Play again · Enter</button>
            <button id="playtest-result-feedback" class="playtest-secondary" type="button">Send feedback</button>
          </div>
        </section>
      </div>`;
    while (wrapper.firstElementChild) document.body.appendChild(wrapper.firstElementChild);

    this.intro = document.getElementById("playtest-intro");
    this.startButton = document.getElementById("playtest-start");
    this.objective = document.getElementById("playtest-objective");
    this.step = document.getElementById("playtest-step");
    this.objectiveTitle = document.getElementById("playtest-objective-title");
    this.objectiveHint = document.getElementById("playtest-objective-hint");
    this.timer = document.getElementById("playtest-timer");
    this.resultOverlay = document.getElementById("playtest-result");
    this.resultTitle = document.getElementById("playtest-result-title");
    this.resultSubtitle = document.getElementById("playtest-result-subtitle");
    this.resultStats = document.getElementById("playtest-result-stats");
    this.restartButton = document.getElementById("playtest-restart");
    this.feedbackButton = document.getElementById("playtest-result-feedback");

    const missionButton = document.getElementById("hud-mission-button");
    const missionLabel = missionButton?.querySelector?.("span");
    if (missionLabel) missionLabel.textContent = "PLAYTEST";
    const drawerKicker = document.querySelector("#mission-drawer .drawer-kicker");
    const drawerTitle = document.querySelector("#mission-drawer h2");
    if (drawerKicker) drawerKicker.textContent = "RUN OBJECTIVE";
    if (drawerTitle) drawerTitle.textContent = "Hunt, Feed, Escape";
  }

  pauseForIntro() {
    if (this.gameScene?.sys?.isActive?.()) this.gameScene.scene.pause();
  }

  bind() {
    this.startButton?.addEventListener("click", () => this.start());
    this.restartButton?.addEventListener("click", () => this.session.restart());
    this.feedbackButton?.addEventListener("click", () => this.feedback.open("result"));
    this.onKeyDown = event => {
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(String(event.target?.tagName || "").toUpperCase());
      if (typing || event.repeat) return;
      if (event.code === "Enter" && this.intro?.classList.contains("open")) {
        event.preventDefault();
        this.start();
      } else if (event.code === "Enter" && this.resultOverlay?.classList.contains("open") && !this.feedback.opened) {
        event.preventDefault();
        this.session.restart();
      }
    };
    window.addEventListener("keydown", this.onKeyDown, true);
  }

  start() {
    if (!this.intro?.classList.contains("open")) return;
    this.intro.classList.remove("open");
    this.intro.setAttribute("aria-hidden", "true");
    this.session.start();
    this.gameScene?.scene?.resume?.();
    this.objective?.classList.add("open");
  }

  render(snapshot, result = null) {
    if (!snapshot) return;
    const objective = snapshot.objectives[snapshot.objectiveIndex] || snapshot.objectives.at(-1);
    const step = snapshot.status === "complete" ? "DONE" : snapshot.status === "failed" ? "FAIL" : `${snapshot.objectiveIndex + 1}/3`;
    if (this.step) this.step.textContent = step;
    if (this.objectiveTitle) this.objectiveTitle.textContent = snapshot.objectiveText || objective?.label || snapshot.title;
    if (this.objectiveHint) this.objectiveHint.textContent = objective?.hint || "";
    if (this.timer) this.timer.textContent = formatPlaytestDuration(snapshot.timeRemainingSeconds);
    this.objective?.classList.toggle("danger", snapshot.timeRemainingSeconds <= 120);

    const missionCurrent = document.getElementById("mission-current");
    const missionLast = document.getElementById("mission-last");
    const missionStep = document.getElementById("hud-mission-step");
    const checklist = document.getElementById("mission-checklist");
    if (missionCurrent) missionCurrent.textContent = snapshot.objectiveText;
    if (missionLast) missionLast.textContent = `Time left: ${formatPlaytestDuration(snapshot.timeRemainingSeconds)}`;
    if (missionStep) missionStep.textContent = step;
    if (checklist) {
      checklist.innerHTML = snapshot.objectives.map(item => {
        const icon = item.state === "done" ? "✓" : item.state === "active" ? "▸" : item.state === "failed" ? "×" : "○";
        return `<li class="${escapeHtml(item.state)}">${icon} ${escapeHtml(item.label)}</li>`;
      }).join("");
    }

    if (result && !this.resultShown) this.showResult(result);
  }

  showResult(result) {
    this.resultShown = true;
    this.objective?.classList.remove("open");
    this.gameScene?.scene?.pause?.();
    if (this.resultTitle) this.resultTitle.textContent = result.title;
    if (this.resultSubtitle) this.resultSubtitle.textContent = result.subtitle;
    if (this.resultStats) this.resultStats.innerHTML = resultStatsMarkup(result);
    this.resultOverlay?.classList.add("open");
    this.resultOverlay?.setAttribute("aria-hidden", "false");
    window.requestAnimationFrame?.(() => this.feedbackButton?.focus?.());
  }

  destroy() {
    window.removeEventListener("keydown", this.onKeyDown, true);
    this.unsubscribe?.();
    this.feedback?.destroy?.();
    this.intro?.remove?.();
    this.objective?.remove?.();
    this.resultOverlay?.remove?.();
    document.body.classList.remove("playtest-mode");
  }
}
