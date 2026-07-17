import { UIScene } from "./scenes/UIScene.js";

const SPEAKERS = new Map([
  ["NARRADOR", "NARRATOR"],
  ["TÚ", "YOU"],
  ["TU SIRE · EN TU MENTE", "YOUR SIRE · IN YOUR MIND"],
  ["MATÓN", "THUG"]
]);

const DIALOGUE = new Map([
  [
    "Hace varias décadas que fuiste convertido. Entre los vampiros no eres más que un torpe chiquillo que aún está aprendiendo. Te limitas a hacer recados e ir de acá para allá. Te sientes atrapado en una no-vida que prometía ser mucho más emocionante de lo que realmente es.",
    "You were turned several decades ago. Among vampires, you are still little more than a clumsy fledgling with much to learn. You spend your nights running errands and being sent from one place to another. You feel trapped in an unlife that promised to be far more exciting than it truly is."
  ],
  [
    "Otra noche más. Igual que la anterior. Igual que la que vendrá. Estoy... atrapado.",
    "Another night. Just like the last one. Just like the next. I am... trapped."
  ],
  ["Mi maestro... escucho su llamada.", "My master... I hear his call."],
  [
    "Mi pequeño niño, llegó el momento de que me seas útil. Cruza por los tejados y llega a la comisaría. Allí te darán un chivatazo para que puedas cazar al traidor que pretende delatarnos.",
    "My little boy, it is time for you to be useful. Cross the rooftops and reach the police station. Someone there will give you a tip, and then you can hunt down the traitor who means to expose us."
  ],
  [
    "No dejes que nadie se interponga en tu camino. Elimina a ese desgraciado.",
    "Let no one stand in your way. Deal with that miserable fool."
  ],
  ["No te dejaré pasar.", "I will not let you pass."],
  [
    "Alimentarte reduce tu hambre. Usar tus poderes la aumenta. No dejes que suba demasiado o perderás el control. Y no permitas que nadie te vea alimentarte: pondrías en peligro el velo que mantenemos ante los humanos.",
    "Feeding lowers your Hunger. Using your powers raises it. Do not let it climb too high, or you will lose control. And never let anyone see you feed: you would endanger the veil that keeps humanity blind to us."
  ],
  ["Acaba con él y vuelve al refugio. No la cagues.", "Finish him and return to the refuge. Do not screw this up."],
  [
    "Lo tienes cerca. Aísla al traidor y acaba con él. Que ningún humano vea lo que realmente eres.",
    "He is close. Isolate the traitor and finish him. Do not let any human see what you truly are."
  ],
  [
    "Ya está hecho. Vuelve al refugio y dame tu informe antes del amanecer. No me hagas esperar.",
    "It is done. Return to the refuge and report before dawn. Do not keep me waiting."
  ]
]);

const TIPS = new Map([
  [
    "Pulsa flechas o WASD para moverte. Pulsa ESPACIO para correr y para saltar de tejado en tejado.",
    "Use the arrow keys or WASD to move. Hold SPACE to run and press SPACE near an edge to jump from rooftop to rooftop."
  ],
  [
    "Acércate al matón. Por ahora, solo el movimiento está disponible.",
    "Approach the thug. For now, only movement is available."
  ],
  [
    "Pulsa E para drenar al objetivo. Durante este tutorial, es la única acción ofensiva disponible.",
    "Press E to drain the target. During this tutorial, it is your only offensive action."
  ],
  [
    "Cruza hasta la comisaría con ESPACIO y pulsa E para recoger el chivatazo.",
    "Reach the police station using SPACE, then press E to collect the tip."
  ],
  [
    "Puedes usar ESPACIO para saltar entre edificios, subir o bajar escaleras de incendios y acceder a las cloacas.",
    "Use SPACE to jump between buildings, climb or descend fire escapes, and enter the sewers."
  ]
]);

function translateKey(key) {
  return String(key || "")
    .replaceAll("ESPACIO", "SPACE")
    .replaceAll("TÚ", "YOU");
}

function installEnglishTutorialCopy() {
  const gameScene = window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene");
  const director = gameScene?.tutorialDirector;

  if (!director) {
    window.requestAnimationFrame(installEnglishTutorialCopy);
    return;
  }

  if (!director.showDialogue.__nbdEnglishCopyPatch) {
    const originalShowDialogue = director.showDialogue.bind(director);
    const patchedShowDialogue = function showDialogueInEnglish(payload = {}) {
      return originalShowDialogue({
        ...payload,
        speaker: SPEAKERS.get(payload.speaker) || payload.speaker,
        text: DIALOGUE.get(payload.text) || payload.text
      });
    };
    patchedShowDialogue.__nbdEnglishCopyPatch = true;
    director.showDialogue = patchedShowDialogue;
  }

  if (!director.setTip.__nbdEnglishCopyPatch) {
    const originalSetTip = director.setTip.bind(director);
    const patchedSetTip = function setTipInEnglish(key, text, duration = 0) {
      return originalSetTip(translateKey(key), TIPS.get(text) || text, duration);
    };
    patchedSetTip.__nbdEnglishCopyPatch = true;
    director.setTip = patchedSetTip;
  }
}

function installEnglishIntroModal() {
  if (!UIScene.prototype.__nbdIntroModalCopyPatch) {
    window.requestAnimationFrame(installEnglishIntroModal);
    return;
  }
  if (UIScene.prototype.__nbdEnglishIntroModalPatch) return;

  const originalRenderModal = UIScene.prototype.renderModal;
  UIScene.prototype.renderModal = function renderModalInEnglish(data) {
    const result = originalRenderModal.call(this, data);

    if (this.introOpen) {
      this.setModal(
        "Night Blood District",
        `<p><strong>Your unlife began decades ago.</strong></p><p>Among vampires, you are still little more than a clumsy fledgling, useful for errands and minor jobs.</p><p>Start the night and listen for your sire's call.</p>`,
        "Begin the night · Enter"
      );
    }

    return result;
  };

  UIScene.prototype.__nbdEnglishIntroModalPatch = true;
}

installEnglishIntroModal();
installEnglishTutorialCopy();
