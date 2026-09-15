/** Owns the single title media element. No dependency on Phaser's frame loop. */
export function createMenuThemePlayback(audio, {
  volume = 0.28, fadeMs = 430, windowRef = globalThis.window,
  clock = globalThis.performance
} = {}) {
  let raf = 0, timer = null, wantsPlayback = false, generation = 0;
  const cancelFade = () => {
    if (raf) windowRef.cancelAnimationFrame(raf);
    if (timer !== null) windowRef.clearTimeout(timer);
    raf = 0; timer = null;
  };
  const stop = () => {
    wantsPlayback = false;
    generation++;
    cancelFade();
    audio.pause();
    try { audio.currentTime = 0; } catch {}
    audio.volume = volume;
  };
  const start = async () => {
    const token = ++generation;
    wantsPlayback = true;
    cancelFade();
    audio.loop = true;
    audio.volume = volume;
    try {
      if (audio.paused) await audio.play();
      // A delayed play() resolution must not resurrect the title after Start.
      if (!wantsPlayback) audio.pause();
      return wantsPlayback && token === generation;
    } catch { return false; }
  };
  const fadeOut = (durationMs = fadeMs) => {
    wantsPlayback = false;
    const token = ++generation;
    cancelFade();
    if (audio.paused) { stop(); return; }
    const duration = Math.max(1, Number(durationMs) || fadeMs);
    const from = audio.volume, began = clock.now();
    const tick = now => {
      if (token !== generation) return;
      const t = Math.max(0, Math.min(1, (now - began) / duration));
      audio.volume = Math.max(0, from * (1 - t));
      if (t === 1) stop();
      else raf = windowRef.requestAnimationFrame(tick);
    };
    // Animation can be throttled or interrupted; fade must still end in silence.
    timer = windowRef.setTimeout(() => { if (token === generation) stop(); }, duration + 50);
    raf = windowRef.requestAnimationFrame(tick);
  };
  return Object.freeze({ start, fadeOut, stop, audio });
}
