import * as THREE from '../vendor/three.module.js';
import { levelPoint, LEVELS } from './arche-levels.js';

// Traced desk/separator centre lines on p.7, cross-checked against p.11
// partial plan and p.16 sections. Planting sits above ribbed timber screens.
export const OFFICE_CURVES=[
  [[361,232],[404,239],[453,285],[548,245],[651,249],[688,294]],
  [[361,316],[428,349],[525,333],[626,355],[655,399]],
  [[382,400],[449,445],[541,420],[627,445],[667,514]],
  [[694,252],[678,311],[704,371],[684,451],[705,518]]
];
export function buildLevelDetails({basement,first,box,mesh,wall,materials}){
  const {wood,stone,green,dark,bronze}=materials,y=LEVELS.first.y;
  const curvePath=points=>new THREE.CatmullRomCurve3(points.map(p=>{const [x,z]=levelPoint(7,...p);return new THREE.Vector3(x,0,z);}));
  const desk=(parent,x,z,base,angle=0)=>{
    const top=box(parent,stone,x,base+.76,z,.67,.07,.40,'Desk / p.11');top.rotation.y=angle;
    const foot=box(parent,dark,x,base+.37,z,.07,.74,.30,'Desk support');foot.rotation.y=angle;
    const screen=box(parent,dark,x,base+.95,z-.08,.24,.22,.025,'Office monitor');screen.rotation.y=angle;
    box(parent,green,x,base+.43,z+.30,.29,.09,.27,'Office chair');
  };
  for(const points of OFFICE_CURVES){
    const path=curvePath(points),samples=path.getPoints(48);
    for(let i=1;i<samples.length;i++){
      const a=samples[i-1],b=samples[i];
      wall(first,wood,[a.x,a.z],[b.x,b.z],y,1.08,.10,'Curved timber separator / p.11');
      wall(first,green,[a.x,a.z],[b.x,b.z],y+1.08,.17,.19,'Planted separator / p.16');
      if(i%2===0)box(first,bronze,a.x,y+.54,a.z,.022,1.08,.12,'Timber rib');
    }
    for(const t of [.15,.38,.61,.84]){
      const p=path.getPoint(t),tangent=path.getTangent(t);
      desk(first,p.x-tangent.z*.36,p.z+tangent.x*.36,y,-Math.atan2(tangent.z,tangent.x));
    }
    // Organic glass-block floor inserts from p.9 / p.11, under the desk runs.
    const shape=new THREE.Shape();
    const edge=path.getPoints(40).map((p,i)=>{const t=path.getTangent(i/40),w=Math.sin(Math.PI*i/40)*.31;return [p.x-t.z*w,-p.z-t.x*w];});
    const back=path.getPoints(40).map((p,i)=>{const t=path.getTangent(i/40),w=Math.sin(Math.PI*i/40)*.31;return [p.x+t.z*w,-p.z+t.x*w];}).reverse();
    [...edge,...back].forEach(([x,z],i)=>i?shape.lineTo(x,z):shape.moveTo(x,z));shape.closePath();
    const g=new THREE.ShapeGeometry(shape);g.rotateX(-Math.PI/2);
    mesh(first,g,green,'Organic glass-block inset / p.9',y+.025);
  }
  const [cx,cz]=levelPoint(7,345,390);
  for(let j=0;j<3;j++){
    const r=.47+j*.19,g=new THREE.CylinderGeometry(r,r,.14,48,1,false,.25,Math.PI*1.58);
    const o=mesh(first,g,stone,'Tiered reading bench / p.11',y+.07+j*.14);o.position.x=cx;o.position.z=cz;
  }
  // Kitchen L, southwest executive suite, HR desk and southeast meeting table.
  for(const [x,z,w,d] of [[-3.5,-4.0,1.5,.35],[-4.15,-3.25,.35,1.5]])box(first,wood,x,y+.44,z,w,.88,d,'Kitchen / p.7');
  for(const p of [[-2.95,3.25],[1.4,3.1]])desk(first,...p,y);
  box(first,stone,5.10,y+.77,3.75,1.3,.1,1.5,'First-floor meeting table / p.7');
  for(let i=0;i<3;i++)for(const side of [-1,1])box(first,green,5.1+side*.86,y+.43,3.2+i*.52,.3,.1,.3,'Meeting chair');
  for(const [x,z] of [[-1.9,3.9],[-1.9,4.4]])box(first,green,x,y+.32,z,1.35,.64,.38,'CEO seating / p.2');

  // p.6 / p.10: laboratory benches north, model-making tables west, staff
  // kitchen and round refectory tables in the recessed southern enclosure.
  const by=LEVELS.basement.y;
  for(const [x,z] of [[-3.4,-3.2],[-.8,-3.1],[1.8,-3.1],[-3.4,.2],[-3.4,1.8]]){
    box(basement,stone,x,by+.76,z,.9,.08,.65,'Laboratory / workshop bench');
    box(basement,wood,x,by+.35,z,.7,.7,.48,'Laboratory storage');
  }
  box(basement,wood,.5,by+.44,1.2,2.0,.88,.35,'Staff kitchen / p.6');
  for(const [x,z] of [[-.7,2.45],[.65,2.45]]){
    const o=mesh(basement,new THREE.CylinderGeometry(.29,.29,.08,24),stone,'Refectory table',by+.75);o.position.x=x;o.position.z=z;
  }
  // Ceiling/service rhythm from pp.8–10, expressed as small luminaires and
  // ventilation slots; solid ceiling planes are sectioned away for plan reading.
  for(const [parent,level] of [[basement,LEVELS.basement],[first,LEVELS.first]]){
    for(const x of [-3.3,-1.3,.8,2.7,5.2])for(const z of [-3.4,-1.9,.2,2.4]){
      const o=mesh(parent,new THREE.CylinderGeometry(.07,.07,.025,12),bronze,'Ceiling light / pp.9–10',level.y+level.clear-.06);o.position.x=x;o.position.z=z;
    }
    for(const x of [-3.8,2.9,5.6])box(parent,dark,x,level.y+level.clear-.1,-3.8,.44,.025,.09,'Ceiling service slot');
  }
}
