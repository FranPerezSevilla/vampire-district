import { UIScene } from "../scenes/UIScene.js";

function installWeaponStyle() {
  if (typeof document === "undefined" || document.getElementById("nbd-weapon-hud-style")) return;
  const style = document.createElement("style");
  style.id = "nbd-weapon-hud-style";
  style.textContent = `
    .weapon-hud {
      position: absolute;
      left: 18px;
      bottom: 18px;
      min-width: 122px;
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: end;
      gap: 2px 12px;
      padding: 8px 10px;
      border: 1px solid rgba(241, 230, 255, .18);
      border-radius: 8px;
      background: rgba(5, 6, 11, .78);
      box-shadow: 0 6px 22px rgba(0, 0, 0, .24);
      pointer-events: none;
      z-index: 7;
    }
    .weapon-hud small {
      grid-column: 1 / -1;
      color: rgba(215, 200, 255, .62);
      font-size: 9px;
      font-weight: 900;
      letter-spacing: .15em;
    }
    .weapon-hud strong {
      color: #f1e6ff;
      font-size: 13px;
      line-height: 1;
    }
    .weapon-hud span {
      color: #fff2a8;
      font-size: 12px;
      font-weight: 900;
    }
    .weapon-hud.empty span { color: #ff6b7a; }
    .weapon-hud kbd {
      position: absolute;
      right: 8px;
      top: 6px;
      color: rgba(241, 230, 255, .42);
      font-size: 8px;
    }
    @media (max-width: 720px) {
      .weapon-hud {
        left: 10px;
        bottom: 10px;
        min-width: 104px;
        padding: 7px 8px;
      }
    }
  `;
  document.head.appendChild(style);
}

function installWeaponUi() {
  if (UIScene.prototype.__nbdWeaponUiPatch) return;

  const originalBindDom = UIScene.prototype.bindDom;
  const originalReadState = UIScene.prototype.readState;
  const originalRenderHud = UIScene.prototype.renderHud;
  const originalStatsText = UIScene.prototype.statsText;

  UIScene.prototype.bindDom = function bindDomWithWeaponHud(...args) {
    const result = originalBindDom.apply(this, args);
    installWeaponStyle();

    let weapon = this.dom.root?.querySelector?.(".weapon-hud");
    if (!weapon && this.dom.root) {
      weapon = document.createElement("div");
      weapon.className = "weapon-hud";
      weapon.innerHTML = `
        <small>WEAPON</small>
        <strong>Unarmed</strong>
        <span>∞</span>
        <kbd>WHEEL</kbd>
      `;
      this.dom.root.appendChild(weapon);
    }

    this.dom.weapon = weapon;
    this.dom.weaponName = weapon?.querySelector("strong") || null;
    this.dom.weaponAmmo = weapon?.querySelector("span") || null;
    return result;
  };

  UIScene.prototype.readState = function readStateWithWeapon(...args) {
    const data = originalReadState.apply(this, args);
    return {
      ...data,
      weapon: this.registry.get("weaponState") || {
        id: "unarmed",
        name: "Unarmed",
        ammoText: "∞",
        empty: false
      }
    };
  };

  UIScene.prototype.renderHud = function renderHudWithWeapon(data) {
    const result = originalRenderHud.call(this, data);
    const weapon = data?.weapon || {};
    this.setText(this.dom.weaponName, weapon.name || "Unarmed");
    this.setText(this.dom.weaponAmmo, weapon.ammoText || "∞");
    this.dom.weapon?.classList.toggle("empty", Boolean(weapon.empty));
    return result;
  };

  UIScene.prototype.statsText = function statsTextWithWeapon(data) {
    const base = originalStatsText.call(this, data);
    const weapon = data?.weapon || {};
    const line = `Weapon: ${weapon.name || "Unarmed"} · ammo ${weapon.ammoText || "∞"}`;
    return base.replace("Position:", `${line}\nPosition:`);
  };

  UIScene.prototype.__nbdWeaponUiPatch = true;
}

installWeaponUi();
