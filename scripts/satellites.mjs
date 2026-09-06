import {World} from '../js/physics.js';
import {readFileSync,writeFileSync} from 'node:fs';
import {CATALOG} from '../js/catalog.js';
for(const count of [650,1200,2000]){
 const w=new World(count,417),file=new URL(`../assets/pile-${count}.json`,import.meta.url);w.applySnapshot(JSON.parse(readFileSync(file,'utf8')));
 const selected=[];for(const type of [9,9,10,11,6,2,3,0,0,1,3,7,4,12,13,5,8,3]){const b=w.bodies.findLast(b=>b.type===type&&!selected.includes(b));if(b)selected.push(b);}
 selected.forEach((b,i)=>{const a=(i/selected.length)*Math.PI*2+.24,r=(5.7+(i%4)*.56)*Math.cbrt(count/1200);b.p=[Math.cos(a)*r,1.2,Math.sin(a)*r];const yaw=i*2.39,sy=Math.sin(yaw/2),cy=Math.cos(yaw/2);b.q=[0,1,5,8,9,10,11,12,13].includes(b.type)?[cy*Math.SQRT1_2,sy*Math.SQRT1_2,-sy*Math.SQRT1_2,cy*Math.SQRT1_2]:[0,sy,0,cy];w.wake(b);});
 for(let i=0;i<150;i++)w.step(1/75,4);writeFileSync(file,JSON.stringify(w.snapshot()));console.log('placed loose objects',count);
}
