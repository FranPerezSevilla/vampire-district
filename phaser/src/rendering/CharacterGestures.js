const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};

// Visual samples only. No movement, damage, random AI decisions or new timers.
export function idleCharacterGesture(idleMs,phase=0,police=false) {
  if(idleMs<4500)return null;
  const t=((idleMs-4500+phase*370)%23000)/1000;
  if(t>5.8)return null;
  const raise=smooth(t/.8)*(1-smooth((t-3.2)/1.1));
  return {kind:police?'radio':'smoke',raise,exhale:t>2.2&&t<5.5?Math.sin((t-2.2)/3.3*Math.PI):0};
}

export function characterFallPose(elapsed,kind='shot',persistent=false,holdMs=0) {
  const fallMs=kind==='vehicle'?460:kind==='trip'?360:620;
  const down=smooth(elapsed/fallMs);
  if(persistent)return down;
  const recovery=smooth((elapsed-fallMs-holdMs)/760);
  return down*(1-recovery)*(kind==='flinch'?.28:kind==='trip'?.75:1);
}
