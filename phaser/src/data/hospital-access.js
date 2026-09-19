// Authored service recess; separate from the through-traffic lane graph.
export const HOSPITAL_LAYBY=Object.freeze({
 bounds:Object.freeze({x:540,y:612,w:160,h:79}),
 points:Object.freeze([{x:540,y:691},{x:540,y:618},{x:546,y:612},{x:694,y:612},{x:700,y:618},{x:700,y:691}].map(Object.freeze)),
 parking:Object.freeze({x:548,y:620,w:144,h:62})
});

// Same authored recess as the ground markings, with room for door access.
export const HOSPITAL_AMBULANCE_BAYS = Object.freeze([0,1].map(index => Object.freeze({
 x:HOSPITAL_LAYBY.parking.x+HOSPITAL_LAYBY.parking.w*(index+.5)/2,
 y:HOSPITAL_LAYBY.parking.y+HOSPITAL_LAYBY.parking.h/2,
 angle:-Math.PI/2
})));
