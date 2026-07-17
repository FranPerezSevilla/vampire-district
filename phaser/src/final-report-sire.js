import { UIScene } from "./scenes/UIScene.js";

function installFinalReportStyle() {
  if (document.getElementById("nbd-final-report-sire-style")) return;

  const style = document.createElement("style");
  style.id = "nbd-final-report-sire-style";
  style.textContent = `
    .final-report-sire {
      margin: 0 0 16px;
      padding: 15px 17px;
      border-left: 3px solid rgba(167, 92, 255, .82);
      background: linear-gradient(145deg, rgba(47, 26, 73, .44), rgba(10, 8, 18, .36));
    }

    .final-report-sire__speaker {
      display: block;
      margin-bottom: 7px;
      color: #cda6ff;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: .13em;
      text-transform: uppercase;
    }

    .final-report-sire p {
      margin: 0;
      color: #f4ecff;
      font-size: clamp(17px, 1.45vw, 22px);
      font-weight: 720;
      line-height: 1.32;
    }

    .final-report-summary {
      margin: 12px 0 7px;
      color: #78c7a3;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: .12em;
      text-transform: uppercase;
    }
  `;
  document.head.appendChild(style);
}

function installSireFinalReport() {
  if (UIScene.prototype.__nbdSireFinalReportPatch) return;

  installFinalReportStyle();
  const originalRenderModal = UIScene.prototype.renderModal;

  UIScene.prototype.renderModal = function renderModalWithSireReport(data) {
    const result = originalRenderModal.call(this, data);

    if (this.resultOpen && this.resultType === "success") {
      const stats = this.escapeHtml(this.statsText(data));
      this.setModal(
        "REPORT ACCEPTED",
        `<div class="final-report-sire"><span class="final-report-sire__speaker">YOUR SIRE · IN YOUR MIND</span><p>Well done. The journalist is silenced, and the veil remains intact. You have served me well tonight.</p></div><div class="final-report-summary">Night report</div><pre>${stats}</pre>`,
        "Continue free roam · Enter/Esc"
      );
    }

    return result;
  };

  UIScene.prototype.__nbdSireFinalReportPatch = true;
}

installSireFinalReport();
