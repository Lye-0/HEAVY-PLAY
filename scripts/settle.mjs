import {World} from '../js/physics.js';
import {writeFileSync} from 'node:fs';
const count=Number(process.argv[2]||1200),steps=Number(process.argv[3]||240);
const w=new World(count,417);const started=performance.now();
for(let i=0;i<steps;i++){w.step(1/75,5);if(i%60===0)console.log('settle',count,i,Math.round(performance.now()-started)+'ms',w.active);}
writeFileSync(new URL(`../assets/pile-${count}.json`,import.meta.url),JSON.stringify(w.snapshot()));
console.log('done',count,(performance.now()-started)/1000,'height',Math.max(...w.bodies.map(b=>b.p[1])),'radius',Math.max(...w.bodies.map(b=>Math.hypot(b.p[0],b.p[2]))));
