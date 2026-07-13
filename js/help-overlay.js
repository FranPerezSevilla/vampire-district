(() => {
  "use strict";

  let overlay;
  let closeButton;
  let isOpen = false;
  let autoOpenedAfterStart = false;

  function make(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key === "html") node.innerHTML = value;
      else node.setAttribute(key, value);
    }
    for (const child of children) node.appendChild(child);
    return node;
  }

  function setPaused(paused) {
    window.VD_HELP_OPEN = Boolean(paused);
    window.VD_GAME_PAUSED = Boolean(paused || window.VD_FEEDBACK_OPEN);
  }

  function gameHasStarted() {
    const startOverlay = document.getElementById("startOverlay");
    return !startOverlay || startOverlay.classList.contains("hidden");
  }

  function openHelp(reason = "manual") {
    if (!overlay || isOpen || !gameHasStarted()) return;
    isOpen = true;
    overlay.dataset.reason = reason;
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    setPaused(true);
    setTimeout(() => closeButton && closeButton.focus(), 0);
  }

  function hideHelpOnly() {
    if (!overlay) return;
    isOpen = false;
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    setPaused(false);
  }

  function toggleGameHelpAndClose() {
    // The legacy canvas help is still controlled by the game with H.
    // Send H once so the hidden canvas overlay is closed in sync with this DOM panel.
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "h", bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "h", bubbles: true }));
    requestAnimationFrame(hideHelpOnly);
  }

  function createHelpOverlay() {
    overlay = make("div", { id: "vdHelpOverlay", class: "vd-help-overlay hidden", "aria-hidden": "true" }, [
      make("section", { class: "vd-help-panel", role: "dialog", "aria-modal": "true", "aria-labelledby": "vdHelpTitle" }, [
        make("header", { class: "vd-help-head" }, [
          make("div", {}, [
            make("p", { class: "vd-help-eyebrow", text: "Quick read" }),
            make("h2", { id: "vdHelpTitle", class: "vd-help-title", text: "How to survive the district" })
          ]),
          make("button", { class: "vd-help-close", type: "button", text: "Close · H / Esc", "aria-label": "Close help" })
        ]),
        make("div", { class: "vd-help-body" }, [
          make("div", { class: "vd-help-grid" }, [
            make("article", { class: "vd-help-card" }, [
              make("h3", { text: "Read the street" }),
              make("ul", { class: "vd-help-list" }, [
                make("li", { html: "<b>V + line</b> means direct vision inside a cone." }),
                make("li", { html: "<b>Blue</b> marks police/cameras. <b>Orange</b> marks hunters." }),
                make("li", { html: "<b>Yellow circles</b> are streetlights. Break lamps to create shadow." })
              ])
            ]),
            make("article", { class: "vd-help-card" }, [
              make("h3", { text: "Heat & evidence" }),
              make("ul", { class: "vd-help-list" }, [
                make("li", { html: "<b>!</b> witnesses run to report. Intercept them with <span class='vd-help-kbd'>E</span>." }),
                make("li", { html: "<b>?</b> noise attracts investigation." }),
                make("li", { html: "<b>B</b> blood trails can be followed as physical evidence." })
              ])
            ]),
            make("article", { class: "vd-help-card" }, [
              make("h3", { text: "Powers" }),
              make("ul", { class: "vd-help-list" }, [
                make("li", { html: "<span class='vd-help-kbd'>Q</span> / <span class='vd-help-kbd'>Space</span> Shadow Dash: always usable, raises hunger." }),
                make("li", { html: "<span class='vd-help-kbd'>R</span> Whisper: lure a target, raises hunger." }),
                make("li", { html: "<span class='vd-help-kbd'>F</span> Blood Sense: reveals people, trails, hunters and routes." })
              ])
            ]),
            make("article", { class: "vd-help-card" }, [
              make("h3", { text: "Controls" }),
              make("ul", { class: "vd-help-list" }, [
                make("li", { html: "<span class='vd-help-kbd'>WASD</span> / arrows move." }),
                make("li", { html: "<span class='vd-help-kbd'>Shift</span> sprint." }),
                make("li", { html: "<span class='vd-help-kbd'>E</span> interact, feed, drag, hide or intercept." })
              ])
            ]),
            make("article", { class: "vd-help-card wide" }, [
              make("h3", { text: "Base plan" }),
              make("p", { class: "vd-help-plan", text: "F finds journalist → R lures → E eliminates in shadow → hide body → return to safehouse." }),
              make("p", { class: "vd-help-muted", text: "While this help panel is open, the game is paused and gameplay keys are blocked." })
            ])
          ])
        ])
      ])
    ]);

    document.body.appendChild(overlay);
    closeButton = overlay.querySelector(".vd-help-close");
    closeButton.addEventListener("click", toggleGameHelpAndClose);
  }

  function bindStartAutoOpen() {
    const startOverlay = document.getElementById("startOverlay");
    if (!startOverlay) return;

    const maybeOpen = () => {
      if (autoOpenedAfterStart) return;
      if (!startOverlay.classList.contains("hidden")) return;
      autoOpenedAfterStart = true;
      setTimeout(() => openHelp("start"), 0);
    };

    new MutationObserver(maybeOpen).observe(startOverlay, { attributes: true, attributeFilter: ["class"] });
    maybeOpen();
  }

  function bindKeyboardBlocker() {
    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();

      if (!isOpen && key === "h" && gameHasStarted()) {
        // Let the game receive H too, so its legacy help state stays in sync.
        setTimeout(() => openHelp("hotkey"), 0);
        return;
      }

      if (!isOpen) return;

      if (key === "h") {
        // Let the game receive H, then hide the DOM panel.
        requestAnimationFrame(hideHelpOnly);
        return;
      }

      if (key === "escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        toggleGameHelpAndClose();
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  }

  function init() {
    window.VD_HELP_OPEN = false;
    createHelpOverlay();
    bindStartAutoOpen();
    bindKeyboardBlocker();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
