import "./combat/combat-compatibility.js";
import "./input/movement-input-adapter.js";
import "./input/input-runtime.js";
import "./input/tutorial-input-adapter.js";
import "./movement/milestone5-runtime.js";
import "./world/milestone6-runtime.js";
import { UIScene } from "./scenes/UIScene.js";

function installUiControlCopy() {
  if (UIScene.prototype.__nbdMovementControlsPatch) return;

  const originalBindDom = UIScene.prototype.bindDom;
  const originalSetModal = UIScene.prototype.setModal;

  UIScene.prototype.bindDom = function bindMovementPromptKey(...args) {
    const result = originalBindDom.apply(this, args);
    this.dom.promptKey = this.dom.prompt?.querySelector("kbd") || null;
    return result;
  };

  UIScene.prototype.renderPrompt = function renderPromptWithDynamicKey(data) {
    const hasMenu = Boolean(data.menu && data.menu.options?.length);
    const prompt = !this.modalBlocksInput() && !hasMenu ? String(data.prompt || "") : "";
    const movementPrompt = /^SPACE:\s*/i.test(prompt);
    const cleanPrompt = prompt.replace(/^(?:SPACE|E):\s*/i, "");

    this.setText(this.dom.promptKey, movementPrompt ? "SPACE" : "E");
    this.setText(this.dom.promptText, cleanPrompt);
    this.dom.prompt?.classList.toggle("visible", Boolean(cleanPrompt));
    this.dom.prompt?.classList.toggle("movement", Boolean(cleanPrompt && movementPrompt));

    const toast = !this.modalBlocksInput() && data.lastAction ? data.lastAction : "";
    if (toast && toast !== this.lastToastText) {
      this.lastToastText = toast;
      this.toastUntil = this.time.now + 2800;
      this.setText(this.dom.toastText, toast);
    }
    const toastVisible = !this.modalBlocksInput()
      && Boolean(this.dom.toastText?.textContent)
      && this.time.now < this.toastUntil;
    this.dom.toast?.classList.toggle("visible", toastVisible);
  };

  UIScene.prototype.setModal = function setModalWithMovementControls(title, bodyHtml, actionLabel) {
    const updatedBody = String(bodyHtml || "")
      .replace(
        "WASD/arrows move · Shift sprint · E interact · Q/Space Dash",
        "WASD/arrows run · hold Shift to move quietly · mouse aims · left-click punches/objects · hold right-click to drain · Space traverses · E interacts · Q Dash"
      )
      .replace(
        "Movement: WASD/arrows · Shift sprint",
        "Movement: WASD/arrows run by default · hold Shift for quiet movement · Space near routes to traverse"
      )
      .replace(
        "WASD/arrows move · mouse aims · left-click punches · hold Space to run · Space traverses · E interacts · Q Dash",
        "WASD/arrows run · hold Shift to move quietly · mouse aims · left-click punches/objects · hold right-click to drain · Space traverses · E interacts · Q Dash"
      )
      .replace(
        "Movement: WASD/arrows · mouse aim · left-click punch · hold Space to run · Space near routes to traverse",
        "Movement: WASD/arrows run by default · hold Shift for quiet movement · mouse aim · left-click punches and breaks objects · Space near routes to traverse"
      )
      .replace(
        "Interact: E near routes, targets, bodies, witnesses, lamps",
        "Combat: left-click punch or break aimed objects · hold right-click to drain valid targets<br>Interact: E for clues, dialogue, bodies and mission objects"
      )
      .replace("Powers: Q/Space Dash", "Powers: Q Dash");
    return originalSetModal.call(this, title, updatedBody, actionLabel);
  };

  UIScene.prototype.__nbdMovementControlsPatch = true;
}

installUiControlCopy();
