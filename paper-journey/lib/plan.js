import { drawnTexture } from '../localized-texture.js';
import * as THREE from '../vendor/three.module.js';
import { rectSegments, mergeGeometries } from './core.js';
import { PAPER_SIZE } from './timeline.js';
import { WALL_DATA, FURNITURE_DATA, CIRCLES, MUSEUM, OUTLINE } from './arche-data.js';
import { LEVELS, PARTITIONS, CORE, DESK_PLAN_OFFSET } from './arche-levels.js';
export { CIRCLES, MUSEUM, OUTLINE } from './arche-data.js';

// One source coordinate system for paper, solid ink, floor and architecture.
// Presentation scale is uniform; the PDF's printed 1:50 is not a web scale.
export const WALL_HEIGHT = 3.23;
export const WALLS = WALL_DATA;
export const FOOTPRINTS = FURNITURE_DATA;
export const DIMENSIONS = [];
export const PX_PER_M = 2048 / PAPER_SIZE[0];

export function arcPoints(cx, cz, radius, a, b, steps = 48) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = a + (b - a) * i / steps;
    return [cx + Math.cos(t) * radius, cz + Math.sin(t) * radius];
  });
}
export const pathSegments = points => points.slice(1).map((p, i) => [...points[i], ...p]);
export function museumOutlines() {
  const { centre: [x,z], inner, outer, openings: gap } = MUSEUM;
  return [0, Math.PI].map(a => {
    const p = [...arcPoints(x,z,outer,a+gap,a+Math.PI-gap), ...arcPoints(x,z,inner,a+Math.PI-gap,a+gap)];
    return [...p,p[0]];
  });
}
export const wallSegments = () => WALLS.flatMap(([w,d,x,z]) => rectSegments(x-w/2,z-d/2,w,d));
export const furnitureSegments = () => [
  ...FOOTPRINTS.flatMap(([x,z,w,d]) => rectSegments(x,z,w,d)),
  ...CIRCLES.flatMap(([x,z,r]) => pathSegments(arcPoints(x,z,r,0,Math.PI*2))),
  ...museumOutlines().flatMap(pathSegments)
];
function stripGeometry(segments, width) {
  return mergeGeometries(segments.map(([x1,z1,x2,z2]) => {
    const dx=x2-x1, dz=z2-z1;
    const g=new THREE.BoxGeometry(Math.hypot(dx,dz)+width,1,width);
    g.translate(0,.5,0); g.rotateY(Math.atan2(-dz,dx)); g.translate((x1+x2)/2,0,(z1+z2)/2);
    return g;
  }));
}
export function buildDrawing() {
  const group=new THREE.Group();
  const ink=(color,width,segments) => {
    const m=new THREE.Mesh(stripGeometry(segments,width),new THREE.MeshStandardMaterial({color,roughness:.9,envMapIntensity:.5,transparent:true,opacity:0}));
    m.position.y=.003; m.castShadow=true; m.receiveShadow=true; m.renderOrder=2; group.add(m); return m;
  };
  return {group,heavy:ink('#2b2d26',.025,wallSegments()),medium:ink('#4a4e43',.018,furnitureSegments())};
}

// The opening sheet is the basement, traced from PDF p.06. The registered
// source image is the floor-print mesh directly above this paper; these lines
// keep the drawing legible before that image finishes loading.
export function sheetTexture() {
  const draw=(c,W,H) => {
    const S=PX_PER_M,
      px=x=>W/2+(x+DESK_PLAN_OFFSET.x)*S,
      pz=z=>H/2+(z+DESK_PLAN_OFFSET.z)*S;
    c.fillStyle='#ffffff'; c.fillRect(0,0,W,H);
    c.strokeStyle='#454545'; c.lineWidth=1.2; c.strokeRect(30,30,W-60,H-60);
    const line=points=>{c.beginPath();points.forEach(([x,z],i)=>i?c.lineTo(px(x),pz(z)):c.moveTo(px(x),pz(z)));c.stroke();};
    c.strokeStyle='#242424'; c.lineWidth=2.4;
    line([...LEVELS.basement.outline,LEVELS.basement.outline[0]]);
    c.lineWidth=1.35;
    for(let i=0;i<PARTITIONS.basement.length;i+=2)line([PARTITIONS.basement[i],PARTITIONS.basement[i+1]]);
    for(const {x,z,w,d} of [CORE.stair,CORE.lift])c.strokeRect(px(x),pz(z),w*S,d*S);
    const tx=W/2-205,ty=H-218;
    c.textAlign='left'; c.strokeStyle='#333333'; c.lineWidth=1.6;
    c.strokeRect(tx,ty,410,160); c.beginPath(); c.moveTo(tx,ty+56);c.lineTo(tx+410,ty+56);c.stroke();
    c.fillStyle='#171717';c.font='34px Georgia';c.fillText('ARCHÉ',tx+18,ty+38);
    c.font='16px Georgia';c.fillText('BASEMENT FLOOR / TECHNICAL PLAN',tx+18,ty+84);
    c.fillText('SOURCE P.06 · 1:50 ORIGINAL · FITTED VIEW',tx+18,ty+110);
    c.fillText('EYLÜL YILDIZ · INTERIOR ARCHITECTURE',tx+18,ty+136);
    c.font='18px Georgia';c.fillStyle='#444444';
    c.fillText('ARCHÉ / DIGITAL INNOVATION & CULTURAL HERITAGE',60,82);
    c.font='15px Georgia';c.fillText('BASEMENT FLOOR · LABORATORIES / ARCHIVE / WORKSHOP',60,112);
  };
  return drawnTexture(2048,1408,draw);
}
