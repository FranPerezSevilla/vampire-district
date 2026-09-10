// A projection of the gameplay service. No game state, timers or key reader live
// here; the runtime owns refresh and the existing interaction menu owns choices.
export function objectiveBearing(player, target) {
  if (!player || !target || !Number.isFinite(player.x) || !Number.isFinite(player.y) || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return null;
  const dx = target.x - player.x, dy = target.y - player.y;
  const distance = Math.hypot(dx, dy);
  return { distance, angle: Math.atan2(dy, dx) * 180 / Math.PI + 90 };
}

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
    this.errand = document.createElement("div");
    this.errand.className = "vampire-errand";
    this.notice = document.createElement("div");
    this.notice.className = "vampire-notice";
    this.notice.setAttribute("role", "status");
    this.notice.setAttribute("aria-live", "polite");
    const actions = document.createElement("div");
    actions.className = "vampire-actions";
    this.network = document.createElement("button");
    this.network.type = "button";
    this.network.className = "hud-button";
    this.network.textContent = "DOMAIN";
    this.network.addEventListener("click", () => runtime.openNetwork());
    this.blood = document.createElement("button");
    this.blood.type = "button";
    this.blood.className = "hud-button";
    this.blood.addEventListener("click", () => runtime.useBlood());
    this.map = document.createElement("button");
    this.map.type = "button";
    this.map.className = "hud-button";
    this.map.textContent = "MAP";
    this.map.addEventListener("click", () => runtime.openDomain("map"));
    this.job = document.createElement("button");
    this.job.type = "button";
    this.job.className = "hud-button";
    this.job.textContent = "ERRAND";
    this.job.addEventListener("click", () => runtime.openDomain("errand"));
    actions.append(this.network, this.map, this.job, this.blood);
    this.root.append(this.stage, this.guide, this.errand, actions, this.notice);
    host.append(this.root);

    this.objective = document.createElement("div");
    this.objective.setAttribute("aria-hidden", "true");
    Object.assign(this.objective.style, {
      position: "absolute", left: "50%", bottom: "84px", transform: "translateX(-50%)",
      display: "none", alignItems: "center", gap: "8px", padding: "6px 10px",
      background: "rgba(8,11,18,.88)", border: "1px solid rgba(255,220,147,.55)",
      boxShadow: "0 8px 24px rgba(0,0,0,.35)", color: "#ffdc93", font: "700 11px/1.2 Arial, Helvetica, sans-serif",
      pointerEvents: "none", zIndex: "24"
    });
    this.objectiveArrow = document.createElement("span");
    this.objectiveArrow.textContent = "▲";
    Object.assign(this.objectiveArrow.style, {
      display: "inline-block", fontSize: "20px", lineHeight: "20px", transformOrigin: "50% 50%",
      textShadow: "0 0 8px rgba(255,220,147,.55)"
    });
    this.objectiveText = document.createElement("span");
    this.objective.append(this.objectiveArrow, this.objectiveText);
    host.append(this.objective);
    this.root.hidden = true;
  }
  set(node, text) { if (node && node.textContent !== text) node.textContent = text; }
  render(model) {
    if (!this.root) return;
    this.root.hidden = !model.visible;
    if (!model.visible) {
      if (this.objective) this.objective.style.display = "none";
      return;
    }
    this.set(this.stage, `${model.stage.toUpperCase()} · $${Math.floor(model.cash)}`);
    this.set(this.guide, model.guide);
    this.set(this.errand, model.errand);
    this.set(this.blood, `BLOOD ${model.bags}/4`);
    this.blood.disabled = model.locked || !model.bags;
    this.network.disabled = model.locked;
    this.map.disabled = model.locked;
    this.job.disabled = model.locked;
    this.set(this.notice, model.notice);
    this.root.dataset.frenzy = model.frenzy ? "true" : "false";

    const target = this.runtime.guideTarget?.();
    const bearing = objectiveBearing(this.runtime.scene?.player, target);
    if (this.objective && bearing && !model.locked) {
      const show = bearing.distance > 72;
      this.objective.style.display = show ? "flex" : "none";
      if (show) {
        this.objectiveArrow.style.transform = `rotate(${bearing.angle}deg)`;
        this.set(this.objectiveText, `${target.label} · ${Math.round(bearing.distance)}`);
      }
    } else if (this.objective) this.objective.style.display = "none";
  }
  destroy() { this.root?.remove?.(); this.objective?.remove?.(); }
}
