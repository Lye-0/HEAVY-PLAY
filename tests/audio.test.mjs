import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {World} from '../js/physics.js';
import {MetalAudio} from '../js/audio.js';
import {createHash} from 'node:crypto';

test('bundled impact recordings contain valid, non-silent PCM with quiet edges',()=>{
 const bank=JSON.parse(readFileSync(new URL('../assets/audio/metal-impacts.json',import.meta.url),'utf8'));
 assert.equal(bank.sampleRate,32000);
 for(const group of ['light','medium','heavy','floor']){
  assert.ok(bank.groups[group].length>=3);assert.equal(new Set(bank.groups[group]).size,bank.groups[group].length);
  for(const encoded of bank.groups[group]){
   const data=Buffer.from(encoded,'base64');assert.equal(data.toString('base64'),encoded);assert.equal(data.length%2,0);
   assert.ok(data.length>bank.sampleRate*.1);assert.ok(data.length<bank.sampleRate*4);
   assert.equal(data.readInt16LE(0),0);assert.equal(data.readInt16LE(data.length-2),0);
   let peak=0;for(let i=0;i<data.length;i+=2)peak=Math.max(peak,Math.abs(data.readInt16LE(i)));
   assert.ok(peak>1000&&peak<32767);
  }
 }
});

test('every prepared cue maps to an intact supplied recording',()=>{
 const base=new URL('../assets/audio/',import.meta.url),sources=JSON.parse(readFileSync(new URL('sources.json',base),'utf8'));
 const cuts=JSON.parse(readFileSync(new URL('cues.json',base),'utf8')),bank=JSON.parse(readFileSync(new URL('metal-impacts.json',base),'utf8'));
 const byId=new Map(sources.map(source=>[source.id,source]));assert.equal(sources.length,23);assert.equal(byId.size,sources.length);
 for(const source of sources){
  assert.match(source.file,/^source\/[a-z0-9-]+\.(mp3|wav)$/);assert.ok(source.originalName);
  assert.equal(createHash('sha256').update(readFileSync(new URL(source.file,base))).digest('hex'),source.sha256);
 }
 const used=new Set();
 for(const [group,cues]of Object.entries(cuts.groups)){
  assert.equal(cues.length,bank.groups[group].length);
  cues.forEach((cue,index)=>{const source=byId.get(cue.source);assert.ok(source);used.add(cue.source);assert.ok(cue.start>=0&&cue.start+cue.duration<=source.duration+.0001);
   const pcm=Buffer.from(bank.groups[group][index],'base64');assert.equal(pcm.length,cue.frames*2);assert.equal(createHash('sha256').update(pcm).digest('hex'),cue.pcmSha256);
  });
 }
 assert.ok(used.size>0);
});

test('physics identifies floor impacts and the heavier part in metal contacts',()=>{
 const pair=new World(0),light=pair.add(0,[0,4,0],[0,0,0,1]),heavy=pair.add(9,[.2,4,0],[0,0,0,1]);
 light.v[0]=3;heavy.v[0]=-3;const contacts=[];pair.onImpact=(strength,body,surface)=>contacts.push({strength,body,surface});
 pair.step(1/60,1);
 assert.ok(contacts.some(hit=>hit.surface==='metal'&&hit.body===heavy&&hit.strength>1));
 const floor=new World(0),tool=floor.add(9,[0,.9,0],[0,0,0,1]),drops=[];tool.v[1]=-6;
 floor.onImpact=(strength,body,surface)=>drops.push({strength,body,surface});floor.step(1/60,1);
 assert.ok(drops.some(hit=>hit.surface==='floor'&&hit.body===tool&&hit.strength>1));
});

test('the floor palette uses short cutlery contacts at every impact strength',()=>{
 const cues=JSON.parse(readFileSync(new URL('../assets/audio/cues.json',import.meta.url),'utf8'));
 for(const cue of cues.groups.floor){assert.match(cue.source,/^cutlery-/);assert.ok(cue.duration<=.2);}
 const audio=new MetalAudio();audio.startVoice=group=>({group});
 for(const strength of [2,5,15])for(const mass of [.45,1.3,3])assert.equal(audio.playImpact(strength,{type:9,mass,scale:1,p:[0,0,0]},0,'floor').group,'floor');
});

test('supported parts do not replay a floor strike until they leave and land again',()=>{
 const world=new World(0),body=world.add(2,[0,.1,0],[0,0,0,1]),hits=[];world.onImpact=(strength,part,surface)=>hits.push(surface);
 body.v[1]=-4;world.step(1/60,1);assert.deepEqual(hits,['floor']);
 body.v[1]=-4;world.step(1/60,1);assert.deepEqual(hits,['floor']);
 body.p[1]=3;body.v.fill(0);world.step(1/60,1);
 body.p[1]=.1;body.v[1]=-4;world.step(1/60,1);assert.deepEqual(hits,['floor','floor']);
});

test('settled pile contact corrections stay silent after waking and settling',()=>{
 const world=new World(1200);world.applySnapshot(JSON.parse(readFileSync(new URL('../assets/pile-1200.json',import.meta.url),'utf8')));world.wakeAll();
 for(let i=0;i<480;i++)world.step(1/60);
 let events=0;world.onImpact=()=>events++;
 for(let i=0;i<600;i++)world.step(1/60);
 assert.equal(events,0);
});
