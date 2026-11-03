import * as THREE from '../vendor/three.module.js';
import { roundedBox, reducible } from './core.js';
import { illustrated, contour, INK } from './illustration.js';
import { installPaintedArchitect } from './painted-architect.js';

// Authored sections in metres. Seat origin and drawing contact retain the
// approved coordinates. All anatomy, hair and tailoring are real 3D meshes.
const V = p => new THREE.Vector3(...p.slice(0,3));
const mix = THREE.MathUtils.lerp;
function mat(color, roughness, extra = {}) {
  return illustrated(color, 'studio', extra);
}
function add(parent, geometry, material, p, r) {
  const m = new THREE.Mesh(geometry, material);
  if (p) m.position.set(...p);
  if (r) m.rotation.set(...r);
  m.castShadow = true; m.receiveShadow = false; parent.add(m); return m;
}

// Continuous silhouette surfaces with independent width and depth at each
// section. Broad volumes carry the pose; micro-anatomy is deliberately absent.
function form(sections, { steps = 40, sides = 32, horizontal = false, folds = 0, pleats = [] } = {}) {
  const path = new THREE.CatmullRomCurve3(sections.map(V), false, 'centripetal');
  const widths = new THREE.CatmullRomCurve3(sections.map((s,i) => new THREE.Vector3(s[3],s[4],i)), false, 'catmullrom', .25);
  const pos=[], uv=[], indices=[];
  const tangent=new THREE.Vector3(), u=new THREE.Vector3(1,0,0), v=new THREE.Vector3();
  for(let i=0;i<=steps;i++) {
    const t=i/steps, c=path.getPoint(t), size=widths.getPoint(t);
    if(horizontal) { u.set(1,0,0); v.set(0,0,-1); }
    else {
      path.getTangent(t,tangent).normalize();
      // Parallel transport prevents cross sections flipping at the elbow,
      // knuckles or any point where the path becomes horizontal.
      u.addScaledVector(tangent,-u.dot(tangent));
      if(u.lengthSq()<.01) u.set(0,1,0).addScaledVector(tangent,-tangent.y);
      u.normalize();
      v.crossVectors(tangent,u).normalize();
    }
    for(let j=0;j<=sides;j++) {
      const a=j/sides*Math.PI*2;
      let ripple=1+folds*Math.sin(a*5+t*7)*Math.sin(Math.PI*t);
      // A few broad, tapered cloth valleys, placed at compression points.
      for(const [u,at,length,depth,slope=0] of pleats) {
        const angle=u+slope*(t-at);
        const du=Math.min(Math.abs(j/sides-angle),1-Math.abs(j/sides-angle));
        ripple-=depth*Math.exp(-Math.pow(du/.026,2)-Math.pow((t-at)/length,2));
      }
      const q=c.clone().addScaledVector(u,Math.cos(a)*Math.max(.0004,size.x)*ripple)
        .addScaledVector(v,Math.sin(a)*Math.max(.0004,size.y)*ripple);
      pos.push(q.x,q.y,q.z); uv.push(j/sides,t);
      if(i<steps&&j<sides) {
        const k=i*(sides+1)+j;
        indices.push(k,k+1,k+sides+1,k+1,k+sides+2,k+sides+1);
      }
    }
  }
  for(const end of [0,steps]) {
    const c=path.getPoint(end/steps), k=pos.length/3;
    pos.push(c.x,c.y,c.z); uv.push(.5,end/steps);
    for(let j=0;j<sides;j++) {
      const a=end*(sides+1)+j;
      indices.push(...(end===0?[k,a+1,a]:[k,a,a+1]));
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(indices); g.computeVertexNormals();
  const n=g.attributes.normal;
  for(let i=0;i<=steps;i++) {
    const a=i*(sides+1),b=a+sides;
    const avg=new THREE.Vector3().fromBufferAttribute(n,a).add(new THREE.Vector3().fromBufferAttribute(n,b)).normalize();
    n.setXYZ(a,avg.x,avg.y,avg.z); n.setXYZ(b,avg.x,avg.y,avg.z);
  }
  g.userData.grid = { steps, sides };
  return g;
}

// Drawn accents follow the authored surface, including its folds. They are
// attached to the mesh, so they remain registered as the camera travels.
function stroke(mesh, knots, color = '#00295f') {
  const { steps, sides } = mesh.geometry.userData.grid;
  const p = mesh.geometry.attributes.position, n = mesh.geometry.attributes.normal;
  const curve = new THREE.CatmullRomCurve3(knots.map(k => new THREE.Vector3(k[0], k[1], 0)));
  const points = [];
  for (let i=0; i<=64; i++) {
    const k=curve.getPoint(i/64), x=THREE.MathUtils.clamp(k.x,0,.99999)*sides;
    const y=THREE.MathUtils.clamp(k.y,0,.99999)*steps;
    const a=Math.floor(x), b=Math.floor(y), q=new THREE.Vector3(), normal=new THREE.Vector3();
    for(const [dx,dy,w] of [[0,0,(1-x+a)*(1-y+b)],[1,0,(x-a)*(1-y+b)],
      [0,1,(1-x+a)*(y-b)],[1,1,(x-a)*(y-b)]]) {
      const j=(b+dy)*(sides+1)+a+dx;
      q.addScaledVector(new THREE.Vector3().fromBufferAttribute(p,j),w);
      normal.addScaledVector(new THREE.Vector3().fromBufferAttribute(n,j),w);
    }
    points.push(q.addScaledVector(normal.normalize(),.0012));
  }
  return ink(mesh,points,color);
}
function ink(parent,points,color='#00295f') {
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),
    reducible(new THREE.LineBasicMaterial({color,transparent:true,opacity:.88,depthWrite:false}), 'studio'));
  line.userData.drawnInk=true;parent.add(line);return line;
}
function drawn(parent,points,color) {
  const c=new THREE.CatmullRomCurve3(points.map(V));
  return ink(parent,c.getPoints(48),color);
}

// Accents are batched per moving part. Dozens of drawn folds should not
// become dozens of additional draw calls on a mobile GPU.
function batchInk(root, movingParts) {
  root.updateMatrixWorld(true);
  const buckets=new Map(), lines=[];
  root.traverse(o=>{if(o.isLine && o.userData.drawnInk) lines.push(o);});
  for(const line of lines) {
    let anchor=line.parent;
    while(anchor!==root && !movingParts.includes(anchor)) anchor=anchor.parent;
    if(!buckets.has(anchor)) buckets.set(anchor,new Map());
    const key=line.material.color.getHex(), groups=buckets.get(anchor);
    if(!groups.has(key)) groups.set(key,[]);
    const out=groups.get(key), transform=new THREE.Matrix4().copy(anchor.matrixWorld).invert().multiply(line.matrixWorld);
    const p=line.geometry.attributes.position;
    for(let i=0;i<p.count-1;i++) for(const j of [i,i+1]) {
      const q=new THREE.Vector3().fromBufferAttribute(p,j).applyMatrix4(transform);
      out.push(q.x,q.y,q.z);
    }
    line.removeFromParent();line.geometry.dispose();line.material.dispose();
  }
  for(const [anchor,groups] of buckets) for(const [color,positions] of groups) {
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    const material=reducible(new THREE.LineBasicMaterial({color,transparent:true,opacity:.88,depthWrite:false}),'studio');
    const lines=new THREE.LineSegments(g,material);lines.name='DrawnAccents';anchor.add(lines);
  }
}

function collarLeaf(parent,points,material) {
  const p=points.map(V), center=p.reduce((a,b)=>a.add(b),new THREE.Vector3()).multiplyScalar(1/p.length);
  const vertices=[];
  p.forEach((q,i)=>vertices.push(...center,...q,...p[(i+1)%p.length]));
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  g.computeVertexNormals();const leaf=add(parent,g,material);
  drawn(parent,[...points,points[0]],'#00295f');return leaf;
}
// One relaxed palm, a grouped pair of fingers and the pencil pinch.
function hand(parent,skin,position,drawing=false) {
  const h=new THREE.Group(); h.position.set(...position); parent.add(h);
  h.rotation.set(drawing?-.10:-.025,drawing?-.22:.17,drawing?-.16:.07);
  const palm=add(h,form([[0,0,.030,.020,.013],[0,.001,.002,.025,.013],
    [.001,0,-.027,.027,.012],[.006,-.003,-.048,.021,.011]],{sides:24,steps:22}),skin);
  for(let i=0;i<3;i++) {
    const x=.023-i*.012, z=-.039-i*.004;
    const finger=add(h,form([[x,0,z,.008,.008],[x+.004,.003,z-.018,.0075,.007],
      [x+.006,drawing?-.006:-.003,z-.035,.006,.005],
      [x+.002,-.009,z-.043,.003,.003]],{sides:12,steps:18}),skin);
    if(i<2) stroke(finger,[[.77,.14],[.78,.45],[.75,.7]]);
  }
  if(drawing) {
    add(h,form([[-.017,.001,-.027,.010,.009],[-.025,.013,-.048,.009,.008],
      [-.019,.012,-.071,.007,.007],[-.009,.002,-.081,.004,.004]],{sides:16,steps:24}),skin);
  }
  add(h,form([[-.018,-.002,-.008,.011,.010],[-.035,-.001,-.025,.010,.009],
    [drawing?-.029:-.041,-.005,-.046,.008,.007],
    [drawing?-.009:-.033,-.004,-.057,.004,.004]],{sides:16,steps:22}),skin);
  stroke(palm,[[.77,.12],[.79,.4],[.78,.69]]);
  return h;
}

// A swept hair cap opens around the ear and gathers into a low nape knot.
function bobGeometry() {
  const pos=[],indices=[],uv=[],rows=28,cols=64;
  for(let i=0;i<=rows;i++) {
    const t=i/rows;
    for(let j=0;j<=cols;j++) {
      const u=j/cols;
      const a=u*Math.PI*2,front=Math.pow(Math.max(0,-Math.cos(a)),7);
      const side=Math.pow(Math.max(0,Math.sin(a)),4);
      const theta=t*mix(2.12-.51*side,1.05,front);
      const radius=Math.sin(Math.min(theta,1.58))*(1-Math.max(0,theta-1.50)*.48);
      let y=.127*Math.cos(theta)-Math.max(0,t-.58)*.030*(1-front);
      y+=Math.pow(t,5)*.008*Math.sin(a+.3);
      y+=Math.pow(t,4)*Math.sin(a)*.023;
      pos.push(Math.sin(a)*(.088*radius)+.007*(1-t),y,Math.cos(a)*(.100*radius)+.008);
      uv.push(j/cols,t);
      if(i<rows&&j<cols) {
        const k=i*(cols+1)+j;
        indices.push(k,k+cols+1,k+1,k+1,k+cols+1,k+cols+2);
      }
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(indices);g.computeVertexNormals();g.userData.grid={steps:rows,sides:cols};return g;
}

export function buildArchitect() {
  const root=new THREE.Group();root.name='Architect';
  const skin=mat(INK.cobalt,1),shirt=mat(INK.paper,1);
  const cuff=mat(INK.mist,1),trousers=mat(INK.cobalt,1,{paperCoverage:.04});
  const hair=mat(INK.deep,1,{side:THREE.DoubleSide});
  const leather=mat(INK.deep,1);

  // A tucked blouse and softly draped trousers share one seated silhouette.
  const hips=add(root,form([[0,.435,.015,.13,.115],[0,.477,.020,.180,.137],
    [0,.53,.005,.160,.121],[0,.561,-.014,.130,.101]],{horizontal:true,folds:.025}),trousers);
  stroke(hips,[[.52,.64],[.64,.72],[.78,.71],[.95,.67]]);
  for(const side of [-1,1]) {
    const x=side*.112,kneeZ=side===1?-.415:-.375,footZ=side===1?-.49:-.29;
    const leg=add(root,form([[x,.487,.015,.095,.088],[x+side*.017,.476,-.16,.102,.084],
      [x+side*.025,.449,kneeZ+.065,.091,.075],[x+side*.027,.411,kneeZ,.080,.072],
      [x+side*.024,.29,footZ+.046,.066,.062],[x+side*.021,.16,footZ+.01,.061,.061],
      [x+side*.02,.085,footZ-.004,.071,.064]],{steps:56,sides:48,folds:.015,pleats:[[.97,.67,.3,.09],[.72,.43,.10,.13],[.58,.29,.18,.07]]}),trousers);
    stroke(leg,[[.03,.12],[.025,.34],[.05,.52],[.045,.75],[.045,.95]]);
    stroke(leg,[[.59,.41],[.64,.46],[.8,.49]]);
    stroke(leg,[[.16,.52],[.18,.65],[.20,.82],[.18,.95]]);
    stroke(leg,[[.04,.93],[.17,.915],[.34,.936],[.48,.94]]);
    stroke(leg,[[.85,.18],[.88,.31],[.97,.43]]);
    stroke(leg,[[.04,.52],[.12,.48],[.22,.48]]);
    stroke(leg,[[.51,.965],[.66,.955],[.85,.965],[.98,.96]]);
    const shoe=add(root,form([[0,0,.084,.027,.018],[0,.013,.041,.044,.031],
      [0,.005,-.048,.049,.024],[0,-.002,-.115,.039,.014],[0,-.005,-.138,.015,.006]],{steps:32}),leather,
      [x+side*.02,.033,footZ-.025]);
    add(shoe,roundedBox(.097,.010,.229,.017),cuff,[0,-.021,-.025]);
    stroke(shoe,[[.04,.43],[.19,.48],[.35,.46],[.49,.43]]);
    stroke(shoe,[[.03,.2],[.08,.4],[.07,.72],[.04,.88]],INK.mist);
  }
  const torso=new THREE.Group();torso.position.set(0,.47,.005);
  torso.rotation.set(-.30,-.035,.016);root.add(torso);
  const blouse=add(torso,form([[0,0,0,.126,.101],[0,.035,.002,.142,.106],[0,.105,.002,.133,.099],
    [0,.20,-.005,.141,.109],[0,.31,-.004,.157,.111],[0,.392,.002,.179,.098],
    [0,.456,.009,.163,.081],[0,.493,.007,.114,.057],[0,.506,.004,.059,.045]],
    {horizontal:true,steps:64,sides:64,folds:.025,pleats:[[.68,.30,.25,.20,.14],[.83,.20,.18,.15,-.17],[.56,.57,.19,.11,.09],[.95,.63,.22,.12,-.12]]}),shirt);
  // Long, sparse cloth gestures, with shorter folds at the tucked waist.
  stroke(blouse,[[.55,.17],[.56,.34],[.59,.57],[.59,.73],[.62,.84]]);
  stroke(blouse,[[.92,.09],[.94,.3],[.95,.56],[.94,.69]]);
  stroke(blouse,[[.65,.09],[.68,.23],[.7,.43],[.71,.59]]);
  stroke(blouse,[[.80,.10],[.84,.20],[.87,.32]]);
  stroke(blouse,[[.61,.40],[.63,.49],[.68,.64],[.72,.7]]);
  stroke(blouse,[[.77,.08],[.79,.20],[.80,.32]]);
  stroke(blouse,[[.55,.8],[.66,.78],[.8,.78],[.92,.80]]);
  stroke(blouse,[[.83,.77],[.86,.68],[.87,.53]]);
  add(torso,form([[0,.461,.008,.048,.036],[0,.521,.008,.045,.037],
    [0,.552,.003,.043,.035],[0,.577,-.002,.045,.037]],{horizontal:true,steps:24}),skin);
  const collarMat=mat(INK.paper,1,{side:THREE.DoubleSide});
  add(torso,form([[0,.475,.005,.058,.044],[0,.503,.005,.052,.041]],{horizontal:true,steps:10}),cuff);
  collarLeaf(torso,[[-.050,.514,.027],[-.027,.520,.046],[.012,.517,.047],
    [.056,.5,.041],[.048,.481,.063],[-.044,.487,.061]],collarMat);
  collarLeaf(torso,[[-.05,.503,-.016],[-.067,.475,-.04],[-.063,.436,-.070],
    [-.01,.465,-.061],[0,.498,-.039]],collarMat);
  collarLeaf(torso,[[.04,.503,-.025],[.068,.477,-.037],[.069,.44,-.076],
    [.012,.465,-.065],[0,.498,-.039]],collarMat);
  const head=new THREE.Group();head.position.set(.004,.623,-.003);
  head.rotation.set(-.13,-.66,-.045);torso.add(head);
  const face=add(head,form([[0,-.090,-.031,.023,.030],[0,-.074,-.019,.043,.052],
    [0,-.044,-.007,.059,.063],[0,-.010,-.003,.069,.074],[0,.026,.002,.074,.077],
    [0,.061,.006,.069,.073],[0,.094,.009,.052,.055],[0,.113,.010,.021,.025],
    [0,.117,.010,.002,.003]],{horizontal:true,steps:40,sides:40}),skin);
  // The nose and small mouth plane belong to the same continuous profile.
  const fp=face.geometry.attributes.position;
  for(let i=0;i<fp.count;i++) {
    const x=fp.getX(i),y=fp.getY(i),z=fp.getZ(i);
    if(z<-.045) {
      const bridge=.018*Math.exp(-Math.pow((y+.006)/.025,2));
      const lip=.004*Math.exp(-Math.pow((y+.045)/.009,2));
      fp.setZ(i,z-(bridge+lip)*Math.exp(-Math.pow(x/.017,2)));
    }
  }
  face.geometry.computeVertexNormals();
  // A visible ear and a single brow / lid suggest a face without portrait detail.
  for(const side of [-1,1]) {
    add(head,form([[side*.067,-.047,.003,.007,.007],[side*.077,-.029,.006,.013,.014],
      [side*.077,-.006,.008,.013,.015],[side*.069,.008,.008,.006,.008]],{horizontal:true,steps:22,sides:20}),skin);
    drawn(head,[[side*.078,-.035,.012],[side*.085,-.022,.014],[side*.081,-.006,.012],
      [side*.075,-.01,.002],[side*.077,-.025,.001]]);
    drawn(head,[[side*.023,.013,-.075],[side*.035,.014,-.07],[side*.047,.019,-.060]]);
    drawn(head,[[side*.02,.026,-.075],[side*.036,.03,-.07],[side*.047,.027,-.061]]);
  }
  drawn(head,[[-.012,-.044,-.069],[0,-.046,-.073],[.013,-.043,-.068]]);
  stroke(face,[[.90,.08],[.97,.17],[.995,.27]]);
  const crown=add(head,bobGeometry(),hair);
  // Swept, converging ink arcs describe tied hair, rather than a helmet grid.
  for(let i=0;i<7;i++) {
    stroke(crown,[[.35+i*.032,.25],[.28+i*.061,.49],[.11+i*.083,.75],[.045+i*.064,.96]]);
  }
  for(let i=0;i<3;i++) stroke(crown,[[.84+i*.045,.14],[.81+i*.062,.40],
    [.78+i*.073,.65],[.8+i*.061,.91]],i===0?INK.mist:'#00295f');
  const knot=add(head,form([[.004,-.076,.079,.019,.022],[-.003,-.065,.110,.042,.036],
    [-.007,-.043,.135,.044,.034],[-.006,-.018,.132,.033,.029],
    [-.001,-.006,.112,.013,.014]],{horizontal:true,steps:30,sides:32,folds:.05}),hair);
  stroke(knot,[[.51,.09],[.65,.35],[.71,.57],[.72,.84]],INK.mist);
  stroke(knot,[[.86,.10],[.91,.37],[.9,.65],[.85,.9]]);
  // Two designed locks frame the profile and tuck behind the ear.
  const lock=add(head,form([[.028,.098,-.058,.017,.009],[.062,.064,-.062,.014,.008],
    [.077,.03,-.047,.010,.006],[.071,.006,-.022,.006,.004],
    [.070,-.013,-.004,.001,.001]],{steps:36,sides:20}),hair);
  stroke(lock,[[.9,.1],[.88,.35],[.83,.6],[.8,.89]]);
  add(head,form([[.070,.031,-.054,.003,.002],[.077,.002,-.060,.0025,.002],
    [.071,-.033,-.068,.0015,.001],[.077,-.054,-.066,.0004,.0004]],{steps:28,sides:12}),hair);

  const arms=new THREE.Group();root.add(arms);
  const armData=[
    {s:1,shoulder:[.153,.894,-.127],elbow:[.361,.779,-.337],cuff:[.366,.786,-.476],wrist:[.400,.775,-.713]},
    {s:-1,shoulder:[-.153,.890,-.128],elbow:[-.270,.780,-.350],cuff:[-.241,.782,-.478],wrist:[-.030,.775,-.721]}
  ];
  for(const a of armData) {
    const [sx,sy,sz]=a.shoulder,[ex,ey,ez]=a.elbow,[cx,cy,cz]=a.cuff,[wx,wy,wz]=a.wrist;
    const sleeve=add(arms,form([[sx*.27,sy-.031,sz+.012,.039,.042],[sx*.94,sy-.018,sz-.021,.068,.061],
      [mix(sx,ex,.62),mix(sy,ey,.62),mix(sz,ez,.62),.058,.057],
      [ex,ey,ez,.058,.051],[cx,cy,cz+.032,.043,.041],[cx,cy,cz,.046,.042]],{steps:48,sides:48,folds:.028,pleats:[[.71,.69,.18,.18],[.87,.78,.13,.20],[.57,.87,.09,.16]]}),shirt);
    stroke(sleeve,[[.74,.14],[.71,.32],[.72,.52],[.68,.66],[.68,.92]]);
    stroke(sleeve,[[.77,.49],[.81,.62],[.85,.68]]);
    stroke(sleeve,[[.90,.66],[.84,.72],[.8,.83]]);
    stroke(sleeve,[[.97,.15],[.98,.39],[.94,.57]]);
    stroke(sleeve,[[.02,.59],[.13,.65],[.21,.74],[.27,.85]]);
    stroke(sleeve,[[.54,.69],[.66,.77],[.73,.86]]);
    stroke(sleeve,[[.91,.77],[.85,.84],[.81,.96]]);
    const rolled=add(arms,form([[cx-.003*a.s,cy,cz+.023,.049,.045],[cx,cy,cz+.004,.052,.046],
      [cx+.003*a.s,cy,cz-.02,.046,.041]],{steps:18,folds:.035}),cuff);
    stroke(rolled,[[.01,.77],[.2,.81],[.4,.77],[.6,.79],[.8,.77],[.99,.8]]);
    const forearm=add(arms,form([[cx,cy,cz-.006,.034,.028],[mix(cx,wx,.25),cy-.001,mix(cz,wz,.25),.037,.027],
      [mix(cx,wx,.63),wy+.002,mix(cz,wz,.63),.027,.019],
      [wx,wy,wz,.020,.014],[wx,wy,wz-.025,.020,.013]],{steps:36,sides:28}),skin);
    stroke(forearm,[[.73,.14],[.72,.39],[.72,.71],[.74,.91]]);
  }
  const rightHand=hand(root,skin,[.408,.775,-.765],true);
  hand(root,skin,[-.005,.775,-.769]);
  const pencil=new THREE.Group();pencil.position.set(.402,.768,-.833);
  pencil.rotation.set(-.36,.1,.27);root.add(pencil);
  const graphite=mat(INK.deep,.82),cedar=mat(INK.paper,.88);
  add(pencil,new THREE.CylinderGeometry(.0036,.0036,.147,6),graphite,[0,.09,0]);
  add(pencil,new THREE.CylinderGeometry(.0036,.0007,.024,6),cedar,[0,.005,0]);
  add(pencil,new THREE.CylinderGeometry(.0008,0,.005,6),graphite,[0,-.009,0]);

  // Slim oak frame, upholstered seat and curved plywood back rail.
  const chair=new THREE.Group();root.add(chair);
  const oak=mat(INK.deep,1);
  for(const sx of [-1,1]) for(const sz of [-1,1]) {
    add(chair,form([[sx*.20,.018,.10+sz*.21,.011,.012],[sx*.185,.26,.10+sz*.18,.014,.015],
      [sx*.181,.445,.10+sz*.165,.018,.017]],{steps:12,sides:12}),oak);
  }
  add(chair,roundedBox(.435,.027,.42,.016),oak,[0,.43,.095]);
  add(chair,roundedBox(.410,.026,.391,.012),cuff,[0,.457,.091]);
  drawn(chair,[[-.195,.471,.279],[.0,.471,.28],[.196,.471,.278]],'#00295f');
  for(const side of [-1,1]) add(chair,form([[side*.18,.44,.247,.014,.014],
    [side*.192,.65,.277,.013,.013],[side*.189,.775,.26,.014,.012]],{steps:18,sides:12}),oak);
  const rail=add(chair,form([[-.218,.734,.212,.034,.013],[-.15,.74,.282,.039,.014],
    [0,.741,.317,.034,.014],[.15,.74,.282,.034,.014],[.218,.734,.212,.034,.013]],{steps:36,sides:16}),oak);
  stroke(rail,[[.18,.03],[.18,.30],[.18,.65],[.18,.97]],INK.mist);
  batchInk(root,[torso,head,rightHand]);
  const outlined = [];
  root.traverse(o => { if(o.isMesh && o.geometry.attributes.position.count > 180) outlined.push(o); });
  outlined.forEach(o => contour(o, 'studio', .65));
  installPaintedArchitect(root);
  root.userData.update=time=>{
    const breath=Math.sin(time*.62)*.5+Math.sin(time*.27+1.1)*.5;
    root.userData.painting.userData.breath.value=breath;
    torso.scale.set(1+breath*.0017,1+breath*.002,1+breath*.002);
    torso.rotation.x=-.30+breath*.003;head.rotation.z=-.045+Math.sin(time*.21)*.009;
    const draw=Math.sin(time*.53)*.0025;
    rightHand.position.x=.408+draw;pencil.position.x=.402+draw;
  };
  return root;
}
