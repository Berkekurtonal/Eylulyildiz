import { OUTLINE, SOURCE } from './arche-data.js';
import { PAPER_SIZE } from './timeline.js';

// Page 6 is registered to the actual raster on the desk; page 7 retains the
// shared structural-axis fit. Coordinates refer to the 1335px review renders.
const k=SOURCE.scale*SOURCE.width/1335;
// The visible page-6 raster is fitted to the 2048×1408 paper texture. Its
// traced axes must use that *same* image-to-paper mapping, not page-5's fit.
export const DESK_PLAN_OFFSET={x:-1.9,z:-.2};
const pdfScale=1916/1335, paperPixel=PAPER_SIZE[0]/2048;
export const basementPaperPoint=(x,z)=>[
  (66+x*pdfScale-1024)*paperPixel,
  (z*pdfScale-704)*paperPixel
];
export const levelPoint=(page,x,z)=>{
  if(page===6){
    const [px,pz]=basementPaperPoint(x,z);
    return [px-DESK_PLAN_OFFSET.x,pz-DESK_PLAN_OFFSET.z];
  }
  return [3.417+(x-730)*k,-4.726+(z-190)*k];
};
const trace=(page,points)=>points.map(p=>levelPoint(page,...p));
export const LEVELS={
  basement:{name:'Basement Floor',page:6,y:-3.78,clear:3.56,
    outline:trace(6,[[274,190],[768,190],[768,220],[940,220],[940,672],[300,672],[300,650],[274,650]]),
    slab:trace(6,[[245,180],[780,180],[780,210],[954,210],[954,780],[675,780],[675,765],[430,765],[430,780],[245,780]])},
  ground:{name:'Ground Floor',page:5,y:0,clear:3.23,outline:OUTLINE},
  first:{name:'1st Floor',page:7,y:3.78,clear:3.23,
    outline:trace(7,[[242,200],[722,200],[722,190],[912,190],[912,410],[944,410],[944,797],[650,797],[650,778],[410,778],[410,797],[210,797],[210,599],[237,599]])}
};
// -3.73 finished / -3.78 structural basement and +0.05 / ±0.00 ground
// are printed on pp.5–6. The 3.78 upper spacing follows the repeated section
// bays on p.4; roof rise is traced proportionally, not a surveyed dimension.
export const ROOF={eaves:7.34,top:10.1,x0:-5.48,x1:7.2,z0:-5.3,z1:5.7,
  crown:[[-.25,-.9],[1.85,-.9],[1.85,1.3],[-.25,1.3]]};
export const CORE={stair:{x:4.182,z:-1.36,w:2.12,d:1.78,landing:.42,risers:22},
  lift:{x:5.372,z:.527,w:1.19,d:1.258}};
// Centre lines of the distinct partitions: p.6 labs / workshop / staff rooms,
// p.7 kitchen / open office / hall / CEO / HR / meeting / WC.
export const PARTITIONS={
  basement:trace(6,[[421,190],[421,352],[590,190],[590,352],[768,220],[768,352],
    [274,352],[400,352],[430,352],[566,352],[610,352],[750,352],
    [274,388],[401,388],[421,408],[421,672],[443,457],[500,457],
    [534,457],[710,457],[710,457],[710,672],[553,457],[553,575],
    [421,575],[553,575],[768,388],[794,388]]),
  first:trace(7,[[350,210],[350,354],[242,354],[350,354],
    [242,545],[650,545],[690,545],[722,545],[722,210],[722,375],
    [722,375],[912,375],[237,599],[300,599],[350,599],[490,599],
    [535,599],[680,599],[556,599],[556,778],[730,645],[730,797],
    [785,615],[944,615]])
};
// Open only the basement's actual page-6 slab footprint beneath the ground
// floor. The former oversize window exposed a broad blue void around ARCHÉ.
export const PAPER_CUT={x0:-5.07,x1:6.92,z0:-4.90,z1:4.85};
