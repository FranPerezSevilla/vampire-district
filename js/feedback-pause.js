// Feedback modal integration with the game pause bridge.
// Keeps the simulation paused and prevents modal keystrokes from reaching gameplay controls.
(() => {
  "use strict";

  function overlay() {
    return document.getElementById("feedbackOverlay");
  }

  function feedbackIsOpen() {
    const node = overlay();
    return Boolean(node && !node.classList.contains("hidden") && node.getAttribute("aria-hidden") !== "true");
  }

  function setFeedbackPause(open) {
    window.VD_FEEDBACK_OPEN = Boolean(open);
    document.body.classList.toggle("feedback-modal-open", Boolean(open));
  }

  function syncFeedbackPause() {
    setFeedbackPause(feedbackIsOpen());
  }

  function closeFeedbackFromBridge() {
    const node = overlay();
    if (!node) return;
    node.querySelector(".feedback-close")?.click();
    syncFeedbackPause();
  }

  function install() {
    const node = overlay();
    if (!node) {
      window.setTimeout(install, 50);
      return;
    }

    syncFeedbackPause();

    const observer = new MutationObserver(syncFeedbackPause);
    observer.observe(node, { attributes: true, attributeFilter: ["class", "aria-hidden"] });

    // Events inside the modal should work normally for inputs, buttons and textareas,
    // but must not bubble to the window-level game controls.
    node.addEventListener("keydown", (event) => {
      if (!feedbackIsOpen()) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeFeedbackFromBridge();
        return;
      }
      event.stopPropagation();
    });

    // If focus somehow escapes the modal while it is open, block gameplay keys anyway.
    window.addEventListener("keydown", (event) => {
      if (!feedbackIsOpen()) return;
      if (node.contains(event.target)) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.key === "Escape") closeFeedbackFromBridge();
    }, true);

    window.addEventListener("focus", syncFeedbackPause, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
})();
