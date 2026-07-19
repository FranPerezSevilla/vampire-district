import { UX_STORAGE_KEYS } from "../data/ux-guidance.js";

function toggleAimContrast(button) {
  const uiScene = window.NBD_PHASER_GAME?.scene?.getScene?.("UIScene");
  if (!uiScene?.registry) return false;

  const enabled = !Boolean(uiScene.registry.get("aimHighContrast"));
  uiScene.registry.set("aimHighContrast", enabled);
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
  const button = event.target?.closest?.("[data-aim-contrast-toggle]");
  if (!button || !toggleAimContrast(button)) return;

  // Phaser's global keyboard manager may suppress native button activation.
  // Own the action explicitly and prevent a later synthetic click from toggling twice.
  event.preventDefault();
  event.stopImmediatePropagation();
}

document.addEventListener("keydown", onKeyDown, true);
