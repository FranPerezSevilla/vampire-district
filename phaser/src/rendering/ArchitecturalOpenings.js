// Draw at facade resolution: structural edges do not contain baked photographic bloom.
export function drawLancet(ctx,x,y,w,h,lit=false){
 ctx.save();ctx.translate(x,y);ctx.scale(w,h);ctx.globalAlpha=1;
 const arch=(inset,color)=>{ctx.beginPath();ctx.moveTo(inset,1-inset);ctx.lineTo(inset,.32);ctx.quadraticCurveTo(inset,.17,.5,inset);ctx.quadraticCurveTo(1-inset,.17,1-inset,.32);ctx.lineTo(1-inset,1-inset);ctx.closePath();ctx.fillStyle=color;ctx.fill();};
 arch(0,'#141c1c');arch(.035,'#827e6c');arch(.09,'#353e39');arch(.14,lit?'#b79759':'#101e22');
 ctx.fillStyle=lit?'#e5cc8b':'#435755';ctx.fillRect(.19,.35,.025,.48);
 ctx.fillStyle='#262e2a';ctx.fillRect(.47,.22,.06,.66);ctx.fillRect(.16,.56,.68,.035);
 ctx.fillRect(.29,.74,.025,.14);ctx.fillRect(.69,.74,.025,.14);
 ctx.fillStyle='#a09a81';ctx.fillRect(0,.97,1,.03);ctx.restore();
}

export function drawPortal(ctx,x,y,w,h,lit=false){
 ctx.save();ctx.translate(x,y);ctx.scale(w,h);ctx.globalAlpha=1;
 ctx.fillStyle='#101919';ctx.fillRect(0,0,1,1);
 ctx.fillStyle='#777765';ctx.fillRect(0,0,1,.055);ctx.fillRect(0,0,.065,1);ctx.fillRect(.935,0,.065,1);
 ctx.fillStyle='#283732';ctx.fillRect(.09,.08,.82,.84);
 ctx.fillStyle='#607069';ctx.fillRect(.13,.12,.33,.52);ctx.fillRect(.54,.12,.33,.52);
 ctx.fillStyle=lit?'#d3b879':'#162722';ctx.fillRect(.16,.16,.27,.44);ctx.fillRect(.57,.16,.27,.44);
 ctx.fillStyle=lit?'#f4dfac':'#9ba38b';ctx.fillRect(.16,.16,.015,.44);ctx.fillRect(.57,.16,.015,.44);
 ctx.fillStyle='#b6a576';ctx.fillRect(.43,.69,.025,.14);ctx.fillRect(.545,.69,.025,.14);
 ctx.fillStyle='#70776b';ctx.fillRect(.48,.08,.04,.85);ctx.fillRect(-.04,.94,1.08,.06);
 ctx.fillStyle='#9d967d';ctx.fillRect(-.04,.94,1.08,.018);ctx.restore();
}
