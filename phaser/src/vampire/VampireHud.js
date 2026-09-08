// A projection of the gameplay service. No game state, timers or key reader live
// here; the runtime owns refresh and the existing interaction menu owns choices.
export class VampireHud {
  constructor(runtime, document = globalThis.document) {
    this.runtime = runtime;
    const host = document?.getElementById?.("game-ui");
    if (!host) return;
    this.root = document.createElement("section");
    this.root.className = "vampire-hud";
    this.root.setAttribute("aria-label", "Vampire network and current agreement");
    this.stage = document.createElement("strong");
    this.guide = document.createElement("div");
    this.guide.className = "vampire-guide";
    this.notice = document.createElement("div");
    this.notice.className = "vampire-notice";
    this.notice.setAttribute("role", "status");
    this.notice.setAttribute("aria-live", "polite");
    const actions = document.createElement("div");
    actions.className = "vampire-actions";
    this.network = document.createElement("button");
    this.network.type = "button";
    this.network.className = "hud-button";
    this.network.textContent = "CONTACTS";
    this.network.addEventListener("click", () => runtime.openNetwork());
    this.blood = document.createElement("button");
    this.blood.type = "button";
    this.blood.className = "hud-button";
    this.blood.addEventListener("click", () => runtime.useBlood());
    actions.append(this.network, this.blood);
    this.root.append(this.stage, this.guide, actions, this.notice);
    host.append(this.root);
    this.root.hidden = true;
  }
  set(node, text) { if (node && node.textContent !== text) node.textContent = text; }
  render(model) {
    if (!this.root) return;
    this.root.hidden = !model.visible;
    if (!model.visible) return;
    this.set(this.stage, `${model.stage.toUpperCase()} · $${Math.floor(model.cash)}`);
    this.set(this.guide, model.guide);
    this.set(this.blood, `BLOOD ${model.bags}/4`);
    this.blood.disabled = model.locked || !model.bags;
    this.network.disabled = model.locked;
    this.set(this.notice, model.notice);
    this.root.dataset.frenzy = model.frenzy ? "true" : "false";
  }
  destroy() { this.root?.remove?.(); }
}
