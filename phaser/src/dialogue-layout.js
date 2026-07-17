const SIRE_SEGMENTS = new Map([
  [
    "Mi pequeño niño, llegó el momento de que me seas útil. Cruza por los tejados y llega a la comisaría. Allí te darán un chivatazo para que puedas cazar al traidor que pretende delatarnos.",
    [
      "My little boy, the hour has come for you to prove useful.",
      "Cross the rooftops and make your way to the police station.",
      "There, one of our servants will furnish you with the traitor's whereabouts. Hunt him down before he betrays our existence."
    ]
  ],
  [
    "Alimentarte reduce tu hambre. Usar tus poderes la aumenta. No dejes que suba demasiado o perderás el control. Y no permitas que nadie te vea alimentarte: pondrías en peligro el velo que mantenemos ante los humanos.",
    [
      "Feeding tempers your Hunger. The exercise of your gifts stirs it anew.",
      "Permit it to rise too far, and the Beast shall master you.",
      "Never feed before mortal eyes. Their ignorance is the veil that preserves us."
    ]
  ],
  [
    "Acaba con él y vuelve al refugio. No la cagues.",
    ["Dispatch him, then return to the refuge. See that you do not fail me."]
  ]
]);

function installDialogueLayoutStyles() {
  if (document.getElementById("nbd-anchored-dialogue-style")) return;

  const style = document.createElement("style");
  style.id = "nbd-anchored-dialogue-style";
  style.textContent = `
    .tutorial-dialogue.actor-anchored {
      top: 0;
      width: min(420px, calc(100% - 32px));
      padding: 14px 16px 16px;
      transform: translate(-50%, calc(-100% - 18px)) scale(.96);
      transform-origin: 50% 100%;
    }

    .tutorial-dialogue.actor-anchored.open {
      transform: translate(-50%, calc(-100% - 18px)) scale(1);
    }

    .tutorial-dialogue.actor-anchored .tutorial-dialogue__speaker {
      margin-bottom: 6px;
      font-size: 10px;
    }

    .tutorial-dialogue.actor-anchored .tutorial-dialogue__text {
      font-size: clamp(16px, 1.35vw, 21px);
      line-height: 1.28;
      text-wrap: pretty;
    }

    .tutorial-dialogue.actor-anchored .tutorial-dialogue__advance {
      margin-top: 10px;
      padding-top: 8px;
      font-size: 9px;
    }

    @media (max-width: 720px) {
      .tutorial-dialogue.actor-anchored {
        width: min(340px, calc(100% - 22px));
        padding: 12px 14px 14px;
      }

      .tutorial-dialogue.actor-anchored .tutorial-dialogue__text {
        font-size: 15px;
      }
    }
  `;
  document.head.appendChild(style);
}

function speakerTarget(director, payload) {
  if (payload?.target && Number.isFinite(payload.target.x) && Number.isFinite(payload.target.y)) {
    return payload.target;
  }

  if (payload?.targetId) {
    const target = director.scene.npcSystem?.npcs?.find(npc => npc.id === payload.targetId);
    if (target) return target;
  }

  const speaker = String(payload?.speaker || "").toLowerCase();
  if (payload?.kind === "thug" || speaker.includes("matón") || speaker.includes("thug")) {
    return director.scene.npcSystem?.npcs?.find(npc => npc.id === "rooftop_thug") || director.scene.player;
  }

  // Spoken lines and sire thoughts both originate from the player on screen.
  return director.scene.player;
}

function positionDialogue(director, dialogue, payload) {
  const host = document.getElementById("game-ui") || document.querySelector(".game-frame");
  const camera = director.scene.cameras.main;
  const target = speakerTarget(director, payload);
  if (!host || !camera || !target) return;

  dialogue.classList.add("actor-anchored");

  const scaleX = host.clientWidth / camera.width;
  const scaleY = host.clientHeight / camera.height;
  const screenX = (target.x - camera.worldView.x) * camera.zoom * scaleX;
  const screenY = (target.y - camera.worldView.y) * camera.zoom * scaleY;
  const halfWidth = Math.max(120, dialogue.offsetWidth / 2);
  const safeX = Phaser.Math.Clamp(screenX, halfWidth + 10, host.clientWidth - halfWidth - 10);
  const bubbleHeight = Math.max(80, dialogue.offsetHeight);
  const safeAnchorY = Phaser.Math.Clamp(screenY - 26, bubbleHeight + 16, host.clientHeight - 28);

  dialogue.style.left = `${safeX}px`;
  dialogue.style.top = `${safeAnchorY}px`;
}

function splitSireText(payload) {
  const explicit = SIRE_SEGMENTS.get(payload?.text);
  if (explicit) return explicit;

  const isSire = payload?.kind === "thought" || /sire|maestro/i.test(String(payload?.speaker || ""));
  const text = String(payload?.text || "").trim();
  if (!isSire || text.length < 115) return [text];

  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(sentence => sentence.trim()).filter(Boolean) || [text];
  const segments = [];
  let current = "";

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (current && candidate.length > 105) {
      segments.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
  }

  if (current) segments.push(current);
  return segments;
}

function installAnchoredDialogue() {
  const scene = window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene");
  const director = scene?.tutorialDirector;

  if (!director?.showDialogue?.__nbdEnglishPersistentDialoguePatch) {
    window.requestAnimationFrame(installAnchoredDialogue);
    return;
  }
  if (director.showDialogue.__nbdAnchoredDialoguePatch) return;

  installDialogueLayoutStyles();
  const originalShowDialogue = director.showDialogue.bind(director);

  const showAnchoredDialogue = async function showAnchoredDialogue(payload = {}) {
    const dialogue = this.ui?.dialogue;
    const segments = splitSireText(payload);

    for (const segment of segments) {
      const segmentPayload = { ...payload, text: segment };
      const reposition = () => {
        if (dialogue?.classList.contains("open")) positionDialogue(this, dialogue, segmentPayload);
      };

      this.scene.events.on(Phaser.Scenes.Events.UPDATE, reposition);
      window.requestAnimationFrame(() => positionDialogue(this, dialogue, segmentPayload));

      try {
        await originalShowDialogue(segmentPayload);
      } finally {
        this.scene.events.off(Phaser.Scenes.Events.UPDATE, reposition);
        dialogue?.classList.remove("actor-anchored");
        if (dialogue) {
          dialogue.style.left = "";
          dialogue.style.top = "";
        }
      }
    }
  };

  showAnchoredDialogue.__nbdEnglishCopyPatch = true;
  showAnchoredDialogue.__nbdEnglishPersistentDialoguePatch = true;
  showAnchoredDialogue.__nbdAnchoredDialoguePatch = true;
  director.showDialogue = showAnchoredDialogue;
}

installAnchoredDialogue();
