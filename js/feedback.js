(() => {
  "use strict";

  const STORAGE_KEY = "vampire-district-feedback-queue";
  const AUTO_OPEN_KEY = "vampire-district-feedback-auto-opened";
  const playtestStart = performance.now();

  const config = {
    endpoint: window.VD_FEEDBACK_ENDPOINT || "",
    buildVersion: window.VD_BUILD_VERSION || "dev-local"
  };

  let rating = 0;
  let isOpen = false;

  function $(selector) {
    return document.querySelector(selector);
  }

  function el(tag, attrs = {}, children = []) {
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

  function textOf(id) {
    const node = document.getElementById(id);
    return node ? node.textContent.trim() : "";
  }

  function queuedFeedback() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function setQueuedFeedback(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function queueFeedback(payload) {
    const items = queuedFeedback();
    items.push(payload);
    setQueuedFeedback(items.slice(-50));
  }

  function collectSnapshot() {
    return {
      buildVersion: config.buildVersion,
      pageUrl: location.href,
      userAgent: navigator.userAgent,
      timePlayedSeconds: Math.round((performance.now() - playtestStart) / 1000),
      hunger: textOf("hungerValue"),
      exposure: textOf("exposureValue"),
      objective: textOf("missionText"),
      layer: textOf("layerText"),
      visibility: textOf("visibilityText"),
      lastMessage: textOf("messageLine"),
      legend: textOf("legendLine"),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      timestampClient: new Date().toISOString()
    };
  }

  function buildPayload() {
    return {
      rating,
      liked: $("#feedbackLiked")?.value.trim() || "",
      disliked: $("#feedbackDisliked")?.value.trim() || "",
      missing: $("#feedbackMissing")?.value.trim() || "",
      playerName: $("#feedbackName")?.value.trim() || "",
      snapshot: collectSnapshot()
    };
  }

  function setStatus(text, type = "") {
    const node = $("#feedbackStatus");
    if (!node) return;
    node.className = `feedback-status ${type}`.trim();
    node.textContent = text;
  }

  function updateStars() {
    document.querySelectorAll(".feedback-star").forEach((button) => {
      const value = Number(button.dataset.value);
      button.classList.toggle("active", value <= rating);
      button.setAttribute("aria-pressed", value <= rating ? "true" : "false");
    });
  }

  function resetForm() {
    rating = 0;
    ["feedbackLiked", "feedbackDisliked", "feedbackMissing", "feedbackName"].forEach((id) => {
      const node = document.getElementById(id);
      if (node) node.value = "";
    });
    updateStars();
    setStatus("", "");
  }

  function openFeedback(reason = "manual") {
    const overlay = $("#feedbackOverlay");
    if (!overlay) return;
    isOpen = true;
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    overlay.dataset.reason = reason;
    setStatus(config.endpoint
      ? "Feedback will be sent to the configured collector."
      : "No endpoint configured yet. Feedback will be stored locally in this browser.",
      config.endpoint ? "" : "warn");
    setTimeout(() => $(".feedback-star")?.focus(), 0);
  }

  function closeFeedback() {
    const overlay = $("#feedbackOverlay");
    if (!overlay) return;
    isOpen = false;
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
  }

  async function submitFeedback(payload) {
    if (!rating) {
      setStatus("Please choose a 1-5 star rating first.", "warn");
      return;
    }

    if (!config.endpoint) {
      queueFeedback(payload);
      setStatus("Saved locally. Configure js/feedback-config.js to send it to Google Sheets.", "warn");
      resetForm();
      return;
    }

    try {
      await fetch(config.endpoint, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });
      setStatus("Feedback sent. Thank you.", "ok");
      resetForm();
    } catch (error) {
      queueFeedback(payload);
      setStatus("Network error. Feedback saved locally as backup.", "bad");
      console.warn("Feedback submission failed", error);
    }
  }

  function downloadQueuedFeedback() {
    const items = queuedFeedback();
    if (!items.length) {
      setStatus("There is no local feedback stored.", "warn");
      return;
    }
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vampire-district-feedback-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus(`Downloaded ${items.length} local feedback item(s).`, "ok");
  }

  function maybeAutoOpenFromGameText() {
    if (sessionStorage.getItem(AUTO_OPEN_KEY) === "1") return;
    const text = `${textOf("messageLine")} ${textOf("missionText")}`.toLowerCase();
    const completed = text.includes("order complete") || text.includes("clan report") || text.includes("free roam");
    if (!completed) return;
    sessionStorage.setItem(AUTO_OPEN_KEY, "1");
    setTimeout(() => openFeedback("order-complete"), 900);
  }

  function createFeedbackUi() {
    const fab = el("button", {
      class: "feedback-fab",
      type: "button",
      text: "Feedback · P",
      "aria-label": "Open playtest feedback form"
    });
    fab.addEventListener("click", () => openFeedback("button"));

    const starRow = el("div", { class: "feedback-stars", role: "group", "aria-label": "Rating from 1 to 5 stars" });
    for (let i = 1; i <= 5; i++) {
      const star = el("button", {
        class: "feedback-star",
        type: "button",
        text: "★",
        "data-value": String(i),
        "aria-label": `${i} star${i === 1 ? "" : "s"}`,
        "aria-pressed": "false"
      });
      star.addEventListener("click", () => {
        rating = i;
        updateStars();
      });
      starRow.appendChild(star);
    }

    const overlay = el("div", { id: "feedbackOverlay", class: "feedback-overlay hidden", "aria-hidden": "true" }, [
      el("section", { class: "feedback-panel", role: "dialog", "aria-modal": "true", "aria-label": "Playtest feedback" }, [
        el("div", { class: "feedback-header" }, [
          el("div", {}, [
            el("h2", { class: "feedback-title", text: "Playtest feedback" }),
            el("p", { class: "feedback-subtitle", text: "Rate the prototype and tell me what worked, what did not, and what you missed." })
          ]),
          el("button", { class: "feedback-close", type: "button", text: "×", "aria-label": "Close feedback form" })
        ]),
        el("form", { id: "feedbackForm", class: "feedback-grid" }, [
          el("div", { class: "feedback-rating" }, [
            el("span", { class: "feedback-rating-label", text: "Rating" }),
            starRow
          ]),
          el("div", { class: "feedback-field" }, [
            el("label", { for: "feedbackLiked", text: "What did you like most?" }),
            el("textarea", { id: "feedbackLiked", name: "liked", rows: "3", placeholder: "Example: rooftop escape, vampire powers, stealth loop..." })
          ]),
          el("div", { class: "feedback-field" }, [
            el("label", { for: "feedbackDisliked", text: "What did you like least?" }),
            el("textarea", { id: "feedbackDisliked", name: "disliked", rows: "3", placeholder: "Example: too hard, unclear UI, enemies too fast..." })
          ]),
          el("div", { class: "feedback-field" }, [
            el("label", { for: "feedbackMissing", text: "What felt missing?" }),
            el("textarea", { id: "feedbackMissing", name: "missing", rows: "3", placeholder: "Example: more powers, better map, more narrative, clearer routes..." })
          ]),
          el("div", { class: "feedback-field" }, [
            el("label", { for: "feedbackName", text: "Name / handle (optional)" }),
            el("input", { id: "feedbackName", name: "playerName", type: "text", placeholder: "Optional" })
          ]),
          el("div", { class: "feedback-actions" }, [
            el("button", { id: "feedbackSend", type: "submit", text: "Send feedback" }),
            el("button", { id: "feedbackSkip", class: "secondary", type: "button", text: "Skip" }),
            el("button", { id: "feedbackDownload", class: "secondary", type: "button", text: "Download local feedback" })
          ]),
          el("div", { id: "feedbackStatus", class: "feedback-status", role: "status", "aria-live": "polite" }),
          el("div", { class: "feedback-meta", text: `Build: ${config.buildVersion} · Endpoint: ${config.endpoint ? "configured" : "not configured"}` })
        ])
      ])
    ]);

    document.body.appendChild(fab);
    document.body.appendChild(overlay);

    overlay.querySelector(".feedback-close").addEventListener("click", closeFeedback);
    overlay.querySelector("#feedbackSkip").addEventListener("click", closeFeedback);
    overlay.querySelector("#feedbackDownload").addEventListener("click", downloadQueuedFeedback);
    overlay.querySelector("#feedbackForm").addEventListener("submit", (event) => {
      event.preventDefault();
      submitFeedback(buildPayload());
    });

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeFeedback();
    });
  }

  function bindHotkeys() {
    window.addEventListener("keydown", (event) => {
      const active = document.activeElement;
      const typing = active && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName);
      if (typing) return;
      if (event.key.toLowerCase() === "p") {
        event.preventDefault();
        isOpen ? closeFeedback() : openFeedback("hotkey");
      }
      if (event.key === "Escape" && isOpen) closeFeedback();
    });
  }

  function observeGameCompletion() {
    const message = document.getElementById("messageLine");
    const mission = document.getElementById("missionText");
    const observer = new MutationObserver(maybeAutoOpenFromGameText);
    if (message) observer.observe(message, { childList: true, characterData: true, subtree: true });
    if (mission) observer.observe(mission, { childList: true, characterData: true, subtree: true });
    window.setInterval(maybeAutoOpenFromGameText, 2500);
  }

  function init() {
    createFeedbackUi();
    bindHotkeys();
    observeGameCompletion();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
