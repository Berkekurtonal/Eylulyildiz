// The source page-6 basement plan is the first visible ARCHÉ level. Each
// later floor grows at its PDF datum above the same x/z footprint.
import { smooth, cameraLocal, originAt, story } from './timeline.js';
export const ASSEMBLY={anchor:.156,planView:[.156,.19],spatialView:[.255,.305],settled:.305,
  basement:{plan:[-.02,0],walls:[.305,.395],details:[.355,.395],slab:[.405,.47]},
  ground:{plan:[.48,.51],walls:[.515,.61],details:[.565,.61],slab:[.62,.68]},
  first:{plan:[.69,.72],walls:[.725,.825],details:[.78,.825],slab:[.835,.90]},
  roof:[.91,.96]};
export const PRESENTATION={eye:[11.05,24.4,23.3],aim:[-.5,.8,.1]};
// High enough that the desk frames the sheet in the true plan view.
const PLAN={eye:[.65,41,.1],aim:[.65,0,.1]};
// Section-derived vertical fit to the existing page-5 horizontal stage. The
// previous visitor-scale heights exaggerated the three-storey silhouette.
export const ARCHITECTURAL_Y=.45;
export function assemblyAt(T){
  const state={settle:smooth(ASSEMBLY.anchor,ASSEMBLY.settled,T),roof:smooth(...ASSEMBLY.roof,T)};
  for(const key of ['ground','basement','first'])state[key]=Object.fromEntries(
    Object.entries(ASSEMBLY[key]).map(([name,range])=>[name,smooth(...range,T)]));
  return state;
}
export function presentationCamera(T){
  if(T<=ASSEMBLY.anchor)return cameraLocal(T);
  const a=cameraLocal(ASSEMBLY.anchor),over=smooth(...ASSEMBLY.planView,T);
  const spatial=smooth(...ASSEMBLY.spatialView,T);
  return {eye:a.eye.map((v,i)=>v+(PLAN.eye[i]-v)*over+(PRESENTATION.eye[i]-PLAN.eye[i])*spatial),
    aim:a.aim.map((v,i)=>v+(PLAN.aim[i]-v)*over+(PRESENTATION.aim[i]-PLAN.aim[i])*spatial),pin:a.pin};
}
export const planOverhead=T=>smooth(...ASSEMBLY.planView,T)*(1-smooth(...ASSEMBLY.spatialView,T));
// The drawing never leaves its measured position on the architect's desk.
// Every level and the final technical sheet share this one desk-scale origin.
export function assemblyOrigin(T){
  return originAt(story(Math.min(T,ASSEMBLY.anchor)));
}
