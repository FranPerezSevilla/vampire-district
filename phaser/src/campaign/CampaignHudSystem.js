function installStyle() {
  if (typeof document === "undefined" || document.getElementById("nbd-campaign-hud-style")) return;
  const style = document.createElement("style");
  style.id = "nbd-campaign-hud-style";
  style.textContent = `
    .campaign-cash-hud {
      position: absolute;
      right: 18px;
      bottom: 94px;
      min-width: 142px;
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: baseline;
      gap: 8px;
      padding: 7px 10px;
      border: 1px solid rgba(120, 199, 163, .42);
      border-left-width: 3px;
      background: rgba(5, 9, 13, .90);
      box-shadow: 0 9px 28px rgba(0, 0, 0, .34);
      color: #eafff5;
      pointer-events: none;
      z-index: 67;
    }
    .campaign-cash-hud small {
      color: #78c7a3;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: .08em;
    }
    .campaign-cash-hud strong {
      justify-self: end;
      font-size: 14px;
      font-weight: 900;
    }
    .campaign-cash-hud.changed { animation: nbd-cash-change .55s ease-out; }
    @keyframes nbd-cash-change {
      0% { transform: translateY(0); filter: brightness(1); }
      35% { transform: translateY(-3px); filter: brightness(1.45); }
      100% { transform: translateY(0); filter: brightness(1); }
    }
    @media (max-width: 980px) {
      .campaign-cash-hud { right: 10px; bottom: 80px; }
    }
    @media (max-width: 720px) {
      .campaign-cash-hud { min-width: 118px; bottom: 74px; padding: 6px 8px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .campaign-cash-hud.changed { animation: none !important; }
    }
  `;
  document.head.appendChild(style);
}

export class CampaignHudSystem {
  constructor(campaign) {
    this.campaign = campaign;
    this.root = null;
    this.value = null;
    this.animationTimer = 0;
    this.disposers = [];
    this.createDom();
    this.disposers.push(campaign.events.on("wallet:changed", () => this.render(true)));
    this.disposers.push(campaign.events.on("campaign:loaded", () => this.render(false)));
    this.render(false);
  }

  createDom() {
    if (typeof document === "undefined") return;
    installStyle();
    const host = document.getElementById("game-ui");
    if (!host) return;
    this.root = document.getElementById("campaign-cash-hud");
    if (!this.root) {
      this.root = document.createElement("div");
      this.root.id = "campaign-cash-hud";
      this.root.className = "campaign-cash-hud";
      this.root.setAttribute("role", "status");
      this.root.setAttribute("aria-live", "polite");
      this.root.innerHTML = `<small>CASH</small><strong>$0</strong>`;
      host.appendChild(this.root);
    }
    this.value = this.root.querySelector("strong");
  }

  render(animate = false) {
    if (!this.value) return;
    const balance = this.campaign.wallet.balance();
    const text = `$${Math.round(balance).toLocaleString("en-US")}`;
    if (this.value.textContent !== text) this.value.textContent = text;
    this.root?.setAttribute?.("aria-label", `Cash ${Math.round(balance)} dollars`);
    if (!animate || !this.root) return;
    this.root.classList.remove("changed");
    void this.root.offsetWidth;
    this.root.classList.add("changed");
    if (this.animationTimer) window.clearTimeout(this.animationTimer);
    this.animationTimer = window.setTimeout(() => this.root?.classList.remove("changed"), 650);
  }

  destroy() {
    for (const dispose of this.disposers.splice(0)) dispose?.();
    if (this.animationTimer && typeof window !== "undefined") window.clearTimeout(this.animationTimer);
    this.root?.remove?.();
  }
}
