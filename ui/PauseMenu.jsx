import React, { useState } from "react";
import { Button } from "./components.jsx";
const actions={w:"Forward",a:"Left",s:"Back",d:"Right",quiet:"Quiet movement",interact:"Interact",traverse:"Traverse / handbrake",drain:"Feed (hold)",horn:"Horn",whisper:"Whisper",beast:"Give In"};
export function PauseMenu({s,command}) {
 const [loading,setLoading]=useState(false);
 return <section className="vb-section nb-pause">
  <div className="vb-actions"><Button primary onClick={()=>command("close")}>Resume</Button><Button onClick={()=>command("save-game")}>Save game</Button><Button onClick={()=>setLoading(true)}>Load game</Button></div>
  {loading && <div role="alert"><p>Load your saved game? Unsaved progress will be lost.</p><Button onClick={()=>command("load-game")}>Load saved game</Button><Button onClick={()=>setLoading(false)}>Cancel</Button></div>}
  <p role="status">{s.feedback}</p><p>Save keeps your progress, blood, money and the clock. Loading returns you to the refuge.</p>
  <details className="vb-controls"><summary>Settings</summary><Button aria-pressed={s.highContrast} onClick={()=>command("contrast")}>High-contrast aim: {s.highContrast?"On":"Off"}</Button></details>
  <details className="vb-controls"><summary>Edit controls</summary><p>B · Black Book. Esc · pause. Changes apply after reloading; save first.</p>
   <div className="vb-binding-list">{Object.entries(actions).map(([id,label])=><label key={id}>{label}<input aria-label={label} value={s.inputBindings[id]||""} readOnly onKeyDown={e=>{e.preventDefault();e.stopPropagation();const code=e.code.startsWith("Key")?e.code.slice(3):e.code==="Space"?"SPACE":e.code==="ShiftLeft"?"SHIFT":e.code.toUpperCase();command("rebind",{action:id,code});}}/></label>)}</div>
  </details>
  <details className="vb-controls"><summary>Credits</summary><p>VICEBLOOD — Fran Pérez Sevilla / Frainzzel. Built with Phaser.</p><p>Intro: EL (gothic version), Andres Rodriguez / anrocomposer — Pixabay.</p><p>Main menu: After the Last Light, original music for ViceBlood. Distant engine: freesounds123 / Pixabay.</p></details>
 </section>;
}
