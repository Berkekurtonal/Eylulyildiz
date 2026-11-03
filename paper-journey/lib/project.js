import * as THREE from '../vendor/three.module.js';
import { reducible } from './core.js';
import { SLAB, PAPER_SIZE } from './timeline.js';
import { ARCHITECTURAL_Y } from './assembly.js';
import { LEVELS } from './arche-levels.js';
import { sheetTexture, buildDrawing } from './plan.js';
import { buildRoom } from './room.js';

/* ------------------------------------------------------------------ *
 *  PROJECT ORIGIN
 *
 *  ProjectOrigin
 *  ├── Paper            the sheet on the architect's desk, print and all
 *  ├── FloorSlab        separates from the paper as the plan gains depth
 *  ├── FloorPlan        rides on top of the slab
 *  │   ├── DrawingLines the printed ink's solid twin
 *  │   └── Architecture walls, glazing, furniture, ceiling, exhibition
 *  └── ProjectFocus     visual centre of the drawing; the camera's target
 *
 *  There is one project and one transform. The scene never repositions
 *  any of these children in world space; it only moves and scales the
 *  origin, so the building cannot appear anywhere but out of its sheet.
 * ------------------------------------------------------------------ */

export function buildProject() {
  const origin = new THREE.Group();
  origin.name = 'ProjectOrigin';

  const paperMat = reducible(new THREE.MeshStandardMaterial({
    map: sheetTexture(),
    // held below white: at desk-lamp range paper otherwise clips flat
    color: new THREE.Color('#ffffff'),
    roughness: .95,
    envMapIntensity: .5
  }), 'paper');
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(PAPER_SIZE[0], PAPER_SIZE[1]), paperMat);
  paper.name = 'Paper';
  paper.rotation.x = -Math.PI / 2;
  paper.position.y = -(SLAB + .004);
  paper.receiveShadow = true;
  origin.add(paper);

  const floor = new THREE.Group();
  floor.name = 'FloorPlan';
  floor.position.y = -(SLAB + .004) + .006;
  origin.add(floor);

  const drawing = buildDrawing();
  drawing.group.name = 'DrawingLines';
  floor.add(drawing.group);

  const room = buildRoom();
  floor.add(room);
  drawing.group.position.set(room.position.x,room.userData.stageY,room.position.z);
  drawing.group.visible=false; // Ground-floor linework waits above the Basement.
  room.userData.slab.position.set(room.position.x,
    floor.position.y+room.userData.stageY+LEVELS.first.y*ARCHITECTURAL_Y-SLAB*ARCHITECTURAL_Y,
    room.position.z);
  origin.add(room.userData.slab);

  // The ending resolves into the source PDF's monochrome basement technical
  // sheet. It is in the same scene so Project 01 captures the actual frame.
  const technicalMaterial=new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,
    opacity:0,depthTest:false,depthWrite:false,toneMapped:false});
  const technicalSheet=new THREE.Mesh(new THREE.PlaneGeometry(PAPER_SIZE[0],PAPER_SIZE[1]),technicalMaterial);
  technicalSheet.name='ARCHÉ / PDF p.06 technical sheet';
  technicalSheet.rotation.x=-Math.PI/2;
  technicalSheet.renderOrder=1000;
  technicalSheet.visible=false;
  origin.add(technicalSheet);
  new THREE.TextureLoader().load(new URL('../assets/arche-basement-technical.png',import.meta.url).href,texture=>{
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=8;
    // The first plan and the final sheet are the same PDF-derived drawing.
    paperMat.map=texture;
    paperMat.needsUpdate=true;
    technicalMaterial.map=texture;
    technicalMaterial.needsUpdate=true;
  });

  const focus = new THREE.Object3D();
  focus.name = 'ProjectFocus';
  origin.add(focus);

  new THREE.TextureLoader().load('paper-journey/assets/arche-experience.jpg', texture => {
    texture.colorSpace = THREE.SRGBColorSpace;
    room.userData.applyImage(texture);
  });

  return { origin, paper, paperMat, floor, drawing, room, focus, technicalSheet };
}
