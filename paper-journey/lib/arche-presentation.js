import * as THREE from '../vendor/three.module.js';
import { reducible } from './core.js';
import { smooth } from './timeline.js';

// Presentation only: read the existing assembly without adding a second clock.
// Tone, not transparency, lets completed levels recede without losing walls.
export const levelEmphasis=(state,key)=>key==='basement'
  ? 1-smooth(0,.8,state.ground.plan)
  : key==='ground'?1-smooth(0,.8,state.first.plan):1;

// Interior contents recede as their ceiling closes, before the next plan starts.
// The top floor remains the active layer; structural emphasis is independent.
export const interiorVisibility=(state,key)=>key==='first'?1:1-smooth(0,1,state[key].slab);

const PAPER_TONES={
  stone:'#b8b3a8',plaster:'#cac6bd',timber:'#776e60',dark:'#343a38',
  green:'#73796c',bronze:'#918370',fabric:'#aaa599',glass:'#bbc2bd',
  plate:'#c8c5bb',rim:'#777a73',structure:'#777c75'
};

export function levelMaterials(){
  const entries=[];
  const quiet=new THREE.Color('#b6b5ad');
  return {
    material(role,color,extra={}){
      const m=reducible(new THREE.MeshStandardMaterial({color,roughness:.88,envMapIntensity:.25,...extra}),'project');
      const ink={value:new THREE.Color(PAPER_TONES[role])};
      const base=m.color.clone(),card=ink.value.clone();
      const compile=m.onBeforeCompile;
      m.onBeforeCompile=shader=>{
        compile(shader);
        // Preserve material distinctions even during the shared card phase.
        shader.uniforms.uClayColour=ink;
        // The atelier compositor treats warm radiance as its two printing inks.
        // Bound highlights and restrain chroma on this model alone, preserving
        // shaded planes instead of flattening them into the desk's paper tone.
        shader.fragmentShader=shader.fragmentShader.replace('#include <dithering_fragment>',`
          gl_FragColor.rgb /= vec3(1.0) + gl_FragColor.rgb;
          float modelValue = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          gl_FragColor.rgb = mix(vec3(modelValue), gl_FragColor.rgb, 0.12);
          #include <dithering_fragment>`);
      };
      m.customProgramCacheKey=()=> 'arche-presentation';
      entries.push({m,base,card,ink});
      return m;
    },
    interiorFade(groups){
      // Furniture shares colours with walls, but must never fade their materials.
      const copies=new Map();
      for(const group of groups)group.traverse(o=>{
        if(!o.isMesh)return;
        const entry=entries.find(({m})=>m===o.material);
        if(!entry)return; // Image plates keep their existing animation channel.
        if(!copies.has(o.material)){
          const m=o.material.clone();
          m.onBeforeCompile=o.material.onBeforeCompile;
          m.customProgramCacheKey=o.material.customProgramCacheKey;
          copies.set(o.material,m);
          entries.push({...entry,m});
        }
        o.material=copies.get(o.material);
      });
      return amount=>{
        for(const [source,m] of copies){
          const transparent=source.transparent||amount<1;
          if(m.transparent!==transparent){m.transparent=transparent;m.needsUpdate=true;}
          m.opacity=source.opacity*amount;
          m.depthWrite=source.depthWrite&&amount===1;
        }
      };
    },
    emphasize(amount){
      for(const {m,base,card,ink} of entries){
        const calm=(1-amount)*.58;
        m.color.copy(base).lerp(quiet,calm);
        ink.value.copy(card).lerp(quiet,calm);
      }
    }
  };
}

export function slabAppearance(phase,emphasis){
  return {
    // Closing faces stay light enough to see the finished room; as the next
    // floor starts, its support becomes more solid and screens lower detail.
    face:phase.slab*(.24+.30*(1-emphasis)),
    edge:phase.slab*(.56+.28*emphasis)
  };
}
