import {Renderer} from './renderer.js';
import {World} from './physics.js';
import {MetalAudio} from './audio.js';
import {Interaction} from './input.js';
import {PRESETS,CATALOG,chooseType} from './catalog.js';
import {SNAPSHOTS} from './snapshots.js';
import {clamp,randomQuat} from './math.js';

const $=id=>document.getElementById(id);
const HERO_IDLE_DELAY=5000;
const MODE_TEXT={
 grab:{caption:'GRAB SOMETHING. LET IT GO.',hint:'部品をドラッグして、放すと投げられます。'},
 blast:{caption:'HOLD IT. FEEL THE RELEASE.',hint:'長押しで衝撃をためて、離すと吹き飛びます。'},
 magnet:{caption:'A LITTLE ATTRACTION. A LOT OF CHAOS.',hint:'長押しで集めて、動かして、放してみましょう。'},
 orbit:{caption:'A DIFFERENT ANGLE. THE SAME BEAUTIFUL MESS.',hint:'ドラッグで回転。スクロールで近づけます。'}
};
function loadSettings(){try{return JSON.parse(localStorage.getItem('heavy-play-settings-v1')||'{}');}catch{return {};}}
export class Playground {
 constructor(){
  const prefs=loadSettings();this.quality=PRESETS[prefs.quality]?prefs.quality:'standard';this.mode='grab';this.paused=false;this.slow=false;this.grab=null;this.magnet=null;this.rebuilding=null;this.waves=[];this.dropQueue=0;this.dropTimer=0;this.time=0;this.frames=0;this.lastFrame=performance.now();this.lastInteraction=this.lastFrame;this.accumulator=0;this.hidden=document.hidden;this.fps=60;this.frameTimes=[];
  this.heroHidden=false;this.heroIdleAt=0;
  this.renderer=new Renderer($('world'),PRESETS[this.quality]);this.audio=new MetalAudio();this.audio.setVolume(typeof prefs.volume==='number'?clamp(prefs.volume,0,1):.35);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;this.reducedMotion=reduced;this.renderer.autoRotate=typeof prefs.autoRotate==='boolean'?prefs.autoRotate:!reduced;
  this.createWorld();this.input=new Interaction(this);this.bindUI();this.updateCount();this.updateState();this.updateSpecPosition();
  $('quality').value=this.quality;$('volume').value=Math.round(this.audio.volume*100);$('volume-value').textContent=Math.round(this.audio.volume*100)+'%';$('auto-rotate').checked=this.renderer.autoRotate;
  let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{this.renderer.resize();this.updateSpecPosition();},70);});
  $('world').addEventListener('webglcontextlost',e=>{e.preventDefault();this.renderer.lost=true;this.fail('グラフィック処理が中断されました。ほかの重いアプリを閉じてから「もう一度開く」を押してください。');});
  document.addEventListener('visibilitychange',()=>{this.hidden=document.hidden;this.lastFrame=performance.now();this.accumulator=0;this.audio.visibility(this.hidden);});
  this.frame=this.frame.bind(this);requestAnimationFrame(this.frame);window.__HEAVY_PLAY__=this;
 }
 createWorld(){this.audio.silence();this.world=new World(PRESETS[this.quality].count,417);const snapshot=SNAPSHOTS[String(PRESETS[this.quality].count)];if(snapshot)this.world.applySnapshot(snapshot);this.world.onImpact=(s,b,surface)=>this.audio.impact(s,b,surface);this.baseSnapshot=this.world.snapshot();}
 bindUI(){
  document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>this.setMode(button.dataset.mode)));
  $('scatter').addEventListener('click',()=>this.scatter());$('pour').addEventListener('click',()=>this.pour());$('reset').addEventListener('click',()=>this.reset());$('pause').addEventListener('click',()=>this.togglePause());$('slow').addEventListener('click',()=>this.toggleSlow());
  $('home').addEventListener('click',e=>{e.preventDefault();this.renderer.resetCamera();this.interact();});
  $('sound').addEventListener('click',async()=>{const button=$('sound');button.disabled=true;try{const on=await this.audio.toggle();button.setAttribute('aria-pressed',String(on));button.querySelector('use').setAttribute('href',on?'#i-sound':'#i-mute');button.querySelector('span').textContent=on?'SOUND ON':'SOUND OFF';button.setAttribute('aria-label',on?'金属音をオフにする':'金属音をオンにする');button.title=button.getAttribute('aria-label');if(on){this.toast('SOUND ON — 金属の響きも、楽しんで。');}}catch(e){this.toast(e.message||'音声を開始できませんでした。');}finally{button.disabled=false;}});
  $('settings-toggle').addEventListener('click',()=>this.toggleSettings());$('settings-close').addEventListener('click',()=>this.toggleSettings(false));$('help-toggle').addEventListener('click',()=>this.openHelp());$('help-close').addEventListener('click',()=>$('help').close());$('help-start').addEventListener('click',()=>$('help').close());
  $('help').addEventListener('click',e=>{if(e.target===$('help')){const r=$('help').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('help').close();}});
  document.addEventListener('pointerdown',e=>{this.interact();if(!$('settings').hidden&&!e.target.closest('#settings,#settings-toggle'))this.toggleSettings(false);});
  for(const type of ['pointerup','pointercancel','keydown','input'])document.addEventListener(type,()=>this.interact());
  $('quality').addEventListener('change',()=>this.changeQuality($('quality').value));$('volume').addEventListener('input',()=>{this.audio.setVolume(Number($('volume').value)/100);$('volume-value').textContent=$('volume').value+'%';this.save();});
  $('auto-rotate').addEventListener('change',()=>{this.renderer.autoRotate=$('auto-rotate').checked;if(this.renderer.autoRotate)this.lastInteraction=performance.now()-15000;this.save();});
  $('reset-camera').addEventListener('click',()=>{this.renderer.resetCamera();this.interact();this.toast('最初の視点に戻しました。');});
  $('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement){await document.exitFullscreen();}else if(document.documentElement.requestFullscreen){await document.documentElement.requestFullscreen();}else this.toast('このブラウザは全画面表示に対応していません。');}catch{this.toast('全画面表示を開始できませんでした。');}});
  $('help').addEventListener('close',()=>{$('help-toggle').focus({preventScroll:true});this.interact();});
 }
 save(){try{localStorage.setItem('heavy-play-settings-v1',JSON.stringify({quality:this.quality,volume:this.audio.volume,autoRotate:this.renderer.autoRotate}));}catch{/* Storage is optional, including sandboxed preview environments. */}}
 interact(){this.lastInteraction=performance.now();this.heroIdleAt=this.lastInteraction+HERO_IDLE_DELAY;if(!this.heroHidden){this.heroHidden=true;$('playground').classList.add('is-interacting');}}
 revealHero(){this.heroHidden=false;this.heroIdleAt=0;$('playground').classList.remove('is-interacting');}
 updateHero(now){
  if(!this.heroHidden)return;
  // A held pointer is still active, even when it has stopped moving.
  if(this.input.pointers.size){this.heroIdleAt=now+HERO_IDLE_DELAY;return;}
  if(now>=this.heroIdleAt)this.revealHero();
 }
 updateSpecPosition(){
  const spec=$('part-count').parentElement,note=document.querySelector('.bottom-note'),hint=$('context-hint').parentElement;
  const origin=spec.offsetParent.getBoundingClientRect(),anchor=hint.getClientRects().length?hint:note;
  let x=0,y=0;
  if(anchor.getClientRects().length){
   const target=anchor.getBoundingClientRect();
   // Narrow screens omit the hint; use the space vacated by the bottom copy.
   const bottom=anchor===hint?target.top-16:Math.min(target.bottom,document.querySelector('.mode-caption').getBoundingClientRect().top)-16;
   x=target.left-origin.left-spec.offsetLeft;y=bottom-origin.top-spec.offsetTop-spec.offsetHeight;
  }
  spec.style.setProperty('--spec-shift-x',x+'px');spec.style.setProperty('--spec-shift-y',y+'px');
 }
 setMode(mode){if(!MODE_TEXT[mode])return;this.input.clear();this.mode=mode;this.interact();document.querySelectorAll('[data-mode]').forEach(b=>{const on=b.dataset.mode===mode;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});$('mode-caption').textContent=MODE_TEXT[mode].caption;$('context-hint').textContent=MODE_TEXT[mode].hint;$('world').classList.toggle('is-blast',mode==='blast');$('world').classList.toggle('is-magnet',mode==='magnet');this.updateSpecPosition();}
 togglePause(){if(this.rebuilding)return;this.paused=!this.paused;if(this.paused)this.audio.silence();this.input.clear();this.accumulator=0;this.interact();this.updateState();}
 toggleSlow(){this.slow=!this.slow;this.interact();this.updateState();}
 updateState(){document.body.classList.toggle('is-paused',this.paused);document.body.classList.toggle('is-slow',this.slow);$('pause').setAttribute('aria-pressed',String(this.paused));$('pause').setAttribute('aria-label',this.paused?'再生':'一時停止');$('pause').title=this.paused?'再生（Space）':'一時停止（Space）';$('pause').querySelector('use').setAttribute('href',this.paused?'#i-play':'#i-pause');$('slow').setAttribute('aria-pressed',String(this.slow));$('slow').querySelector('span').textContent=this.slow?'¼×':'1×';$('simulation-state').textContent=this.rebuilding?'REASSEMBLING':this.paused?'TIME IS PAUSED':this.slow?'SLOW MOTION / 0.25×':'LIVE SIMULATION';}
 updateCount(){$('part-count').textContent=this.world.bodies.length.toLocaleString('en-US');$('quality-label').textContent=PRESETS[this.quality].count.toLocaleString('en-US')+' PARTS';}
 toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2800);}
 blast(point,power=1){if(this.rebuilding)return;this.paused=false;this.updateState();this.interact();this.world.blast(point,power,4.5+power*1.4);this.waves.push({p:[point[0],.035,point[2]],start:this.time,strength:power});}
 scatter(){if(this.rebuilding)return;this.input.clear();this.blast([0,.1,0],1.8);this.toast('MAKE A MESS.');}
 pour(){if(this.rebuilding)return;const capacity=2600-this.world.bodies.length-this.dropQueue;if(capacity<=0){this.toast('この世界はいっぱいです。積み直すと、また足せます。');return;}const amount=Math.min(90,capacity);this.dropQueue+=amount;this.paused=false;this.world.wakeAll();this.updateState();this.interact();this.toast(`+${amount} PARTS — もう少し、にぎやかに。`);}
 reset(){if(this.rebuilding)return;this.audio.silence();this.input.clear();this.dropQueue=0;this.waves=[];this.paused=false;this.accumulator=0;const count=PRESETS[this.quality].count;this.world.bodies.length=count;this.lastInteraction=performance.now();this.revealHero();
  if(this.reducedMotion){this.world.applySnapshot(this.baseSnapshot);this.renderer.shadowDirty=true;this.updateCount();this.updateState();this.toast('また、好きなだけ。');return;}
  this.rebuilding={start:this.time,from:this.world.bodies.map(b=>({p:b.p.slice(),q:b.q.slice()}))};for(const b of this.world.bodies){b.v.fill(0);b.w.fill(0);}this.setActionDisabled(true);this.updateCount();this.updateState();this.toast('ひとつずつ、元の山へ。');
 }
 setActionDisabled(value){for(const id of ['reset','scatter','pour'])$(id).disabled=value;}
 changeQuality(quality){if(!PRESETS[quality])return;this.input.clear();this.rebuilding=null;this.setActionDisabled(false);this.dropQueue=0;this.waves=[];this.quality=quality;this.paused=false;this.accumulator=0;this.createWorld();this.renderer.setQuality(PRESETS[quality]);this.renderer.shadowDirty=true;this.updateCount();this.updateState();this.save();this.interact();this.toast(`${PRESETS[quality].count.toLocaleString('en-US')} 個の、新しい山。`);}
 toggleSettings(force){const open=typeof force==='boolean'?force:$('settings').hidden;$('settings').hidden=!open;$('settings-toggle').setAttribute('aria-expanded',String(open));if(open){this.input.clear();this.interact();}}
 openHelp(){this.audio.silence();this.toggleSettings(false);this.input.clear();if(!$('help').open)$('help').showModal();this.interact();}
 closePanels(){this.toggleSettings(false);if($('help').open)$('help').close();}
 fail(message){$('loading').classList.add('done');$('error-message').textContent=message;$('error').hidden=false;}
 tickRebuild(){const state=this.rebuilding,t=clamp((this.time-state.start)/1.25,0,1),ease=t*t*(3-2*t);for(let i=0;i<this.world.bodies.length;i++){const b=this.world.bodies[i],from=state.from[i],j=i*7;for(let k=0;k<3;k++)b.p[k]=from.p[k]+(this.baseSnapshot[j+k]-from.p[k])*ease;b.p[1]+=Math.sin(t*Math.PI)*(.8+(i%7)*.12);for(let k=0;k<4;k++)b.q[k]=from.q[k]+(this.baseSnapshot[j+3+k]-from.q[k])*ease;const l=Math.hypot(...b.q)||1;for(let k=0;k<4;k++)b.q[k]/=l;}
  if(t>=1){this.world.applySnapshot(this.baseSnapshot);this.rebuilding=null;this.setActionDisabled(false);this.updateState();}
 }
 frame(now){
  requestAnimationFrame(this.frame);if(this.hidden||this.renderer.lost){this.lastFrame=now;return;}
  const rawDt=Math.max(.001,(now-this.lastFrame)/1000),dt=Math.min(rawDt,.045);this.lastFrame=now;this.time+=dt;this.frames++;this.input.tick(now);this.updateHero(now);
  if(this.renderer.autoRotate&&!this.input.gesture&&now-this.lastInteraction>8000&&!this.paused&&!this.rebuilding&&$('settings').hidden&&!$('help').open){this.renderer.yaw+=dt*.025;this.renderer.updateCamera();}
  if(this.rebuilding)this.tickRebuild();
  else if(!this.paused&&!$('help').open){
   this.accumulator+=dt*(this.slow?.25:1);let steps=0;
   while(this.accumulator>=1/60&&steps<3){
    if(this.grab)this.world.pull(this.grab.body,this.grab.target,1/60);if(this.magnet)this.world.magnet(this.magnet,1/60);
    if(this.dropQueue>0){this.dropTimer+=1/60;if(this.dropTimer>.025){this.dropTimer=0;for(let i=0;i<2&&this.dropQueue>0;i++){const r=this.world.random,a=r()*Math.PI*2,d=Math.sqrt(r())*2,b=this.world.add(chooseType(r),[Math.cos(a)*d,9+r()*3,Math.sin(a)*d],randomQuat(r),.76+r()*.47,r()<.23?2:0);b.v=[(r()-.5)*2,-1,(r()-.5)*2];this.dropQueue--;}this.updateCount();}}
    this.world.step(1/60,4);this.accumulator-=1/60;steps++;
   }
   if(steps>=3)this.accumulator=0;
  }
  this.renderer.halos=[];this.waves=this.waves.filter(w=>this.time-w.start<.75);
  for(const w of this.waves){const age=(this.time-w.start)/.75;this.renderer.halos.push({p:w.p,r:.2+age*(7+w.strength),alpha:(1-age)**2*.65});}
  if(this.input.gesture?.type==='blast'){const g=this.input.gesture,charge=clamp((now-g.start)/1300,0,1);this.renderer.halos.push({p:[g.point[0],.04,g.point[2]],r:.6+charge*1.5,alpha:.55});}
  if(this.magnet){const phase=this.time*1.8;this.renderer.halos.push({p:this.magnet.slice(),r:.7+Math.sin(phase)*.04,alpha:.45},{p:[this.magnet[0],.04,this.magnet[2]],r:2+Math.sin(phase)*.2,alpha:.18},{p:this.magnet.slice(),q:[Math.SQRT1_2,0,0,Math.SQRT1_2],r:.7,alpha:.35});}
  this.renderer.render(this.world.bodies,this.time,(!this.paused&&this.world.active>0)||!!this.rebuilding||!!this.grab||this.dropQueue>0);
  this.fps=this.fps*.96+(1/rawDt)*.04;
  if(this.frames===2){$('loading').classList.add('done');$('playground').dataset.ready='true';setTimeout(()=>$('loading').hidden=true,600);}
 }
}
function boot(){try{new Playground();}catch(e){console.error('HEAVY / PLAY:',e);$('loading').classList.add('done');$('error-message').textContent=e.message==='WEBGL2_UNAVAILABLE'?'WebGL 2 が利用できません。Chrome、Edge、Firefox、Safariの対応環境で、ハードウェアアクセラレーションを有効にして開いてください。':'3Dの初期化に失敗しました。ページを開き直してください。改善しない場合は、ブラウザのグラフィック設定をご確認ください。';$('error').hidden=false;}}
boot();
