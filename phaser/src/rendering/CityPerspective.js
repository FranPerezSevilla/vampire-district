import {viewportPerspectiveLimit} from './WorldScale.js';

export const CITY_PERSPECTIVE=Object.freeze({eastWest:4,northSouth:4,frontBias:.55,front:1,lateral:1,rear:1});
export const CITY_PERSPECTIVE_MAX=2.5;
export function perspectiveMagnitude(value){return Number.isFinite(value)?Math.max(0,Math.min(CITY_PERSPECTIVE_MAX,value)):1;}
const ENVELOPE=1.65;

// One affine projection for every height plane. A constant south-facing lean
// reveals the front facade without proximity triggers or per-building scaling.
// Reserve part of the radial height envelope for this bias rather than adding
// unbounded displacement to the existing maximum.
export function cityPerspectiveAt(x,y,camera,out={},settings=CITY_PERSPECTIVE){
 const bias=settings.frontBias??CITY_PERSPECTIVE.frontBias;
 const limit=settings.limit??viewportPerspectiveLimit(camera,settings);
 const radial=(ENVELOPE-bias)/ENVELOPE;
 out.spreadX=(settings.eastWest??CITY_PERSPECTIVE.eastWest)*limit*radial/1505;
 out.spreadY=(settings.northSouth??CITY_PERSPECTIVE.northSouth)*limit*radial/1505;
 // Interpolate the front/rear endpoint displacements on one affine field, rather
 // than changing projection independently for each building or side of a seam.
 const front=perspectiveMagnitude(settings.front),rear=perspectiveMagnitude(settings.rear);
 // Keep the rear anchor beyond the zero-lean line even at a close zoom. Otherwise
 // a strong front bias makes the rear slider pull forwards and can invert roofs.
 const reach=Math.max(camera.height/(camera.zoom||1)/2+160,out.spreadY>0?(bias+.45)/out.spreadY:0);
 const north=(-reach*out.spreadY-bias)*front,south=(reach*out.spreadY-bias)*rear;
 out.spreadX*=perspectiveMagnitude(settings.lateral);
 out.spreadY=(south-north)/(2*reach);
 out.x=(x-camera.scrollX-camera.width/2)*out.spreadX;
 out.y=(y-camera.scrollY-camera.height/2)*out.spreadY+(south+north)/2;
 return out;
}
