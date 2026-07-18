import { UIScene } from "./scenes/UIScene.js";

function installFinalReportStyle() {
  if (document.getElementById("nbd-final-report-sire-style")) return;

  const style = document.createElement("style");
  style.id = "nbd-final-report-sire-style";
  style.textContent = `
    .final-report-outcome {
      margin: 0 0 16px;
      padding: 13px 15px;
      border-left: 3px solid rgba(120, 199, 163, .82);
      background: linear-gradient(145deg, rgba(20, 51, 42, .42), rgba(8, 15, 15, .36));
      color: #e5fff2;
      font-size: clamp(15px, 1.2vw, 19px);
      font-weight: 720;
      line-height: 1.34;
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
        `<div class="final-report-outcome">The journalist is silenced. You returned to the refuge, and the veil remains intact.</div><div class="final-report-summary">Night report</div><pre>${stats}</pre>`,
        "Continue free roam · Enter/Esc"
      );
    }

    return result;
  };

  UIScene.prototype.__nbdSireFinalReportPatch = true;
}

installSireFinalReport();
