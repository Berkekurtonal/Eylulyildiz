import { drawnTexture } from '../localized-texture.js';
import * as THREE from '../vendor/three.module.js';
import { reducible, mergeGeometries } from './core.js';
import { WALLS, WALL_HEIGHT, FOOTPRINTS, CIRCLES, MUSEUM, OUTLINE, arcPoints, museumOutlines } from './plan.js';
import { PALETTE, GLAZING, SOURCE } from './arche-data.js';
import { buildMassing, floorGeometry } from './arche-massing.js';
import { levelMaterials, levelEmphasis, slabAppearance, interiorVisibility } from './arche-presentation.js';
import { buildFloorPrint, buildLevelLabel } from './arche-prints.js';
import { LEVELS, DESK_PLAN_OFFSET } from './arche-levels.js';
import { ARCHITECTURAL_Y } from './assembly.js';

// ARCHÉ's three-level section model. Every element is in the paper's local
// coordinates; nine construction groups retain the nine approved rise windows.
const STAGE_SCALE=SOURCE.scale/.019;
const stagePoint=(x,z)=>[x*STAGE_SCALE+STAGE_X,z*STAGE_SCALE];
const STAGE_X=(581-SOURCE.centre[0])*SOURCE.scale;
const standard=(color,extra={})=>reducible(new THREE.MeshStandardMaterial({color,roughness:.84,envMapIntensity:.35,...extra}),'project');
function place(parent,geometry,material,p=[0,0,0],rotation){
  const m=new THREE.Mesh(geometry,material);m.position.set(...p);if(rotation)m.rotation.set(...rotation);
  m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function prism(points,height){
  const s=new THREE.Shape();points.forEach(([x,z],i)=>i?s.lineTo(x,-z):s.moveTo(x,-z));s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:height,bevelEnabled:false,curveSegments:48});g.rotateX(-Math.PI/2);return g;
}
function block(parent,mat,x,y,z,w,h,d){return place(parent,new THREE.BoxGeometry(w,h,d),mat,[x,y,z]);}
function tileTexture(){
  return drawnTexture(1024,1024,(c,W,H)=>{
    c.fillStyle='#cec3ad';c.fillRect(0,0,W,H);
    // Large irregular travertine courses, as in p.2 and the coloured p.5 plan.
    for(let row=0;row<8;row++)for(let col=-1;col<7;col++){
      const seed=((row*71+col*29+43)%17+17)%17;
      c.fillStyle=['#d6cdbb','#c9bea9','#ddd3c0','#c8bfac'][seed%4];
      c.fillRect(col*180+(row%2)*90+2,row*128+2,176,124);
      c.strokeStyle='rgba(150,136,111,.17)';c.lineWidth=2;
      c.beginPath();c.moveTo(col*180+25,row*128+34);c.bezierCurveTo(col*180+90,row*128+42,col*180+120,row*128+90,col*180+168,row*128+62);c.stroke();
    }
  });
}
function labelTexture(title,detail){
  return drawnTexture(768,192,(c)=>{c.fillStyle='#ddd3c0';c.fillRect(0,0,768,192);c.fillStyle='#34332c';c.font='38px Georgia';c.fillText(title,24,73);c.font='21px Georgia';c.fillText(detail,24,118);c.fillStyle='#8b714d';c.fillRect(24,145,270,2);});
}
function waterTexture(){
  return drawnTexture(1024,512,(c,W,H)=>{const g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,'#adbcc0');g.addColorStop(.57,'#e1e2d8');g.addColorStop(.58,'#839c98');g.addColorStop(1,'#4b777c');c.fillStyle=g;c.fillRect(0,0,W,H);c.strokeStyle='rgba(237,237,210,.16)';for(let i=0;i<32;i++){c.beginPath();c.moveTo((i*97)%700,300+i*6);c.lineTo((i*97)%700+210,300+i*6);c.stroke();}});
}
export function buildRoom(){
  const group=new THREE.Group();group.name='Architecture';
  const stageY=-LEVELS.basement.y*ARCHITECTURAL_Y;
  group.position.set(DESK_PLAN_OFFSET.x,stageY,DESK_PLAN_OFFSET.z); // The PDF plan is the datum.
  group.scale.y=ARCHITECTURAL_Y;
  const presentation=levelMaterials(), material=presentation.material;
  const stone=material('stone',PALETTE.stone), plaster=material('plaster',PALETTE.plaster), timber=material('timber',PALETTE.timber), dark=material('dark',PALETTE.dark), green=material('green',PALETTE.green), bronze=material('bronze',PALETTE.bronze,{metalness:.25,roughness:.65}), fabric=material('fabric',PALETTE.fabric);
  const structure=material('structure','#747a73');
  const tile=tileTexture();tile.wrapS=tile.wrapT=THREE.RepeatWrapping;tile.repeat.set(2,2);
  const floorMat=material('plate','#c8c5bb',{map:tile,transparent:true,depthWrite:false,
    side:THREE.DoubleSide,opacity:0});
  const slabGeometry=floorGeometry(OUTLINE,1,true);
  // Extrusion UVs are projected in plan coordinates, not repeated per triangle.
  const a=slabGeometry.attributes.position,uv=new Float32Array(a.count*2);
  for(let i=0;i<a.count;i++){uv[i*2]=a.getX(i)/12;uv[i*2+1]=a.getZ(i)/12;}
  slabGeometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  // Extrusion group 0 is the cap, group 1 the cut faces (including core openings).
  const slab=new THREE.Mesh(slabGeometry,[floorMat,material('rim','#777a73')]);slab.name='FloorSlab';slab.castShadow=false;slab.receiveShadow=true;
  const slabEdges=new THREE.LineSegments(new THREE.EdgesGeometry(slabGeometry,25),
    new THREE.LineBasicMaterial({color:'#444b47',transparent:true,opacity:0}));
  slabEdges.name='Ground floor plate edges';slab.add(slabEdges);

  const meetingGlass=material('glass','#bbc2bd',{transparent:true,opacity:.09,side:THREE.DoubleSide,depthWrite:false,roughness:.4});
  const edgeMat=new THREE.MeshBasicMaterial({color:'#4e5147',transparent:true,opacity:0});
  const walls=Array.from({length:9},(_,i)=>{const g=new THREE.Group();g.name='Wall'+i;g.userData={index:i};group.add(g);return g;});
  WALLS.forEach(([w,d,x,z,rise,kind,h])=>{
    const pivot=walls[rise];
    if(kind==='glass'){
      // Z4's wood/glass partition (p.5 legend, p.2 meeting-room render).
      block(pivot,meetingGlass,x,h/2,z,w,h,d).castShadow=false;
      block(pivot,timber,x,.34,z,w,.68,d);
      const count=Math.ceil(Math.max(w,d)/.8);
      for(let i=0;i<=count;i++)block(pivot,dark,x+(w>d?(i/count-.5)*w:0),h/2,z+(d>w?(i/count-.5)*d:0),.035,h,.035);
    }else block(pivot,kind==='timber'?timber:kind==='pier'?structure:plaster,x,h/2,z,w,h,d);
    for(const sx of [-1,1])for(const sz of [-1,1])block(pivot,edgeMat,x+sx*w/2,h/2,z+sz*d/2,.014,h,.014).castShadow=false;
  });

  const glazing=new THREE.Group();glazing.name='GlazedPerimeter';group.add(glazing);
  const glass=material('glass','#bbc2bd',{transparent:true,opacity:.055,side:THREE.DoubleSide,depthWrite:false,roughness:.4});
  GLAZING.forEach(([x1,z1,x2,z2])=>{
    const length=Math.hypot(x2-x1,z2-z1),cx=(x1+x2)/2,cz=(z1+z2)/2,angle=Math.atan2(-(z2-z1),x2-x1);
    place(glazing,new THREE.PlaneGeometry(length,2.98),glass,[cx,1.65,cz],[0,angle,0]).castShadow=false;
    const count=Math.max(1,Math.ceil(length/.85));
    for(let i=0;i<=count;i++)block(glazing,dark,x1+(x2-x1)*i/count,1.65,z1+(z2-z1)*i/count,.035,3.15,.035);
    const lintel=block(glazing,dark,cx,3.18,cz,length,.09,.07);lintel.rotation.y=angle;
  });
  const outside=place(group,new THREE.PlaneGeometry(27,10),new THREE.MeshBasicMaterial({map:waterTexture(),transparent:true,opacity:0}),[0,3.3,-10.5]);outside.castShadow=false;outside.name='WaterfrontContext';

  // Suspended ceiling and structural slab follow p.15: 3.23 m clear height.
  // Upper offices and lower laboratories are structural geometry in massing.
  const ceiling=new THREE.Group();group.add(ceiling);
  const ceilMat=standard(PALETTE.plaster,{transparent:true,side:THREE.DoubleSide});
  const beamMat=standard('#726e61',{transparent:true});
  const soffit=place(ceiling,floorGeometry(OUTLINE,.12,true),ceilMat,[0,WALL_HEIGHT,0]);soffit.castShadow=false;
  for(let z=-4.8;z<5;z+=1.7)block(ceiling,beamMat,-.2*STAGE_SCALE+STAGE_X,3.12,z*STAGE_SCALE,12.1*STAGE_SCALE,.18,.12);
  ceiling.userData.materials=[ceilMat,beamMat];
  const pendant=new THREE.Group();group.add(pendant);
  for(const raw of [[-4.6,-3.9],[-4.1,-3.9],[-3.6,-3.9],[0,-3.0],[1.8,-3.0],[3.7,-3.0],[-4.8,3.8]]){
    const [x,z]=stagePoint(...raw);
    place(pendant,new THREE.CylinderGeometry(.007,.007,.68,6),dark,[x,2.88,z]);
    place(pendant,new THREE.SphereGeometry(.15,16,12),stone,[x,2.49,z]);
    place(pendant,new THREE.SphereGeometry(.15,16,8,0,Math.PI*2,0,Math.PI/2),bronze,[x,2.5,z]);
  }

  // Page 8: regular ceiling downlights supplement the pendant clusters.
  for(const x of [-3.8,-2,0,1.8,3,5])for(const z of [-3.8,-2,0,2,3.8])
    place(pendant,new THREE.CylinderGeometry(.06,.06,.025,12),bronze,[x,3.13,z]);

  const furniture=new THREE.Group();furniture.name='GroundFloorProgramme';group.add(furniture);
  function slats(parent,x,z,w,h,d){
    block(parent,timber,x,h/2,z,w,h,d);
    const strips=[];for(let a=-w/2+.04;a<w/2;a+=.095){const g=new THREE.BoxGeometry(.024,h,.035);g.translate(x+a,h/2,z+d/2+.012);strips.push(g);}
    place(parent,mergeGeometries(strips),bronze);
  }
  FOOTPRINTS.forEach(([x,z,w,d,kind])=>{
    const cx=x+w/2,cz=z+d/2;
    if(kind==='stair'){
      // Continuous flights and landings are built with the three-level core.
    }else if(kind==='lift'){
      block(furniture,dark,cx,1.2,z+.025,w*.8,2.4,.05);
      block(furniture,bronze,cx,1.2,z+.06,.02,2.4,.01);
    }else if(kind==='lobby-seat'){
      block(furniture,fabric,cx,.29,cz,w,.58,d);
      block(furniture,fabric,x+w-.05,.49,cz,.12,.68,d);
    }else if(kind==='scan-bench'){
      block(furniture,stone,cx,.37,cz,w,.74,d);
      for(const dz of [-d*.27,d*.27]){block(furniture,dark,cx,.87,cz+dz,.22,.27,.045);block(furniture,bronze,cx,.78,cz+dz,.025,.12,.05);}
    }else if(kind==='meeting'){
      block(furniture,timber,cx,.72,cz,w,.08,d);block(furniture,dark,cx,.35,cz,w*.55,.7,d*.62);
      for(let i=0;i<3;i++)for(const side of [-1,1]){const ax=cx+side*(w/2+.24),az=z+.22+i*(d-.44)/2;block(furniture,green,ax,.43,az,.32,.12,.36);block(furniture,green,ax+side*.12,.65,az,.06,.4,.36);}
    }else{
      slats(furniture,cx,cz,w,.86,d);block(furniture,stone,cx,.88,cz,w+.06,.1,d+.06);
      if(kind==='reception'){block(furniture,dark,cx+.3,1.08,cz,.34,.29,.035);block(furniture,green,cx-.5,.99,cz,.19,.12,.16);}
      if(kind==='bar')for(let i=0;i<5;i++){place(furniture,new THREE.CylinderGeometry(.11,.10,.06,16),green,[x+.23+i*(w-.46)/4,.57,z-.28]);place(furniture,new THREE.CylinderGeometry(.025,.04,.55,8),dark,[x+.23+i*(w-.46)/4,.28,z-.28]);}
    }
  });
  function plant(x,z){
    place(furniture,new THREE.CylinderGeometry(.16,.11,.3,12),stone,[x,.15,z]);
    for(let i=0;i<7;i++){const angle=i*Math.PI*2/7;const leaf=place(furniture,new THREE.SphereGeometry(1,8,6),green,[x+Math.cos(angle)*.13,.55+(i%3)*.12,z+Math.sin(angle)*.13]);leaf.scale.set(.08,.3,.04);leaf.rotation.z=Math.cos(angle)*.45;}
  }
  [[-3.1,-4.2],[-3.1,-3.5],[-3.1,-2.8],[-5.7,3.2],[4.2,-.9]].forEach(([x,z])=>plant(...stagePoint(x,z)));

  // Curved screens, ribbed timber backs, VR counters and a central model:
  // this is BFF:3/BFF:4 from pp.14–15, on its actual page-5 footprint.
  const exhibition=new THREE.Group();exhibition.name='InteractiveMuseum';group.add(exhibition);
  const plates=[],images=[];
  const imageMat=(aspect)=>{const m=new THREE.MeshBasicMaterial({color:'#bcb5a3',transparent:true,opacity:0,side:THREE.DoubleSide});m.userData.aspect=aspect;plates.push(m);images.push(m);return m;};
  // BFF:5 virtual-reality screen along the reception/exhibition spine, p.5.
  // Faces the exhibition floor; the existing camera encounters its east face.
  const spineWall=WALLS.find(w=>w[5]==='timber'), screenWidth=spineWall[1]-.2;
  const spine=place(exhibition,new THREE.PlaneGeometry(screenWidth,1.65),imageMat(screenWidth/1.65),[spineWall[2]+.06,1.42,spineWall[3]],[0,Math.PI/2,0]);
  spine.castShadow=false;
  for(let z=-4.6;z<.05;z+=.12)block(exhibition,bronze,spineWall[2]+.07,2.22,z*STAGE_SCALE,.025,.16,.026);
  const rings=museumOutlines();
  for(const side of [-1,1])for(const end of [-1,1]){
    const x=MUSEUM.centre[0]+side*(MUSEUM.outer+.22),z=MUSEUM.centre[1]+end*Math.sin(MUSEUM.openings)*MUSEUM.outer;
    block(exhibition,timber,x,1,z,.62,2,.12);
  }
  rings.forEach((outline,side)=>{
    place(exhibition,prism(outline,.75),timber);
    const [cx,cz]=MUSEUM.centre;
    const start=side*Math.PI+MUSEUM.openings,end=start+Math.PI-2*MUSEUM.openings;
    const ribParts=[];
    for(const [x,z] of arcPoints(cx,cz,MUSEUM.outer,start,end,42)){
      const r=new THREE.BoxGeometry(.035,MUSEUM.height,.04);r.translate(x,MUSEUM.height/2,z);ribParts.push(r);
    }
    place(exhibition,mergeGeometries(ribParts),timber);
    // Curved inward-facing LED surface; actual geometry, never a camera plate.
    const points=arcPoints(cx,cz,MUSEUM.inner+.04,start,end,48),v=[],uv=[];
    for(let i=0;i<points.length-1;i++){
      const [a,b]=[points[i],points[i+1]],lo=.95,hi=1.91;
      v.push(a[0],lo,a[1],b[0],lo,b[1],b[0],hi,b[1],a[0],lo,a[1],b[0],hi,b[1],a[0],hi,a[1]);
      uv.push(i/48,0,(i+1)/48,0,(i+1)/48,1,i/48,0,(i+1)/48,1,i/48,1);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();
    place(exhibition,geo,imageMat((end-start)*(MUSEUM.inner+.04)/.96)).castShadow=false;
    for(const t of [.29,.71]){
      const angle=start+(end-start)*t,x=cx+Math.cos(angle)*(MUSEUM.inner+.12),z=cz+Math.sin(angle)*(MUSEUM.inner+.12);
      const console=block(furniture,dark,x,.79,z,.35,.06,.25);console.rotation.y=-angle;
      const headset=place(furniture,new THREE.SphereGeometry(.11,12,8),dark,[x,.9,z]);headset.scale.set(1,.7,.65);
      const strap=place(furniture,new THREE.TorusGeometry(.1,.013,6,20),dark,[x,.92,z+.05]);strap.rotation.x=Math.PI/2;
    }
    for(const angle of [start,end]){
      const x=cx+Math.cos(angle)*(MUSEUM.inner+.14),z=cz+Math.sin(angle)*(MUSEUM.inner+.14);
      block(exhibition,timber,x,1,z,.28,2,.16);
      const m=new THREE.MeshBasicMaterial({map:labelTexture('ARCHÉ','VR / MODEL / SCAN'),transparent:true,opacity:0});plates.push(m);
      place(exhibition,new THREE.PlaneGeometry(.23,.55),m,[x,1.28,z+.09]).castShadow=false;
    }
  });

  // Circular artefact / 3D scanning plinths, not residential furnishings.
  CIRCLES.forEach(([x,z,r,kind],i)=>{
    if(kind==='table'){place(furniture,new THREE.CylinderGeometry(r,r,.07,24),stone,[x,.42,z]);return;}
    place(furniture,new THREE.CylinderGeometry(r,r,.25,36),dark,[x,.125,z]);
    place(furniture,new THREE.CylinderGeometry(r*.68,r*.68,.06,32),stone,[x,.29,z]);
    if(kind==='model'){
      // Schematic trilobite matches the central model drawn on p.14.
      const fossil=place(furniture,new THREE.SphereGeometry(1,24,16),bronze,[x,.48,z]);fossil.scale.set(r*.55,.17,r*.78);
      for(let j=0;j<11;j++){const dz=(j-5)*r*.115,w=Math.sqrt(Math.max(.02,1-(dz/(r*.72))**2))*r*.52;const rib=place(furniture,new THREE.TorusGeometry(w,.014,6,18,Math.PI),dark,[x,.5,z+dz]);rib.scale.y=.45;}
    }else{
      // Small scanning specimens + head, matching BFF:1's place in the plan.
      const artifact=place(furniture,new THREE.DodecahedronGeometry(r*.29,0),stone,[x,.51,z]);artifact.scale.y=1.4;artifact.rotation.y=i*.7;
      block(furniture,bronze,x+r*.66,.64,z,.024,.75,.024);
      block(furniture,dark,x+r*.57,.99,z,.15,.08,.11);
    }
  });

  function applyImage(texture){
    // ARCHÉ renders extracted from p.2; preserve their natural material colours.
    texture.colorSpace=THREE.SRGBColorSpace;
    images.forEach((m)=>{
      const t=texture.clone(),sourceAspect=texture.image.width/texture.image.height;
      const aspect=m.userData.aspect;
      if(aspect>sourceAspect){t.repeat.y=sourceAspect/aspect;t.offset.y=(1-t.repeat.y)/2;}
      else {t.repeat.x=aspect/sourceAspect;t.offset.x=(1-t.repeat.x)/2;}
      t.needsUpdate=true;m.map=t;m.color.set('#ffffff');m.needsUpdate=true;
    });
  }
  const massing=buildMassing(group);
  const groundPrint=buildFloorPrint('ground');group.add(groundPrint);
  const levelLabels=Object.fromEntries(['ground','basement','first'].map(key=>{const label=buildLevelLabel(key);group.add(label);return [key,label];}));
  const interiors=[furniture,exhibition,pendant];
  const fadeInteriors=presentation.interiorFade(interiors);
  function setPresentation(state){
    const emphasis=levelEmphasis(state,'ground'),plate=slabAppearance(state.ground,emphasis);
    presentation.emphasize(emphasis);
    const interior=interiorVisibility(state,'ground');
    fadeInteriors(interior);
    interiors.forEach(part=>{part.visible=state.ground.details>.02&&interior>.001;});
    plates.forEach(m=>{m.opacity=state.ground.details*interior;});
    floorMat.opacity=plate.face;
    slabEdges.material.opacity=plate.edge;
    edgeMat.opacity=state.ground.walls*(.18+.30*emphasis);
    glass.opacity=.035+.02*emphasis;
    meetingGlass.opacity=.05+.04*emphasis;
  }
  group.userData={massing,groundPrint,levelLabels,stageY,walls,slab,floorMat,ceiling,furniture,exhibition,glazing,pendant,edgeMat,outside,plates,applyImage,setPresentation};
  return group;
}
