// Shared presentation layout. No gameplay destinations or collision are authored here.
// Buildings may override with multiple {id, side, at} entries (at is 0..1 on the wall).
const layouts={hospital:[{id:'main',side:'south',at:.5}]};
const EMPTY=Object.freeze([]);
export function buildingEntrances(b){
 if(!b?.entrances)return layouts[b?.id]||EMPTY;
 return b.entrances.filter(d=>['north','south','east','west'].includes(d.side)&&Number.isFinite(d.at)&&d.at>=0&&d.at<=1);
}
export function entrancePosition(b,d){
 const vertical=d.side==='east'||d.side==='west';
 return {x:vertical?b.x+(d.side==='east'?b.w:0):b.x+b.w*d.at,
 y:vertical?b.y+b.h*d.at:b.y+(d.side==='south'?b.h:0),
 nx:d.side==='east'?1:d.side==='west'?-1:0,ny:d.side==='south'?1:d.side==='north'?-1:0};
}
