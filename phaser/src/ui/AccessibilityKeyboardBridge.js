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

function onKeyDown(event) {
  if (event.repeat || !["Enter", "Space"].includes(event.code)) return;

  const modalAction = event.target?.closest?.("#ui-modal-action");
  if (modalAction && activateModalAction()) {
    // Phaser's global keyboard manager may suppress native button activation.
    // Own the focused modal action explicitly and prevent a duplicate click.
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }

  const contrastButton = event.target?.closest?.("[data-aim-contrast-toggle]");
  if (!contrastButton || !toggleAimContrast(contrastButton)) return;

  // Own the action explicitly and prevent a later synthetic click from toggling twice.
  event.preventDefault();
  event.stopImmediatePropagation();
}

document.addEventListener("keydown", onKeyDown, true);