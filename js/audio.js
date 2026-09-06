import {CATALOG} from './catalog.js';
import {clamp} from './math.js';
import {METAL_SAMPLES} from './sounds.js';

const MAX_VOICES=32;

/** Recorded hard-metal impacts, bundled locally. See assets/audio/README.md. */
export class MetalAudio {
 constructor(){
  this.enabled=false;this.volume=.35;this.ctx=null;this.master=null;this.bus=null;
  this.bank={};this.voices=new Set();this.lastByBody=new WeakMap();this.lastVariant={};this.tokens=8;this.tokenTime=0;
 }
 initialize(ctx){
  this.ctx=ctx;this.bus=ctx.createGain();this.lastByBody=new WeakMap();this.lastVariant={};this.tokens=8;this.tokenTime=ctx.currentTime;
  const high=ctx.createBiquadFilter();high.type='highpass';high.frequency.value=55;high.Q.value=.6;
  const low=ctx.createBiquadFilter();low.type='lowpass';low.frequency.value=13500;low.Q.value=.6;
  const comp=ctx.createDynamicsCompressor();comp.threshold.value=-14;comp.knee.value=8;comp.ratio.value=4;comp.attack.value=.002;comp.release.value=.07;
  this.master=ctx.createGain();this.master.gain.value=0;
  this.bus.connect(high);high.connect(low);low.connect(comp);comp.connect(this.master);this.master.connect(ctx.destination);
  // Embedded PCM avoids file:// fetch restrictions and codec dependencies.
  this.bank=Object.fromEntries(Object.entries(METAL_SAMPLES.groups).map(([group,samples])=>[group,samples.map(encoded=>{
   const bytes=atob(encoded),buffer=ctx.createBuffer(1,bytes.length/2,METAL_SAMPLES.sampleRate),data=buffer.getChannelData(0);
   for(let i=0;i<data.length;i++){const value=bytes.charCodeAt(i*2)|(bytes.charCodeAt(i*2+1)<<8);data[i]=(value>32767?value-65536:value)/32768;}
   return buffer;
  })]));
 }
 async toggle(){
  if(this.enabled){
   this.enabled=false;this.setVolume(this.volume);
   const stop=this.ctx.currentTime+.03;for(const voice of this.voices)voice.source.stop(stop);
   return false;
  }
  const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)throw new Error('このブラウザでは音声を再生できません。');
  if(!this.ctx)this.initialize(new Audio());
  if(this.ctx.state==='suspended')await this.ctx.resume();
  this.enabled=this.ctx.state==='running';this.setVolume(this.volume);return this.enabled;
 }
 setVolume(value){
  this.volume=Number.isFinite(value)?clamp(value,0,1):this.volume;
  if(this.master)this.master.gain.setTargetAtTime(this.enabled?this.volume*.55:0,this.ctx.currentTime,.008);
 }
 impact(strength,body,surface='metal'){
  if(!this.enabled||!this.ctx||this.ctx.state!=='running'||!body||!Number.isFinite(strength)||strength<.8)return;
  const now=this.ctx.currentTime,mass=body.mass||CATALOG[body.type]?.mass||1;
  const important=surface==='floor'&&strength*Math.sqrt(mass)>3,last=this.lastByBody.get(body);
  this.tokens=Math.min(8,this.tokens+Math.max(0,now-this.tokenTime)*72);this.tokenTime=now;
  // Reserve a few voices and burst slots for weighty floor strikes.
  if(this.tokens<(important?-2:1)||this.voices.size>=(important?MAX_VOICES:MAX_VOICES-6))return;
  if(last&&last.surface===surface&&now-last.time<.04&&strength<last.strength*1.8)return;
  this.tokens--;this.lastByBody.set(body,{time:now,strength,surface});this.playImpact(strength,body,now+Math.random()*.003,surface);
 }
 playImpact(strength,body,when=this.ctx.currentTime,surface='metal'){
  const mass=body.mass||CATALOG[body.type]?.mass||1,force=strength*Math.sqrt(mass);
  const group=surface==='floor'?'floor':(force>6.5?'heavy':force>2.2||mass>1.5?'medium':'light');
  const rate=clamp((.985+Math.random()*.03)/Math.pow(body.scale||1,.1),.93,1.07);
  const weight=clamp(Math.pow(mass/1.3,.25),.7,1.5);
  const level=clamp(.075*Math.pow(strength,.78)*weight*(surface==='floor'?1.2:1),.025,.7);
  return this.startVoice(group,level,rate,body.p?.[0]||0,when,surface);
 }
 startVoice(group,level,rate,x,when,surface){
  const variants=this.bank[group];let index=Math.floor(Math.random()*variants.length);
  if(index===this.lastVariant[group])index=(index+1)%variants.length;this.lastVariant[group]=index;
  const source=this.ctx.createBufferSource(),gain=this.ctx.createGain();
  const pan=this.ctx.createStereoPanner?this.ctx.createStereoPanner():this.ctx.createGain();
  source.buffer=variants[index];
  source.playbackRate.value=rate;gain.gain.value=level;
  if(pan.pan)pan.pan.value=clamp(x/10,-.85,.85);
  source.connect(gain);gain.connect(pan);pan.connect(this.bus);
  const voice={source,gain,pan,group,surface,index,when};this.voices.add(voice);
  source.onended=()=>{source.disconnect();gain.disconnect();pan.disconnect();this.voices.delete(voice);};
  source.start(when);return voice;
 }
 silence(){
  if(!this.ctx)return;const now=this.ctx.currentTime;
  for(const {source,gain}of this.voices){gain.gain.cancelScheduledValues(now);gain.gain.setValueAtTime(gain.gain.value,now);gain.gain.linearRampToValueAtTime(0,now+.02);source.stop(now+.025);}
 }
 clearVoices(){
  for(const {source,gain,pan}of this.voices){source.onended=null;source.stop();source.disconnect();gain.disconnect();pan.disconnect();}
  this.voices.clear();
 }
 async visibility(hidden){
  if(!this.ctx)return;
  try{if(hidden){this.clearVoices();await this.ctx.suspend();}else if(this.enabled)await this.ctx.resume();}catch{/* Some browsers require another user gesture. */}
 }
 dispose(){this.enabled=false;this.clearVoices();if(this.ctx)this.ctx.close().catch(()=>{});this.ctx=null;this.master=null;this.bus=null;this.bank={};}
}
