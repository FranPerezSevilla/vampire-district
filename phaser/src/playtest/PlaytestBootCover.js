const BOOT_COVER_ID = "playtest-boot-cover";
const CRITICAL_STYLE_ID = "playtest-boot-cover-critical";
let blockBootKeyDown = null;

function installCriticalStyle() {
  if (document.getElementById(CRITICAL_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = CRITICAL_STYLE_ID;
  style.textContent = `
    #${BOOT_COVER_ID} {
      position: fixed;
      inset: 0;
      z-index: 2600;
      display: grid;
      place-items: center;
      padding: 24px;
      background: #030409;
      color: #f1e6ff;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    #${BOOT_COVER_ID} .playtest-panel {
      width: min(680px, calc(100vw - 32px));
      max-height: calc(100vh - 40px);
      overflow: auto;
      padding: 30px;
      border: 1px solid rgba(215, 200, 255, .28);
      border-radius: 18px;
      background: linear-gradient(160deg, #171223, #080a12);
      box-shadow: 0 28px 90px rgba(0, 0, 0, .58);
    }
    #${BOOT_COVER_ID} h2 { margin: 0; font-size: clamp(30px, 5vw, 52px); line-height: .98; }
    #${BOOT_COVER_ID} .playtest-kicker { margin: 0 0 7px; color: #78c7a3; font-size: 12px; font-weight: 900; letter-spacing: .15em; }
    #${BOOT_COVER_ID} .playtest-lead { margin: 18px 0; color: #c9bfd7; font-size: 16px; line-height: 1.55; }
    #${BOOT_COVER_ID} .playtest-goal { display: grid; gap: 5px; margin: 22px 0; padding: 17px 18px; border-left: 4px solid #ff3b50; background: rgba(255, 59, 80, .08); }
    #${BOOT_COVER_ID} .playtest-control-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 20px 0; }
    #${BOOT_COVER_ID} .playtest-control-grid span { padding: 12px; border: 1px solid rgba(241, 230, 255, .12); border-radius: 10px; background: rgba(255, 255, 255, .04); }
    #${BOOT_COVER_ID} .playtest-note { color: #9d93b8; font-size: 13px; line-height: 1.5; }
    #${BOOT_COVER_ID} button { min-height: 42px; border: 0; border-radius: 10px; padding: 10px 16px; background: #78c7a3; color: #07120e; font: 900 13px/1 Arial, sans-serif; }
    @media (max-width: 720px) { #${BOOT_COVER_ID} .playtest-control-grid { grid-template-columns: 1fr; } }
  `;
  document.head.appendChild(style);
}

export function installPlaytestStylesheet() {
  if (typeof document === "undefined") return null;
  const existing = document.querySelector('link[data-viceblood-playtest="true"]');
  if (existing) return existing;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("../../playtest.css", import.meta.url).href;
  link.dataset.vicebloodPlaytest = "true";
  document.head.appendChild(link);
  return link;
}

function installBootInputBlocker() {
  if (blockBootKeyDown || typeof window === "undefined") return;
  blockBootKeyDown = event => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  window.addEventListener("keydown", blockBootKeyDown, true);
}

function removeBootInputBlocker() {
  if (!blockBootKeyDown || typeof window === "undefined") return;
  window.removeEventListener("keydown", blockBootKeyDown, true);
  blockBootKeyDown = null;
}

export function showPlaytestBootCover() {
  if (typeof document === "undefined" || !document.body) return null;
  installCriticalStyle();
  installPlaytestStylesheet();
  document.body.classList.add("playtest-mode", "playtest-booting");
  installBootInputBlocker();

  let cover = document.getElementById(BOOT_COVER_ID);
  if (cover) return cover;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div id="${BOOT_COVER_ID}" class="playtest-overlay open" role="dialog" aria-modal="true" aria-labelledby="playtest-boot-title" aria-busy="true">
      <section class="playtest-panel playtest-intro-panel">
        <p class="playtest-kicker">VICEBLOOD · EARLY PLAYTEST 0.1</p>
        <h2 id="playtest-boot-title">Hunt. Feed. Escape.</h2>
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
        <button type="button" disabled>Start playtest · Enter</button>
      </section>
    </div>`;
  cover = wrapper.firstElementChild;
  document.body.appendChild(cover);
  return cover;
}

export function finishPlaytestBootCover() {
  if (typeof document === "undefined") return;
  document.getElementById(BOOT_COVER_ID)?.remove();
  document.body?.classList.remove("playtest-booting");
  removeBootInputBlocker();
}

export function failPlaytestBootCover(error) {
  const cover = showPlaytestBootCover();
  if (!cover) return;
  cover.setAttribute("aria-busy", "false");
  const kicker = cover.querySelector(".playtest-kicker");
  const title = cover.querySelector("h2");
  const lead = cover.querySelector(".playtest-lead");
  const goal = cover.querySelector(".playtest-goal span");
  const button = cover.querySelector("button");
  if (kicker) kicker.textContent = "VICEBLOOD · PLAYTEST ERROR";
  if (title) title.textContent = "The night could not begin";
  if (lead) lead.textContent = "The playtest failed while preparing the city.";
  if (goal) goal.textContent = String(error?.message || error || "Unknown boot error");
  if (button) button.textContent = "Reload the page to try again";
}
