import * as THREE from '../vendor/three.module.js';
import { reducible } from './core.js';

// One intact illustrated architect on the original perspective-aware depth
// surface. Nothing in the figure is segmented, masked or articulated.
const SOURCE = { w:1230, h:1278, scale:.91, x:14, y:104 };
const ORIGIN = new THREE.Vector3(-.86,0,10.08);
// v3: the curly-haired redraw, registered onto v1's canvas and pose (see design-docs).
// Served as a lossless WebP of design-docs/architect-painted-v3.png: every pixel equal.
const asset = new URL('../assets/architect-painted-v3.webp', import.meta.url).href;

function depthSurface() {
  const camera=new THREE.PerspectiveCamera(40,1230/1278,.04,260);
  const aim=new THREE.Vector3(-.60,1,9.50);
  camera.position.set(1.85,1.66,11.10);
  const reach=1+(1.05/camera.aspect-1)*.3025;
  camera.position.lerp(aim,1-reach);camera.lookAt(aim);camera.updateMatrixWorld(true);
  const forward=new THREE.Vector3();camera.getWorldDirection(forward);
  function ray(x,y) {
    return new THREE.Vector3(x/1230*2-1,1-y/1278*2,.5).unproject(camera).sub(camera.position).normalize();
  }
  const screen=([x,y])=>[SOURCE.x+x*SOURCE.scale,SOURCE.y+y*SOURCE.scale];
  const marks=[
    [[400,445],[0,1.09,-.19]], [[315,650],[0,.86,-.13]],
    [[270,870],[0,.49,0]], [[545,756],[.36,.78,-.34]],
    [[838,728],[.402,.775,-.82]], [[695,680],[-.005,.775,-.78]],
    [[590,890],[.137,.43,-.415]], [[427,955],[-.137,.34,-.33]],
    [[680,1185],null], [[475,1140],null],
    [[155,1267],null], [[53,1164],null], [[418,1203],null], [[300,1108],null],
    [[165,758],[-.18,.74,.27]], [[75,723],[.18,.74,.27]]
  ].map(([pixel,point])=>{
    const [x,y]=screen(pixel),dir=ray(x,y);
    let d;
    if(point) d=new THREE.Vector3(...point).add(ORIGIN).sub(camera.position).dot(forward);
    else d=(-camera.position.y+.008)/dir.y*dir.dot(forward);
    return {x,y,d};
  });
  const columns=112,rows=128,positions=[],uv=[],indices=[];
  for(let j=0;j<=rows;j++) for(let i=0;i<=columns;i++) {
    const u=i/columns,v=j/rows, [x,y]=screen([u*SOURCE.w,(1-v)*SOURCE.h]);
    let weight=0,depth=0;
    for(const m of marks) {
      const d2=((x-m.x)**2+(y-m.y)**2)/(1230*1230);
      const w=1/((d2+.000035)**2);
      depth+=m.d*w;weight+=w;
    }
    const dir=ray(x,y);
    let viewDepth=depth/weight;
    const imageX=u*SOURCE.w,imageY=(1-v)*SOURCE.h;
    // Both forearms rest on the actual desk plane. Pin this broad region
    // above it so the tabletop cannot slice through the painted wrist.
    const armBand=THREE.MathUtils.smoothstep(imageY,560,615)*(1-THREE.MathUtils.smoothstep(imageY,805,845));
    const armReach=THREE.MathUtils.smoothstep(imageX,475,635)*armBand;
    const farArm=(1-THREE.MathUtils.smoothstep(imageY,690,718))*(1-THREE.MathUtils.smoothstep(imageX,700,735));
    const centreLine=THREE.MathUtils.lerp(770-(imageX-560)*.17,675+(imageX-590)*.045,farArm);
    const armHeight=Math.max(.766,.795+(centreLine-imageY)*.00055);
    const deskDepth=(armHeight-camera.position.y)/dir.y*dir.dot(forward);
    viewDepth=THREE.MathUtils.lerp(viewDepth,deskDepth,armReach);
    const p=camera.position.clone().addScaledVector(dir,viewDepth/dir.dot(forward)).sub(ORIGIN);
    positions.push(p.x,p.y,p.z);uv.push(u,v);
    if(i<columns && j<rows) {const k=j*(columns+1)+i;indices.push(k,k+1,k+columns+1,k+1,k+columns+2,k+columns+1);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
  return g;
}

export function installIntactArchitect(root) {
  let painting;
  const reveal=()=>{if(painting)painting.visible=true;};
  const texture=new THREE.TextureLoader().load(asset,reveal);
  texture.colorSpace=THREE.NoColorSpace;
  texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
  texture.anisotropy=8;
  const material=reducible(new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,
    transparent:true,alphaTest:.06,depthWrite:true}),'studio');
  const reduce=material.onBeforeCompile;
  material.onBeforeCompile=shader=>{
    reduce(shader);
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec4 painted=texture2D(map,vMapUv);
      // Remove the production chroma key before colour conversion. The
      // warm paper and all blue inks are outside the magenta key range.
      float key=clamp(min(painted.r,painted.b)-painted.g,0.0,1.0);
      float coverage=1.0-key;
      vec3 colour=clamp((painted.rgb-vec3(1.,0.,1.)*key)/max(coverage,.001),0.,1.);
      float warm=smoothstep(.02,.12,colour.r-colour.b);
      vec3 blue=vec3(min(colour.r,.018),min(colour.g*.82,colour.b*.50),colour.b);
      colour=mix(blue,colour,warm);
      diffuseColor.rgb*=mix(colour/12.92,pow((colour+.055)/1.055,vec3(2.4)),step(vec3(.04045),colour));
      diffuseColor.a*=coverage;
    `);
  };
  material.customProgramCacheKey=()=> 'painted-architect-chroma-v1';
  painting=new THREE.Mesh(depthSurface(),material);painting.name='PaintedArchitectDepthSurface';
  const shadow=new THREE.MeshDepthMaterial({map:texture,depthPacking:THREE.RGBADepthPacking,
    side:THREE.DoubleSide,alphaTest:.10});
  shadow.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec4 painted=texture2D(map,vMapUv);
      float key=clamp(min(painted.r,painted.b)-painted.g,0.0,1.0);
      diffuseColor.a*=1.0-key;
      // The pencil is thinner than a shadow-map texel; omit its broken
      // stipple while retaining the broad hand, sleeve and chair shadows.
      if(vMapUv.x>.66 && vMapUv.y>.465) discard;
    `);
  };
  shadow.customProgramCacheKey=()=> 'painted-architect-shadow-v1';
  painting.customDepthMaterial=shadow;
  painting.visible=false;painting.castShadow=true;painting.receiveShadow=false;
  root.add(painting);
  root.userData.painting=painting;
}

export function buildIntactArchitect() {
  const root=new THREE.Group();root.name='Architect';
  installIntactArchitect(root);
  root.userData.update=(_time,plan=0,assembly=0)=>{
    root.position.copy(ORIGIN);
    root.position.x-=.4*THREE.MathUtils.clamp(plan,0,1)+.3*THREE.MathUtils.clamp(assembly,0,1);
    root.position.z+=.3*THREE.MathUtils.clamp(plan,0,1)+.15*THREE.MathUtils.clamp(assembly,0,1);
  };
  return root;
}

// Legacy, non-live builder imports this installer; PaperJourney uses the intact figure.
export const installPaintedArchitect=installIntactArchitect;
