import { drawnTexture } from '../localized-texture.js';
import * as THREE from '../vendor/three.module.js';
import { LEVELS, CORE, levelPoint } from './arche-levels.js';
import { SOURCE } from './arche-data.js';
import { ARCHITECTURAL_Y } from './assembly.js';
export const PRINTS={
  ground:{page:5,bounds:[136,140,923,740],file:'arche-ground-plan.webp'},
  basement:{page:6,bounds:[240,175,960,785],file:'arche-basement-plan.webp'},
  first:{page:7,bounds:[205,175,950,805],file:'arche-first-plan.webp'}
};
export function buildLevelLabel(key){
  const group=new THREE.Group();group.name=key+' level annotation';
  if(typeof document==='undefined')return group;
  const level=LEVELS[key];
  const map=drawnTexture(640,128,c=>{
    c.fillStyle='#eeeade';c.fillRect(0,0,640,128);c.fillStyle='#46473b';
    c.font='42px Georgia';c.fillText(level.name.toUpperCase(),18,53);
    c.font='27px monospace';c.fillText('ARCHÉ / PDF '+String(level.page).padStart(2,'0'),18,100);
  });
  const label=new THREE.Sprite(new THREE.SpriteMaterial({map,depthTest:false,depthWrite:false,toneMapped:false}));
  label.scale.set(3.5,.7/ARCHITECTURAL_Y,1);label.center.set(1,.5);
  label.position.set(-5.3,level.y+.3,5.2);label.renderOrder=10;group.add(label);
  return group;
}
export function buildFloorPrint(key){
  const level=LEVELS[key],source=PRINTS[key],shape=new THREE.Shape();
  (level.slab||level.outline).forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
  if(key!=='basement')for(const {x,z,w,d} of [CORE.stair,CORE.lift]){
    const hole=new THREE.Path();hole.moveTo(x,-z);hole.lineTo(x+w,-z);hole.lineTo(x+w,-z-d);hole.lineTo(x,-z-d);hole.closePath();shape.holes.push(hole);
  }
  const geo=new THREE.ShapeGeometry(shape);geo.rotateX(-Math.PI/2);
  const pos=geo.attributes.position,uv=new Float32Array(pos.count*2),[x0,z0,x1,z1]=source.bounds;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i);
    let sx,sz;
    if(key==='ground'){sx=x/SOURCE.scale+SOURCE.centre[0];sz=z/SOURCE.scale+SOURCE.centre[1];}
    else{
      const anchor=key==='first'?730:768;
      const a=levelPoint(source.page,anchor,190),step=levelPoint(source.page,anchor+(x>=3.417?1:-1),191);
      sx=anchor+(x-a[0])/Math.abs(step[0]-a[0]);sz=190+(z-a[1])/(step[1]-a[1]);
    }
    uv[i*2]=(sx-x0)/(x1-x0);uv[i*2+1]=1-(sz-z0)/(z1-z0);
  }
  geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  const material=new THREE.MeshBasicMaterial({color:'#eee8d9',toneMapped:false,transparent:true,depthWrite:false,opacity:0,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1});
  const drawing=new THREE.Mesh(geo,material);drawing.name=level.name+' technical drawing / p.'+source.page;drawing.position.y=.018;drawing.receiveShadow=true;
  if(typeof document!=='undefined')new THREE.TextureLoader().load(new URL('../assets/'+source.file,import.meta.url).href,t=>{
    t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;material.map=t;material.needsUpdate=true;
  });
  return drawing;
}
