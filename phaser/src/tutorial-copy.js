import "./english-copy.js";
import { UIScene } from "./scenes/UIScene.js";

const INTRO_NARRATION = "Hace varias décadas que fuiste convertido. Entre los vampiros no eres más que un torpe chiquillo que aún está aprendiendo. Te limitas a hacer recados e ir de acá para allá. Te sientes atrapado en una no-vida que prometía ser mucho más emocionante de lo que realmente es.";
const OLD_INTRO_LINE = "Otra noche más. Igual que la anterior. Igual que la que vendrá. Estoy... atrapado.";

function patchTutorialNarration() {
  const gameScene = window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene");
  const director = gameScene?.tutorialDirector;

  if (!director) {
    window.requestAnimationFrame(patchTutorialNarration);
    return;
  }

  if (!director.showDialogue.__nbdIntroCopyPatch) {
    const originalShowDialogue = director.showDialogue.bind(director);

    const showDialogueWithRevisedIntro = function showDialogueWithRevisedIntro(payload = {}) {
      if (payload.text === OLD_INTRO_LINE) {
        return originalShowDialogue({
          ...payload,
          speaker: "NARRADOR",
          text: INTRO_NARRATION,
          kind: "speech",
          duration: 9500
        });
      }

      return originalShowDialogue(payload);
    };

    showDialogueWithRevisedIntro.__nbdIntroCopyPatch = true;
    director.showDialogue = showDialogueWithRevisedIntro;
  }
}

function patchIntroModalCopy() {
  if (!UIScene.prototype.__nbdSireTutorialIntroPatch) {
    window.requestAnimationFrame(patchIntroModalCopy);
    return;
  }
  if (UIScene.prototype.__nbdIntroModalCopyPatch) return;

  const originalRenderModal = UIScene.prototype.renderModal;
  UIScene.prototype.renderModal = function renderModalWithRevisedIntro(data) {
    const result = originalRenderModal.call(this, data);

    if (this.introOpen) {
      this.setModal(
        "Night Blood District",
        `<p><strong>Hace décadas que comenzó tu no-vida.</strong></p><p>Entre los vampiros sigues siendo poco más que un chiquillo torpe, útil para recados y trabajos menores.</p><p>Pulsa comenzar para escuchar la llamada de tu sire.</p>`,
        "Comenzar la noche · Enter"
      );
    }

    return result;
  };

  UIScene.prototype.__nbdIntroModalCopyPatch = true;
}

patchIntroModalCopy();
patchTutorialNarration();
