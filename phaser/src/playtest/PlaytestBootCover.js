const BOOT_COVER_ID = "playtest-boot-cover";
const CRITICAL_STYLE_ID = "playtest-boot-cover-critical";
const GLOBAL_BLOCKER_KEY = "__NBD_PLAYTEST_BOOT_KEY_BLOCKER__";

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
      box-sizing: border-box;
      overflow: auto;
      padding: 30px;
      border: 1px solid rgba(215, 200, 255, .28);
      border-radius: 18px;
      background: linear-gradient(160deg, #171223, #080a12);
      box-shadow: 0 28px 90px rgba(0, 0, 0, .58);
      text-align: left;
    }
    #${BOOT_COVER_ID} h2 {
      max-width: 610px;
      margin: 0;
      font-size: clamp(34px, 4.15vw, 48px);
      line-height: 1.02;
      letter-spacing: -.025em;
    }
    #${BOOT_COVER_ID} .playtest-kicker {
      margin: 0 0 10px;
      color: #78c7a3;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: .15em;
    }
    #${BOOT_COVER_ID} .playtest-character-line {
      max-width: 590px;
      margin: 18px 0 0;
      border: 0;
      padding: 0;
      color: #d8cfdf;
      font-size: 16px;
      line-height: 1.55;
      font-style: normal;
    }
    #${BOOT_COVER_ID} .playtest-story-goal {
      margin: 18px 0 0;
      color: #f1e6ff;
      font-size: 16px;
      line-height: 1.5;
    }
    #${BOOT_COVER_ID} .playtest-story-controls {
      margin: 14px 0 0;
      color: #c9bfd7;
      font-size: 14px;
      line-height: 1.5;
    }
    #${BOOT_COVER_ID} kbd {
      padding: 3px 7px;
      border: 1px solid rgba(241, 230, 255, .28);
      border-radius: 5px;
      background: #05060b;
      color: #f1e6ff;
      font: 800 11px/1.2 Arial, sans-serif;
    }
    #${BOOT_COVER_ID} button {
      min-height: 42px;
      margin-top: 16px;
      border: 0;
      border-radius: 10px;
      padding: 10px 16px;
      background: #78c7a3;
      color: #07120e;
      font: 900 13px/1 Arial, sans-serif;
      opacity: .78;
    }
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
  if (typeof window === "undefined") return;
  if (window[GLOBAL_BLOCKER_KEY]) return;
  const blocker = event => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  window[GLOBAL_BLOCKER_KEY] = blocker;
  window.addEventListener("keydown", blocker, true);
}

function removeBootInputBlocker() {
  if (typeof window === "undefined") return;
  const blocker = window[GLOBAL_BLOCKER_KEY];
  if (!blocker) return;
  window.removeEventListener("keydown", blocker, true);
  delete window[GLOBAL_BLOCKER_KEY];
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
      <section class="playtest-panel playtest-intro-panel playtest-story-intro">
        <p class="playtest-kicker">VICEBLOOD · ONE MORE NIGHT</p>
        <h2 id="playtest-boot-title">Immortality was never<br>the luxury you imagined.</h2>
        <p class="playtest-character-line">You were turned into a vampire decades ago. Since then, clan wars and keeping the Veil hidden from humanity have defined every night of your existence.</p>
        <p class="playtest-story-goal">Tonight, hunger comes first. Feed, lose the police, and return to the refuge.</p>
        <p class="playtest-story-controls"><kbd>WASD</kbd> move · <kbd>RMB</kbd> feed · <kbd>F</kbd> Blood Sense</p>
        <button type="button" disabled>Preparing the city…</button>
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
  const lead = cover.querySelector(".playtest-character-line");
  const goal = cover.querySelector(".playtest-story-goal");
  const button = cover.querySelector("button");
  if (kicker) kicker.textContent = "VICEBLOOD · PLAYTEST ERROR";
  if (title) title.textContent = "The night could not begin";
  if (lead) lead.textContent = "The playtest failed while preparing the city.";
  if (goal) goal.textContent = String(error?.message || error || "Unknown boot error");
  if (button) button.textContent = "Reload the page to try again";
}
