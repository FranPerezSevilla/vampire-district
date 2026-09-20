// Phaser updates camera follow inside preRender, after the scene's prerender event.
// Project architecture after that update, before visible children are collected.
export function afterCameraProjection(camera,callback){
 const original=camera.preRender;
 function projected(...args){const result=original.apply(this,args);callback();return result;}
 camera.preRender=projected;
 return ()=>{if(camera.preRender===projected)camera.preRender=original;};
}
