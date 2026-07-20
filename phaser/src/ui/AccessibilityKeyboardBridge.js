import { UX_STORAGE_KEYS } from "../data/ux-guidance.js";

function uiScene() {
  return window.NBD_PHASER_GAME?.scene?.getScene?.("UIScene") || null;
}

function activateModalAction() {
  const ui = uiScene();
  const actionable = Boolean(
    ui
    && (
      ui.introOpen
      || ui.pauseOpen
      || (ui.resultOpen && ui.resultType === "success")
    )
  );
  if (!actionable) return false;
  ui.handleModalAction?.();
  return true;
}

function globalEnterConfirms(ui) {
  return Boolean(
    ui
    && (
      ui.introOpen
      || (ui.resultOpen && ui.resultType === "success")
    )
  );
}

function toggleAimContrast(button) {
  const ui = uiScene();
  if (!ui?.registry) return false;

  const enabled = !Boolean(ui.registry.get("aimHighContrast"));
  ui.registry.set("aimHighContrast", enabled);
  try {
    window.localStorage.setItem(UX_STORAGE_KEYS.AIM_HIGH_CONTRAST, enabled ? "true" : "false");
  } catch {
    // The setting still applies for the current page when storage is unavailable.
  }

  button.setAttribute("aria-pressed", enabled ? "true" : "false");
  button.textContent = `High-contrast aim: ${enabled ? "On" : "Off"}`;
  return true;
}

function ownEvent(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

function onKeyDown(event) {
  if (event.repeat || !["Enter", "Space"].includes(event.code)) return;

  const contrastButton = event.target?.closest?.("[data-aim-contrast-toggle]");
  if (contrastButton && toggleAimContrast(contrastButton)) {
    // Own the action explicitly and prevent a later synthetic click from toggling twice.
    ownEvent(event);
    return;
  }

  const ui = uiScene();
  const modalAction = event.target?.closest?.("#ui-modal-action");
  const globalConfirmation = event.code === "Enter" && globalEnterConfirms(ui);
  if ((modalAction || globalConfirmation) && activateModalAction()) {
    // Phaser's global keyboard manager may consume Enter before the UIScene
    // listener. Capture both a focused modal button and the documented global
    // Enter shortcut before that happens, then prevent duplicate activation.
    ownEvent(event);
  }
}

document.addEventListener("keydown", onKeyDown, true);