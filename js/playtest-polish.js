(() => {
  "use strict";

  const STEP_GUIDE = [
    {
      match: "1/7",
      step: "1/7",
      title: "Leave the safehouse",
      hint: "Walk to the door and press E. The district starts outside."
    },
    {
      match: "2/7",
      step: "2/7",
      title: "Reach the nightclub",
      hint: "Head for the pink-lit club. Do not worry about perfect stealth yet."
    },
    {
      match: "3/7",
      step: "3/7",
      title: "Use Blood Sense",
      hint: "Press F near the club to identify the journalist and key threats."
    },
    {
      match: "4/7",
      step: "4/7",
      title: "Whisper to the journalist",
      hint: "Get close, preferably from shadow, and press R to lure the target."
    },
    {
      match: "5/7",
      step: "5/7",
      title: "Lead them into shadow",
      hint: "Move the journalist away from eyes. Press E when the crime is hidden."
    },
    {
      match: "6/7",
      step: "6/7",
      title: "Contain the evidence",
      hint: "Hide the body, intercept witnesses, or break pursuit before returning home."
    },
    {
      match: "7/7",
      step: "7/7",
      title: "Return to the safehouse",
      hint: "Use rooftops, shadows or sewers if the street is hot."
    },
    {
      match: "ORDER COMPLETE",
      step: "Complete",
      title: "Review the clan report",
      hint: "Accept the report, then send feedback while the run is fresh."
    },
    {
      match: "FREE ROAM",
      step: "Free roam",
      title: "Prototype complete",
      hint: "Keep testing systems or send feedback with P."
    }
  ];

  let coach;
  let completionCta;
  let completionShown = false;
  let injectedHelp = false;

  function textOf(id) {
    return document.getElementById(id)?.textContent.trim() || "";
  }

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

  function startOverlayVisible() {
    const start = document.getElementById("startOverlay");
    return Boolean(start && !start.classList.contains("hidden"));
  }

  function modalOpen() {
    return Boolean(window.VD_FEEDBACK_OPEN || window.VD_HELP_OPEN);
  }

  function currentGuide() {
    const raw = `${textOf("missionText")} ${textOf("messageLine")}`;
    const upper = raw.toUpperCase();
    return STEP_GUIDE.find((item) => upper.includes(item.match.toUpperCase())) || {
      step: "Order",
      title: "Protect the clan secret",
      hint: "Find the journalist, isolate them, eliminate them and hide the evidence."
    };
  }

  function createObjectiveCoach() {
    coach = make("aside", { id: "vdObjectiveCoach", class: "vd-objective-coach hidden", "aria-live": "polite" }, [
      make("div", { class: "vd-objective-top" }, [
        make("span", { class: "vd-objective-kicker", text: "Next move" }),
        make("span", { id: "vdObjectiveStep", class: "vd-objective-step", text: "Order" })
      ]),
      make("h3", { id: "vdObjectiveTitle", class: "vd-objective-title", text: "Protect the clan secret" }),
      make("p", { id: "vdObjectiveHint", class: "vd-objective-hint", text: "Find the journalist, isolate them, eliminate them and hide the evidence." })
    ]);
    document.body.appendChild(coach);
  }

  function updateObjectiveCoach() {
    if (!coach) return;
    const hide = startOverlayVisible() || modalOpen();
    coach.classList.toggle("hidden", hide);
    const guide = currentGuide();
    const step = document.getElementById("vdObjectiveStep");
    const title = document.getElementById("vdObjectiveTitle");
    const hint = document.getElementById("vdObjectiveHint");
    if (step) step.textContent = guide.step;
    if (title) title.textContent = guide.title;
    if (hint) hint.textContent = guide.hint;
  }

  function triggerFeedback() {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "p", bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "p", bubbles: true }));
  }

  function createCompletionCta() {
    completionCta = make("aside", { id: "vdCompletionCta", class: "vd-completion-cta hidden", role: "dialog", "aria-label": "Run complete feedback" }, [
      make("div", { class: "vd-completion-eyebrow", text: "Run complete" }),
      make("h3", { text: "How did the order feel?" }),
      make("p", { text: "Give a 1-5 rating and tell me what worked, what failed, and what you missed. It goes straight to the feedback collector." }),
      make("div", { class: "vd-completion-actions" }, [
        make("button", { id: "vdCompletionFeedback", type: "button", text: "Give feedback" }),
        make("button", { id: "vdCompletionHide", class: "secondary", type: "button", text: "Keep roaming" })
      ])
    ]);
    document.body.appendChild(completionCta);
    document.getElementById("vdCompletionFeedback")?.addEventListener("click", () => {
      completionCta.classList.add("hidden");
      triggerFeedback();
    });
    document.getElementById("vdCompletionHide")?.addEventListener("click", () => completionCta.classList.add("hidden"));
  }

  function maybeShowCompletionCta() {
    if (!completionCta || completionShown) return;
    const text = `${textOf("missionText")} ${textOf("messageLine")}`.toLowerCase();
    const complete = text.includes("order complete") || text.includes("clan report") || text.includes("free roam");
    if (!complete) return;
    completionShown = true;
    setTimeout(() => {
      if (!completionCta) return;
      completionCta.classList.remove("hidden");
    }, 600);
  }

  function createBuildBadge() {
    const badge = make("div", { class: "vd-build-badge", text: "Prototype build · audio WIP · keyboard recommended" });
    document.body.appendChild(badge);
  }

  function injectHelpPolish() {
    if (injectedHelp) return;
    const grid = document.querySelector("#vdHelpOverlay .vd-help-grid");
    if (!grid) return;
    injectedHelp = true;

    const routeCard = make("article", { class: "vd-help-card wide vd-playtest-card" }, [
      make("h3", { text: "Playtest notes" }),
      make("ul", { class: "vd-help-list" }, [
        make("li", { html: "This is a prototype: audio beyond footsteps is intentionally work in progress." }),
        make("li", { html: "Best played with keyboard. The goal is one clean mission, not endless content." }),
        make("li", { html: "If you feel stuck, check the <b>Next move</b> card or restart the run." })
      ]),
      make("button", { class: "vd-playtest-reset", type: "button", text: "Restart run" })
    ]);
    routeCard.querySelector("button")?.addEventListener("click", () => window.location.reload());
    grid.appendChild(routeCard);
  }

  function observeTextChanges() {
    const message = document.getElementById("messageLine");
    const mission = document.getElementById("missionText");
    const observer = new MutationObserver(() => {
      updateObjectiveCoach();
      maybeShowCompletionCta();
    });
    if (message) observer.observe(message, { childList: true, characterData: true, subtree: true });
    if (mission) observer.observe(mission, { childList: true, characterData: true, subtree: true });
    setInterval(() => {
      updateObjectiveCoach();
      maybeShowCompletionCta();
      injectHelpPolish();
    }, 700);
  }

  function init() {
    createBuildBadge();
    createObjectiveCoach();
    createCompletionCta();
    observeTextChanges();
    updateObjectiveCoach();
    injectHelpPolish();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
