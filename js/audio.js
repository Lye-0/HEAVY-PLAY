/** Procedural impact audio. No recordings, network requests, or autoplay. */
export class MetalAudio {
 constructor(){this.enabled=false;this.volume=.35;this.ctx=null;this.master=null;this.last=0;this.voices=0;}
 async toggle(){if(this.enabled){this.enabled=false;return false;}const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)throw new Error('このブラウザでは音声を再生できません。');
  if(!this.ctx){this.ctx=new Audio();const comp=this.ctx.createDynamicsCompressor();comp.threshold.value=-20;comp.knee.value=18;comp.ratio.value=5;comp.attack.value=.003;comp.release.value=.12;this.master=this.ctx.createGain();this.master.gain.value=this.volume*.22;this.master.connect(comp);comp.connect(this.ctx.destination);}
  if(this.ctx.state==='suspended')await this.ctx.resume();this.enabled=this.ctx.state==='running';return this.enabled;
 }
 setVolume(value){this.volume=value;if(this.master)this.master.gain.setTargetAtTime(value*.22,this.ctx.currentTime,.03);}
 impact(strength,body){if(!this.enabled||!this.ctx||this.ctx.state!=='running'||this.voices>10)return;const now=this.ctx.currentTime;if(now-this.last<.035)return;this.last=now;this.voices++;
  const base=(body.type===8?1100:body.type===9?460:body.type===3?1750:720+body.type*83)/body.scale,volume=Math.min(.75,strength*.045);
  const pan=this.ctx.createStereoPanner?this.ctx.createStereoPanner():this.ctx.createGain();if(pan.pan)pan.pan.value=Math.max(-.8,Math.min(.8,body.p[0]/10));pan.connect(this.master);
  const ratios=[1,2.76,5.40];for(let i=0;i<ratios.length;i++){const osc=this.ctx.createOscillator(),gain=this.ctx.createGain();osc.type='sine';osc.frequency.value=Math.min(14500,base*ratios[i]);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume/(i*2+1)),now+.002);const duration=(.13+.07/(i+1))*(body.type===8?2:1);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);osc.connect(gain);gain.connect(pan);osc.start(now);osc.stop(now+duration+.01);osc.onended=()=>{osc.disconnect();gain.disconnect();};}
  setTimeout(()=>{pan.disconnect();this.voices--;},500);
 }
 async visibility(hidden){if(!this.ctx)return;try{if(hidden)await this.ctx.suspend();else if(this.enabled)await this.ctx.resume();}catch{/* Some browsers require another user gesture. */}}
 dispose(){this.enabled=false;if(this.ctx)this.ctx.close().catch(()=>{});}
}
