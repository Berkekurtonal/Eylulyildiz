import * as THREE from '../vendor/three.module.js';
import { mergeGeometries } from './core.js';
import { levelMaterials, levelEmphasis, slabAppearance, interiorVisibility } from './arche-presentation.js';
import { PALETTE, WALL_DATA, ENTRY_STEPS } from './arche-data.js';
import { LEVELS, CORE, ROOF, PARTITIONS } from './arche-levels.js';
import { buildLevelDetails } from './arche-details.js';
import { buildFloorPrint } from './arche-prints.js';
import { wallRise, smooth } from './timeline.js';

const path=points=>{
  const p=new THREE.Path();points.forEach(([x,z],i)=>i?p.lineTo(x,-z):p.moveTo(x,-z));p.closePath();return p;
};
export function floorGeometry(points,depth,openCore=false){
  const shape=new THREE.Shape(path(points).getPoints());
  if(openCore)for(const box of [CORE.stair,CORE.lift]){
    const {x,z,w,d}=box;
    shape.holes.push(path([[x,z],[x+w,z],[x+w,z+d],[x,z+d]]));
  }
  const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false});g.rotateX(-Math.PI/2);return g;
}
// A slab's vertical cut edge, with no upper face to obscure the source plan.
export function floorRimGeometry(points,depth){
  const vertices=[];
  points.forEach(([x,z],i)=>{
    const [xx,zz]=points[(i+1)%points.length];
    vertices.push(x,0,z,xx,depth,zz,xx,0,zz,
      x,0,z,x,depth,z,xx,depth,zz);
  });
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  g.computeVertexNormals();return g;
}
export function roofGeometry(){
  const {x0,x1,z0,z1,eaves,top,crown}=ROOF;
  const bottom=[[x0,eaves,z0],[x1,eaves,z0],[x1,eaves,z1],[x0,eaves,z1]];
  const upper=crown.map(([x,z])=>[x,top,z]),v=[];
  const tri=(a,b,c)=>v.push(...a,...b,...c);
  for(let i=0;i<4;i++){const j=(i+1)%4;tri(bottom[i],bottom[j],upper[j]);tri(bottom[i],upper[j],upper[i]);}
  tri(upper[0],upper[1],upper[2]);tri(upper[0],upper[2],upper[3]);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.computeVertexNormals();return g;
}

// Floors have independent construction pivots, all in the existing Architecture
// branch of ProjectOrigin. Their roots keep the real vertical datums fixed.
export function buildMassing(host){
  const models={};
  for(const key of ['basement','first']){
    const root=new THREE.Group();root.name=LEVELS[key].name;root.position.y=LEVELS[key].y;host.add(root);
    const entry={root};
    for(const name of ['structure','slabs','details','roof']){
      const pivot=new THREE.Group(),content=new THREE.Group();
      pivot.name=key+' '+name;content.position.y=-LEVELS[key].y;
      pivot.add(content);root.add(pivot);entry[name]=pivot;entry[name+'Content']=content;
    }
    entry.drawing=buildFloorPrint(key);root.add(entry.drawing);models[key]=entry;
  }
  const presentations={basement:levelMaterials(),first:levelMaterials()};
  const material=(key,role,color,extra={})=>presentations[key].material(role,color,extra);
  const stone=material('basement','stone',PALETTE.stone),dark=material('basement','dark',PALETTE.dark);
  const upStone=material('first','stone',PALETTE.stone),upPlaster=material('first','plaster',PALETTE.plaster),upDark=material('first','dark',PALETTE.dark);
  const column=material('basement','structure','#747a73'),upColumn=material('first','structure','#747a73');
  const glass=material('basement','glass','#bbc2bd',{transparent:true,opacity:.055,depthWrite:false});
  const upGlass=material('first','glass','#bbc2bd',{transparent:true,opacity:.055,depthWrite:false});
  // Closing faces and solid vertical cut faces have independent tones.
  const plateMaterials=Object.fromEntries(['basement','first'].map(key=>[
    key,material(key,'plate','#c8c5bb',{side:THREE.DoubleSide,transparent:true,depthWrite:false,opacity:0})
  ]));
  const upper=[],lower=[];
  const groups=(key,collection)=>Array.from({length:9},(_,i)=>{
    const g=new THREE.Group();g.name=key+' bay '+i;models[key].structureContent.add(g);collection.push(g);return g;
  });
  const b=groups('basement',lower),f=groups('first',upper);
  const mesh=(parent,g,m,name,y=0)=>{
    const o=new THREE.Mesh(g,m);o.name=name;o.position.y=y;o.castShadow=o.receiveShadow=true;parent.add(o);return o;
  };
  // Vector ink follows the very axes visible in the page-6 PDF. These fine
  // strips thicken in place before the matching structural walls rise.
  const sourceLines=new THREE.Group();sourceLines.name='Basement source lines';
  sourceLines.position.y=.008;
  models.basement.root.add(sourceLines);models.basement.sourceLines=sourceLines;
  const sourceInk=new THREE.MeshBasicMaterial({color:'#3d403c',transparent:true,opacity:0,depthWrite:false});
  const basementSegments=[
    ...LEVELS.basement.outline.map((a,i)=>[a,LEVELS.basement.outline[(i+1)%LEVELS.basement.outline.length]]),
    ...Array.from({length:PARTITIONS.basement.length/2},(_,i)=>[PARTITIONS.basement[2*i],PARTITIONS.basement[2*i+1]])
  ];
  for(const [[x,z],[xx,zz]] of basementSegments){
    const length=Math.hypot(xx-x,zz-z),geometry=new THREE.BoxGeometry(length,1,.065);
    geometry.translate(0,.5,0);
    const line=mesh(sourceLines,geometry,sourceInk,'PDF p.06 wall line');
    line.position.set((x+xx)/2,0,(z+zz)/2);
    line.rotation.y=-Math.atan2(zz-z,xx-x);
    line.castShadow=false;line.receiveShadow=false;
  }
  const box=(parent,m,x,y,z,w,h,d,name='Structure')=>{
    const o=mesh(parent,new THREE.BoxGeometry(w,h,d),m,name);o.position.set(x,y,z);return o;
  };
  const slabTops={basement:LEVELS.ground.y,first:ROOF.eaves};
  const basementSlab=mesh(models.basement.slabsContent,
    floorGeometry(LEVELS.basement.outline,.22,true),[plateMaterials.basement,material('basement','rim','#777a73')],
    'Basement Floor slab',slabTops.basement-.22);
  const firstSlab=mesh(models.first.slabsContent,
    floorGeometry(LEVELS.first.outline,.22,true),[plateMaterials.first,material('first','rim','#777a73')],
    '1st Floor slab',slabTops.first-.22);
  const lineMat=new THREE.LineBasicMaterial({color:'#555c57',transparent:true,opacity:.62});
  const plateEdges={};
  // Fine cut edges give each slowly closing plate its section depth.
  for(const [key,source] of [['basement',basementSlab],['first',firstSlab]]){
    plateEdges[key]=new THREE.LineBasicMaterial({color:'#444b47',transparent:true,opacity:0});
    const edge=new THREE.LineSegments(new THREE.EdgesGeometry(source.geometry,25),plateEdges[key]);
    edge.name=key+' floor plate edges';edge.position.copy(source.position);
    models[key].slabsContent.add(edge);
    source.castShadow=false;
  }
  // Roof section: hip outline and bearing edge retain p.4 massing without
  // covering the office drawing with a solid lid in the fixed presentation.
  const roofGeometrySource=roofGeometry();
  const roofLines=new THREE.LineSegments(new THREE.EdgesGeometry(roofGeometrySource,20),lineMat);
  roofLines.name='Hipped roof / page 4';models.first.roofContent.add(roofLines);
  roofGeometrySource.dispose();
  const bearing=floorGeometry(LEVELS.first.outline,.10);
  const bearingLines=new THREE.LineSegments(new THREE.EdgesGeometry(bearing,20),lineMat);
  bearingLines.position.y=ROOF.eaves-.10;models.first.roofContent.add(bearingLines);bearing.dispose();
  const wall=(parent,m,a,c,y,h,thickness=.10,name='Partition')=>{
    const [x,z]=a,[xx,zz]=c,length=Math.hypot(xx-x,zz-z);
    const o=box(parent,m,(x+xx)/2,y+h/2,(z+zz)/2,length,h,thickness,name);o.rotation.y=-Math.atan2(zz-z,xx-x);return o;
  };
  for(const [key,parents,frame,pane] of [['basement',b,stone,glass],['first',f,upStone,upGlass]]){
    const level=LEVELS[key],points=level.outline;
    points.forEach((a,i)=>{
      const c=points[(i+1)%points.length],parent=parents[i%5];
      wall(parent,frame,a,c,level.y,.42,.13,'Facade sill');
      wall(parent,pane,a,c,level.y+.42,level.clear-.42,.035,'Glazed bay');
      wall(parent,frame,a,c,level.y+level.clear,.18,.16,'Facade head');
      const n=Math.ceil(Math.hypot(c[0]-a[0],c[1]-a[1])/.85);
      for(let j=0;j<=n;j++)box(parent,key==='first'?upDark:dark,
        a[0]+(c[0]-a[0])*j/n,level.y+level.clear/2,a[1]+(c[1]-a[1])*j/n,.045,level.clear,.045,'Mullion');
    });
    for(let i=0;i<PARTITIONS[key].length;i+=2)wall(parents[6+i/2%3],key==='first'?upPlaster:stone,
      PARTITIONS[key][i],PARTITIONS[key][i+1],level.y,level.clear,.10,key+' partition');
  }
  // Section BB: the southern basement enclosure is behind the outer columns;
  // the ground slab overhangs this sheltered terrace (p.6), not a third copy
  // of the exhibition plan. Columns keep the structural grid of p.5.
  WALL_DATA.filter(w=>w[5]==='pier').forEach(([, ,x,z,rise])=>{
    box(b[rise],column,x,-1.89,z,.15,3.78,.15,'Basement column');
    box(f[rise],upColumn,x,(LEVELS.first.y+ROOF.eaves)/2,z,.15,ROOF.eaves-LEVELS.first.y,.15,'Upper column');
  });

  // Two U-shaped 22-riser flights, with real half-landings and slab openings.
  // Both flights and the shaft share one x/z registration through all floors.
  const stairs=[];
  for(const y of [LEVELS.basement.y,0]){
    const parent=y<0?b[8]:f[8],m=y<0?stone:upStone;
    const {x,z,w,d,landing,risers}=CORE.stair,half=risers/2,rise=3.78/risers,run=(w-landing)/half,flight=(d-.20)/2;
    for(let i=0;i<half;i++){
      box(parent,m,x+(i+.5)*run,y+(i+1)*rise-.065,z+flight/2,run,.13,flight,'Stair lower flight');
      box(parent,m,x+(half-i-.5)*run,y+(half+i+1)*rise-.065,z+d-flight/2,run,.13,flight,'Stair upper flight');
    }
    box(parent,m,x+w-landing/2,y+1.89-.065,z+d/2,landing,.13,d,'Half landing');
    stairs.push({from:y,to:y+3.78,risers});
  }
  for(const [parent,y,m] of [[b[8],-3.78,stone],[f[8],3.23,upStone]]){
    const {x,z,w,d}=CORE.lift,h=y<0?3.78:4.11;
    box(parent,m,x,y+h/2,z+d/2,.10,h,d,'Continuous lift shaft');
    box(parent,m,x+w,y+h/2,z+d/2,.10,h,d,'Continuous lift shaft');
    box(parent,m,x+w/2,y+h/2,z,w,h,.10,'Continuous lift shaft');
  }
  // External west stair descends from the ground threshold to -3.78 (p.6).
  const es=ENTRY_STEPS;
  for(let i=0;i<22;i++)box(b[1],stone,es.x,-(i+1)*3.78/22-.06,es.z+(i+.5)*es.depth/22,es.width,.12,es.depth/22,'West basement access');

  buildLevelDetails({basement:models.basement.detailsContent,first:models.first.detailsContent,
    box,mesh,wall,materials:{wood:material('basement','timber',PALETTE.timber),stone,
      green:material('basement','green',PALETTE.green),dark,bronze:material('basement','bronze',PALETTE.bronze)}});
  // Details share source materials while being built; give the upper level
  // its own registered instances so calming the basement cannot fade offices.
  const upperDetailMaterials=new Map();
  models.first.detailsContent.traverse(o=>{
    if(!o.isMesh)return;
    if(!upperDetailMaterials.has(o.material)){
      const role=Object.entries(PALETTE).find(([,color])=>new THREE.Color(color).equals(o.material.color))?.[0]||'stone';
      upperDetailMaterials.set(o.material,material('first',role,o.material.color));
    }
    o.material=upperDetailMaterials.get(o.material);
  });

  // Batch by material within each structural bay; the added levels do
  // not add a draw call for every mullion, tread and partition.
  const parts=[];
  for(const parent of [...upper,...lower,...Object.values(models).flatMap(m=>[m.slabsContent,m.detailsContent])]){
    const batches=new Map();
    for(const child of [...parent.children])if(child.isMesh){
      child.updateMatrix();
      child.geometry.computeBoundingBox();
      const bounds=child.geometry.boundingBox.clone().applyMatrix4(child.matrix);
      parts.push({name:child.name,bounds});
      // Keep cap/cut-face groups on the two slabs; all repeated parts still batch.
      if(Array.isArray(child.material))continue;
      const geometry=child.geometry.clone().applyMatrix4(child.matrix);
      // Roof triangles have no UV channel; the other generated geometry does.
      if(!geometry.attributes.uv)geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count*2),2));
      if(!batches.has(child.material))batches.set(child.material,[]);
      batches.get(child.material).push(geometry);
      parent.remove(child);child.geometry.dispose();
    }
    for(const [m,geometries] of batches){
      const combined=mesh(parent,mergeGeometries(geometries),m,'Batched '+parent.name);
      if(parent===models.basement.slabsContent||parent===models.first.slabsContent)
        combined.castShadow=false;
      geometries.forEach(g=>g.dispose());
    }
  }
  const fadeBasement=presentations.basement.interiorFade([models.basement.details]);
  return {levels:LEVELS,models,upper,lower,stairs,parts,
    setAssembly(state){
      for(const [key,model] of Object.entries(models)){
        const phase=state[key];model.root.visible=phase.plan>0;
        const emphasis=levelEmphasis(state,key),plate=slabAppearance(phase,emphasis);
        presentations[key].emphasize(emphasis);
        (key==='basement'?glass:upGlass).opacity=.035+.02*emphasis;
        // The PDF image is already on the continuous paper. A second filled
        // Basement drawing here would cover the fine original linework.
        model.drawing.material.opacity=key==='basement'?0:phase.plan*(key==='first'?.35:1);
        model.drawing.visible=key!=='basement' && phase.plan>0;
        if(key==='basement'){
          const stroke=smooth(0,.3,phase.walls);
          sourceInk.opacity=.65*stroke;
          sourceLines.visible=stroke>.001;
          sourceLines.children.forEach(line=>line.scale.set(1,.006+.075*stroke,.16+.84*stroke));
        }
        // Reuse the original nine-bay, clockwise wall-rise language rather
        // than scaling every facade and partition as one bulky mass.
        const bays=key==='basement'?lower:upper;
        bays.forEach((bay,i)=>{
          const rise=wallRise(i,.46+phase.walls*.19);
          bay.scale.y=Math.max(.0001,rise);
          bay.position.y=LEVELS[key].y*(1-rise);
          bay.visible=rise>.004;
        });
        model.structure.visible=phase.walls>.001;
        model.structure.scale.y=1;
        // Grow plate thickness downward from its fixed upper datum. The
        // completed walls do not vanish or get pushed out of the desk scene.
        model.slabs.visible=phase.slab>.001;
        model.slabs.scale.y=Math.max(.0001,phase.slab);
        model.slabs.position.y=(slabTops[key]-LEVELS[key].y)*(1-phase.slab);
        plateMaterials[key].opacity=plate.face;
        plateEdges[key].opacity=plate.edge;
        const interior=interiorVisibility(state,key);
        if(key==='basement')fadeBasement(interior);
        for(const [kind,amount] of [['details',phase.details],['roof',state.roof]]){
          model[kind].visible=amount>.001;model[kind].scale.y=Math.max(.0001,amount);
        }
        model.details.visible=phase.details>.001&&interior>.001;
      }
    }
  };
}

