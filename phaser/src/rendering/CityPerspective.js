import {viewportPerspectiveLimit} from './WorldScale.js';

export const CITY_PERSPECTIVE=Object.freeze({eastWest:1,northSouth:1});
export const CITY_PERSPECTIVE_MAX=20;
export function perspectiveMagnitude(value){return Number.isFinite(value)?Math.max(0,Math.min(CITY_PERSPECTIVE_MAX,value)):1;}
const CLASSIC_AXES=Object.freeze({eastWest:4,northSouth:4});
export const cityPerspectiveLimit=camera=>viewportPerspectiveLimit(camera,CLASSIC_AXES);
export const cityPerspectiveReach=(settings=CITY_PERSPECTIVE)=>1.65*Math.max(perspectiveMagnitude(settings.eastWest),perspectiveMagnitude(settings.northSouth));

// Classic radial projection around the camera centre, shared by every height plane.
// Keep the classic viewport envelope fixed BEFORE applying the experimental axis
// gains; recomputing it from the sliders would cancel their increased magnitude.
export function cityPerspectiveAt(x,y,camera,out={},settings=CITY_PERSPECTIVE){
 const limit=settings.limit??cityPerspectiveLimit(camera);
 out.spreadX=4*limit*perspectiveMagnitude(settings.eastWest)/1505;
 out.spreadY=4*limit*perspectiveMagnitude(settings.northSouth)/1505;
 out.x=(x-camera.scrollX-camera.width/2)*out.spreadX;
 out.y=(y-camera.scrollY-camera.height/2)*out.spreadY;
 return out;
}
