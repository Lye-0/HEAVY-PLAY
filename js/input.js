import {CATALOG,METALS} from './catalog.js';
import {raySphere,rotate,clamp} from './math.js';

export class Interaction {
 constructor(app){this.app=app;this.canvas=app.renderer.canvas;this.pointers=new Map();this.gesture=null;this.hover=null;this.lastHover=0;this.lastMulti=null;
  const c=this.canvas;c.addEventListener('pointerdown',e=>this.down(e));c.addEventListener('pointermove',e=>this.move(e));c.addEventListener('pointerup',e=>this.up(e));c.addEventListener('pointercancel',e=>this.cancel(e));c.addEventListener('lostpointercapture',e=>{if(this.pointers.has(e.pointerId))this.cancel(e);});c.addEventListener('contextmenu',e=>e.preventDefault());c.addEventListener('wheel',e=>{e.preventDefault();app.interact();app.renderer.zoom(e.deltaY);},{passive:false});c.addEventListener('pointerleave',()=>{if(!this.gesture)this.clearHover();});window.addEventListener('blur',()=>this.clear());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clear();});window.addEventListener('keydown',e=>this.key(e));
 }
 pick(x,y){
  const renderer=this.app.renderer,ray=renderer.ray(x,y),candidates=[];
  for(const b of this.app.world.bodies){const c=CATALOG[b.type],rr=Math.hypot(...c.ext)*b.scale+.09,t=raySphere(ray.origin,ray.direction,b.p,rr);if(t!==null)candidates.push({b,t});}
  candidates.sort((a,b)=>a.t-b.t);let nearest=Infinity,chosen=null;
  for(const {b,t}of candidates){if(t>nearest)break;const q=[-b.q[0],-b.q[1],-b.q[2],b.q[3]],o=rotate(q,ray.origin.map((v,k)=>(v-b.p[k])/b.scale)),d=rotate(q,ray.direction),vertices=renderer.groups[b.type].cpu;
   for(let i=0;i<vertices.length;i+=21){
    const ax=vertices[i],ay=vertices[i+1],az=vertices[i+2],e1x=vertices[i+7]-ax,e1y=vertices[i+8]-ay,e1z=vertices[i+9]-az,e2x=vertices[i+14]-ax,e2y=vertices[i+15]-ay,e2z=vertices[i+16]-az;
    const px=d[1]*e2z-d[2]*e2y,py=d[2]*e2x-d[0]*e2z,pz=d[0]*e2y-d[1]*e2x,det=e1x*px+e1y*py+e1z*pz;if(Math.abs(det)<1e-8)continue;
    const inv=1/det,tx=o[0]-ax,ty=o[1]-ay,tz=o[2]-az,u=(tx*px+ty*py+tz*pz)*inv;if(u<0||u>1)continue;
    const qx=ty*e1z-tz*e1y,qy=tz*e1x-tx*e1z,qz=tx*e1y-ty*e1x,v=(d[0]*qx+d[1]*qy+d[2]*qz)*inv;if(v<0||u+v>1)continue;
    const hit=(e2x*qx+e2y*qy+e2z*qz)*inv*b.scale;if(hit>0&&hit<nearest){nearest=hit;chosen=b;}
   }
  }
  return chosen?{body:chosen,point:ray.origin.map((v,k)=>v+ray.direction[k]*nearest)}:null;
 }
 plane(x,y,point,normal){const ray=this.app.renderer.ray(x,y),den=ray.direction.reduce((a,v,k)=>a+v*normal[k],0);if(Math.abs(den)<.001)return point.slice();const t=point.reduce((a,v,k)=>a+(v-ray.origin[k])*normal[k],0)/den;return t>0?ray.origin.map((v,k)=>v+ray.direction[k]*t):point.slice();}
 ground(x,y){return this.plane(x,y,[0,.15,0],[0,1,0]);}
 down(e){if(e.button!==0&&e.button!==1&&e.button!==2)return;e.preventDefault();this.app.interact();this.canvas.focus({preventScroll:true});this.canvas.setPointerCapture(e.pointerId);this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});this.clearHover();
  if(this.pointers.size>=2){this.cancelGesture();this.lastMulti=this.multi();return;}
  const base={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,start:performance.now(),moved:0,id:e.pointerId};
  if(e.button===1||e.button===2||e.shiftKey||this.app.mode==='orbit'){this.gesture={...base,type:'orbit'};return;}
  if(this.app.paused||this.app.rebuilding){if(this.app.paused)this.app.toast('停止中です。▶ ボタンで再開できます。');return;}
  if(this.app.mode==='grab'){
   const hit=this.pick(e.clientX,e.clientY);if(!hit){this.gesture={...base,type:'orbit'};return;}
   this.app.world.wakeAll();const normal=this.app.renderer.forward.slice();this.gesture={...base,type:'grab',body:hit.body,plane:hit.point.slice(),normal,offset:hit.body.p.map((v,k)=>v-hit.point[k]),target:hit.body.p.slice(),velocity:[0,0,0],lastMove:performance.now()};hit.body.highlight=1;this.canvas.classList.add('is-grabbing');this.app.grab={body:hit.body,target:hit.body.p.slice()};
  }else if(this.app.mode==='blast'){
   const hit=this.pick(e.clientX,e.clientY);this.gesture={...base,type:'blast',point:hit?hit.point:this.ground(e.clientX,e.clientY)};this.indicator(e.clientX,e.clientY,0);
  }else if(this.app.mode==='magnet'){
   const hit=this.pick(e.clientX,e.clientY),p=hit?hit.point:this.ground(e.clientX,e.clientY);p[1]=Math.max(3,p[1]+1.8);this.gesture={...base,type:'magnet',plane:p.slice(),normal:this.app.renderer.forward.slice()};this.app.magnet=p;this.app.world.wakeAll();
  }
 }
 multi(){const a=[...this.pointers.values()];return {x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2,d:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)};}
 move(e){
  if(this.pointers.has(e.pointerId)){e.preventDefault();this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});this.app.interact();}
  if(this.pointers.size>=2){const m=this.multi();if(this.lastMulti){this.app.renderer.orbit(m.x-this.lastMulti.x,m.y-this.lastMulti.y);this.app.renderer.zoom(Math.log(Math.max(10,this.lastMulti.d)/Math.max(10,m.d))*1000);}this.lastMulti=m;return;}
  const g=this.gesture;if(!g){if(this.pointers.size)return;if(performance.now()-this.lastHover>60&&e.pointerType!=='touch'&&this.app.mode==='grab'){this.lastHover=performance.now();this.updateHover(e);}return;}
  const dx=e.clientX-g.lastX,dy=e.clientY-g.lastY;g.moved+=Math.hypot(dx,dy);g.lastX=e.clientX;g.lastY=e.clientY;
  if(g.type==='orbit')this.app.renderer.orbit(dx,dy);
  if(g.type==='grab'){
   const p=this.plane(e.clientX,e.clientY,g.plane,g.normal).map((v,k)=>v+g.offset[k]);p[1]=clamp(p[1],.3,14);p[0]=clamp(p[0],-20,20);p[2]=clamp(p[2],-20,20);const now=performance.now(),dt=Math.max(.008,(now-g.lastMove)/1000);
   g.velocity=p.map((v,k)=>clamp((v-g.target[k])/dt,-25,25)*.6+g.velocity[k]*.4);g.target=p;g.lastMove=now;this.app.grab.target=p;
  }
  if(g.type==='blast'){const hit=this.pick(e.clientX,e.clientY);g.point=hit?hit.point:this.ground(e.clientX,e.clientY);this.indicator(e.clientX,e.clientY,clamp((performance.now()-g.start)/1300,0,1));}
  if(g.type==='magnet'){const p=this.plane(e.clientX,e.clientY,g.plane,g.normal);p[1]=clamp(p[1],1.4,11);p[0]=clamp(p[0],-17,17);p[2]=clamp(p[2],-17,17);this.app.magnet=p;}
 }
 up(e){const g=this.gesture;
  if(g&&g.id===e.pointerId){
   if(g.type==='grab'){
    if(g.moved<6){const d=this.app.renderer.ray(e.clientX,e.clientY).direction;g.body.v=[d[0]*3,4.5,d[2]*3];g.body.w=[3,-2,4];}
    else if(performance.now()-g.lastMove<140)g.body.v=g.velocity.map((v,k)=>clamp(v*.78+g.body.v[k]*.38,-27,27));
   }
   if(g.type==='blast'){const power=.50+clamp((performance.now()-g.start)/1300,0,1)*1.45;this.app.blast(g.point,power);}
  }
  this.pointers.delete(e.pointerId);this.cancelGesture();this.lastMulti=null;if(this.canvas.hasPointerCapture(e.pointerId))this.canvas.releasePointerCapture(e.pointerId);
 }
 cancel(e){this.pointers.delete(e.pointerId);this.cancelGesture();this.lastMulti=null;}
 cancelGesture(){if(this.gesture?.body)this.gesture.body.highlight=0;this.gesture=null;this.app.grab=null;this.app.magnet=null;this.canvas.classList.remove('is-grabbing');document.getElementById('gesture-indicator').hidden=true;}
 clear(){this.cancelGesture();this.pointers.clear();this.lastMulti=null;this.clearHover();}
 clearHover(){if(this.hover)this.hover.highlight=0;this.hover=null;document.getElementById('hover-label').hidden=true;}
 updateHover(e){this.clearHover();const hit=this.pick(e.clientX,e.clientY);if(!hit)return;this.hover=hit.body;this.hover.highlight=.7;const label=document.getElementById('hover-label'),c=CATALOG[this.hover.type];document.getElementById('hover-en').textContent=c.en;document.getElementById('hover-ja').textContent=`${c.name}  /  ${METALS[this.hover.metal].name}`;label.hidden=false;label.style.left=`${Math.min(e.clientX+17,innerWidth-220)}px`;label.style.top=`${Math.min(e.clientY+21,innerHeight-80)}px`;}
 indicator(x,y,charge){const el=document.getElementById('gesture-indicator');el.hidden=false;el.style.left=`${x}px`;el.style.top=`${y}px`;document.getElementById('charge-arc').style.strokeDashoffset=String(163.4*(1-charge));}
 tick(now){if(this.gesture?.type==='blast'){const g=this.gesture;this.indicator(g.lastX,g.lastY,clamp((now-g.start)/1300,0,1));}}
 key(e){if(e.ctrlKey||e.metaKey||e.altKey||e.repeat)return;if(e.key==='Escape'){this.clear();this.app.closePanels();document.body.classList.remove('focus-mode');return;}if((e.target.closest('input,select,textarea,[contenteditable=true]')||(e.target.closest('button')&&[' ','Enter'].includes(e.key)))||document.getElementById('help').open)return;
  const key=e.key.toLowerCase(),modes={g:'grab',b:'blast',m:'magnet',o:'orbit'};if(modes[key]){e.preventDefault();this.app.setMode(modes[key]);}
  else if(key===' '){e.preventDefault();this.app.togglePause();}else if(key==='s'){e.preventDefault();this.app.toggleSlow();}else if(key==='r'){e.preventDefault();this.app.reset();}else if(key==='x'){e.preventDefault();this.app.scatter();}else if(key==='p'){e.preventDefault();this.app.pour();}else if(key==='h'){e.preventDefault();this.app.openHelp();}else if(key==='f'){e.preventDefault();document.body.classList.toggle('focus-mode');}
 }
}
