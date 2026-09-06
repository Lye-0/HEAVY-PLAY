import { TAU, cross, normalize } from './math.js';

class MeshBuilder {
 constructor(){this.data=[];}
 vertex(p,n,shade=1){this.data.push(...p,...n,shade);}
 tri(a,b,c,shade=1,ns=null){const n=ns?null:normalize(cross(b.map((v,i)=>v-a[i]),c.map((v,i)=>v-a[i])));this.vertex(a,ns?.[0]||n,shade);this.vertex(b,ns?.[1]||n,shade);this.vertex(c,ns?.[2]||n,shade);}
 quad(a,b,c,d,shade=1,ns=null){this.tri(a,b,c,shade,ns&&[ns[0],ns[1],ns[2]]);this.tri(a,c,d,shade,ns&&[ns[0],ns[2],ns[3]]);}
 lathe(profile,segments=20,shade=1,center=[0,0,0],radial=null){
  for(let j=0;j<profile.length-1;j++)for(let i=0;i<segments;i++){
   const a=i/segments*TAU,b=(i+1)/segments*TAU,[r0,y0]=profile[j],[r1,y1]=profile[j+1];
   const point=(r,y,t)=>{const rr=radial?radial(r,t):r;return [center[0]+Math.cos(t)*rr,center[1]+y,center[2]+Math.sin(t)*rr];};
   // Winding is outward for a profile that travels from bottom to top on the outer surface.
   const p0=point(r0,y0,a),p1=point(r1,y1,a),p2=point(r1,y1,b),p3=point(r0,y0,b);
   if(radial){this.quad(p0,p1,p2,p3,shade);}else{
    const normal=t=>normalize([(y1-y0)*Math.cos(t),r0-r1,(y1-y0)*Math.sin(t)]);
    this.quad(p0,p1,p2,p3,shade,[normal(a),normal(a),normal(b),normal(b)]);
   }
  }
 }
 cylinder(r,length,y=0,n=16,shade=1){this.lathe([[0,-length/2],[r,-length/2],[r,length/2],[0,length/2]],n,shade,[0,y,0]);}
 ring(ro,ri,h,n=24,shade=1,bevel=.018){this.lathe([[ri,-h/2+bevel],[ri+bevel,-h/2],[ro-bevel,-h/2],[ro,-h/2+bevel],[ro,h/2-bevel],[ro-bevel,h/2],[ri+bevel,h/2],[ri,h/2-bevel],[ri,-h/2+bevel]],n,shade);}
 tube(path,r=.03,sides=5,shade=1){
  const rings=[];
  for(let i=0;i<path.length;i++){
   const a=path[Math.max(0,i-1)],b=path[Math.min(path.length-1,i+1)],t=normalize(b.map((v,k)=>v-a[k]));
   const u=normalize(cross(t,Math.abs(t[1])>.93?[1,0,0]:[0,1,0])),v=cross(t,u);
   rings.push(Array.from({length:sides},(_,j)=>{const s=j/sides*TAU,n=u.map((x,k)=>x*Math.cos(s)+v[k]*Math.sin(s));return {p:path[i].map((x,k)=>x+r*n[k]),n};}));
  }
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<sides;j++){
   const k=(j+1)%sides,a=rings[i][j],b=rings[i][k],c=rings[i+1][k],d=rings[i+1][j];this.quad(a.p,b.p,c.p,d.p,shade,[a.n,b.n,c.n,d.n]);
  }
 }
 thread(radius,start,end,turns,thickness=.018,shade=.83){const n=Math.ceil(turns*14),p=[];for(let i=0;i<=n;i++){const t=i/n,a=t*turns*TAU;p.push([Math.cos(a)*radius,start+(end-start)*t,Math.sin(a)*radius]);}this.tube(p,thickness,4,shade);}
 sphere(radius,center=[0,0,0],shade=1,segments=10,rings=7){
  const p=(u,v)=>[Math.sin(v)*Math.cos(u),Math.cos(v),Math.sin(v)*Math.sin(u)];
  for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){
   const u=i/segments*TAU,w=(i+1)/segments*TAU,v=j/rings*Math.PI,z=(j+1)/rings*Math.PI;
   const ns=[p(u,v),p(u,z),p(w,z),p(w,v)],ps=ns.map(n=>n.map((x,k)=>center[k]+radius*x));this.quad(...ps,shade,ns);
  }
 }
 box(x,y,z,center=[0,0,0],shade=1){const a=x/2,b=y/2,c=z/2,vs=[[-a,-b,-c],[a,-b,-c],[a,b,-c],[-a,b,-c],[-a,-b,c],[a,-b,c],[a,b,c],[-a,b,c]].map(p=>p.map((v,k)=>v+center[k]));for(const f of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]])this.quad(...f.map(i=>vs[i]),shade);}
 polygon(points,depth=.12,shade=1){
  let area=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];area+=a[0]*b[1]-b[0]*a[1];}if(area<0)points=points.slice().reverse();
  const ids=points.map((_,i)=>i),triangles=[];let guard=0;
  const orient=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  while(ids.length>2&&guard++<points.length*points.length){let found=false;for(let k=0;k<ids.length;k++){const ai=ids[(k+ids.length-1)%ids.length],bi=ids[k],ci=ids[(k+1)%ids.length],a=points[ai],b=points[bi],c=points[ci];if(orient(a,b,c)<=1e-9)continue;let inside=false;for(const j of ids){if(j===ai||j===bi||j===ci)continue;const p=points[j];if(orient(a,b,p)>=0&&orient(b,c,p)>=0&&orient(c,a,p)>=0){inside=true;break;}}if(!inside){triangles.push([ai,bi,ci]);ids.splice(k,1);found=true;break;}}if(!found)break;}
  const p=(i,z,s=1)=>[points[i][0]*s,points[i][1]*s,z];
  for(const [a,b,c]of triangles){this.tri(p(a,depth/2,.97),p(b,depth/2,.97),p(c,depth/2,.97),shade);this.tri(p(c,-depth/2,.97),p(b,-depth/2,.97),p(a,-depth/2,.97),shade);}
  for(let i=0;i<points.length;i++){const j=(i+1)%points.length;this.quad(p(i,-depth*.32),p(j,-depth*.32),p(j,depth*.32),p(i,depth*.32),shade*.94);this.quad(p(i,depth*.32),p(j,depth*.32),p(j,depth/2,.97),p(i,depth/2,.97),shade);this.quad(p(j,-depth*.32),p(i,-depth*.32),p(i,-depth/2,.97),p(j,-depth/2,.97),shade);}
 }
 finish(){return new Float32Array(this.data);}
}

const hexRadius=(r,t)=>r*Math.cos(Math.PI/6)/Math.cos(((t+Math.PI/6)%(Math.PI/3)+Math.PI/3)%(Math.PI/3)-Math.PI/6);
function bolt(m,socket=false){
 m.cylinder(.105,.82,-.08,14,.85);m.thread(.116,-.475,.18,7.5,.024);
 if(socket){m.lathe([[0,.27],[.19,.27],[.225,.31],[.225,.52],[.20,.55],[.10,.55],[.09,.48],[.09,.39],[0,.39]],24);m.lathe([[.088,.39],[.088,.485]],6,.23);for(let i=0;i<18;i++){const a=i/18*TAU;m.tube([[Math.cos(a)*.225,.33,Math.sin(a)*.225],[Math.cos(a)*.225,.50,Math.sin(a)*.225]],.005,3,.67);}}
 else {m.lathe([[0,.27],[.22,.27],[.25,.31],[.25,.48],[.217,.525],[0,.525]],6,1,[0,0,0],hexRadius);m.cylinder(.155,.008,.529,6,.91);}
}
export function createGeometry(id){const m=new MeshBuilder();
 switch(id){
 case 'bolt':bolt(m);break;
 case 'socketbolt':bolt(m,true);break;
 case 'screw':{
  m.lathe([[0,-.56],[.10,-.48],[.10,.24],[.235,.36],[.235,.43],[0,.43]],20,.98);m.thread(.104,-.49,.25,8,.019,.78);
  m.box(.27,.004,.048,[0,.433,0],.16);m.box(.047,.004,.27,[0,.435,0],.16);break;
 }
 case 'nut':{
  m.lathe([[.145,-.11],[.165,-.15],[.264,-.15],[.30,-.11],[.30,.11],[.264,.15],[.165,.15],[.145,.11],[.145,-.11]],24,1,[0,0,0],(r,t)=>r>.23?hexRadius(r,t):r);
  m.thread(.147,-.1,.1,3,.008,.53);break;
 }
 case 'washer':m.ring(.32,.17,.085,28,1,.016);break;
 case 'split':{
  const n=32;for(let i=0;i<n;i++){
   const p=(t,r,y)=>{const a=.20+t*(TAU-.40);return [Math.cos(a)*r,y+(t-.5)*.12,Math.sin(a)*r];};
   const a=i/n,b=(i+1)/n;for(const [r0,y0,r1,y1]of [[.16,-.035,.29,-.035],[.29,-.035,.29,.035],[.29,.035,.16,.035],[.16,.035,.16,-.035]])m.quad(p(a,r0,y0),p(a,r1,y1),p(b,r1,y1),p(b,r0,y0));
   if(i===0||i===n-1){const t=i===0?a:b;m.quad(p(t,.16,-.035),p(t,.29,-.035),p(t,.29,.035),p(t,.16,.035));}
  }break;
 }
 case 'gear':{
  const radial=(r,a)=>r>.3?r*([.91,1,1,.91][Math.floor((a/TAU*56+.0001)%4)]):r;
  m.lathe([[.12,-.075],[.37,-.075],[.43,-.045],[.43,.045],[.37,.075],[.12,.075],[.12,-.075]],56,.92,[0,0,0],radial);m.ring(.18,.115,.195,20,1,.016);break;
 }
 case 'bearing':{
  m.ring(.37,.28,.22,28,1,.025);m.ring(.19,.12,.22,24,1,.019);for(let i=0;i<9;i++){const a=i/9*TAU;m.sphere(.061,[Math.cos(a)*.235,0,Math.sin(a)*.235],1,8,6);}m.ring(.277,.195,.046,28,.46,.008);break;
 }
 case 'spring':m.thread(.21,-.51,.51,5.5,.04,.95);break;
 case 'wrench':{
  m.polygon([[-.10,-.80],[.10,-.80],[.105,.72],[-.105,.72]],.13);
  const pts=[[-.20,-.14],[.20,-.14],[.32,.07],[.28,.28],[.18,.43],[.135,.38],[.15,.16],[-.12,.10],[-.22,.31],[-.30,.24],[-.33,.04]];
  m.polygon(pts.map(([x,y])=>[x,y+.68]),.15);m.polygon(pts.map(([x,y])=>[-x*.88,-y*.88-.73]),.14);
  m.box(.041,.56,.002,[0,0,.067],.78);break;
 }
 case 'allen':{
  const p=[];p.push([0,-.76,0],[0,.40,0]);for(let i=0;i<=10;i++){const a=Math.PI-i/10*Math.PI/2;p.push([.14+Math.cos(a)*.14,.40+Math.sin(a)*.14,0]);}p.push([.49,.54,0]);m.tube(p,.076,6,.74);break;
 }
 case 'socket':{
  m.lathe([[.15,-.38],[.23,-.38],[.26,-.34],[.26,.29],[.235,.38],[.15,.38],[.14,.33],[.14,-.30],[.15,-.38]],24,1);
  m.lathe([[.151,.12],[.151,.34]],6,.6);for(let j=0;j<2;j++)m.lathe([[.261,-.21+j*.08],[.261,-.195+j*.08]],24,.51);break;
 }
 case 'driver':{
  m.cylinder(.056,1.12,-.36,12,1);m.lathe([[0,.1],[.12,.1],[.18,.18],[.18,.72],[.125,.82],[0,.82]],12,.85);
  for(let i=0;i<10;i++){const a=i/10*TAU;m.tube([[Math.cos(a)*.177,.22,Math.sin(a)*.177],[Math.cos(a)*.177,.67,Math.sin(a)*.177]],.009,3,.5);}m.box(.105,.16,.028,[0,-.89,0],.9);break;
 }
 case 'rivet':m.cylinder(.105,.55,-.075,14,.82);m.lathe([[0,.14],[.225,.14],[.24,.17],[.20,.25],[.12,.31],[0,.33]],24);break;
 }
 return m.finish();
}
export function createStage(){const m=new MeshBuilder();m.lathe([[0,-.24],[10.9,-.24],[11.02,-.16],[11.02,-.07],[10.96,-.025],[0,-.025]],160);return m.finish();}
export function createPlane(){const m=new MeshBuilder();m.quad([-120,-.25,-120],[-120,-.25,120],[120,-.25,120],[120,-.25,-120]);return m.finish();}
export function createTrim(){const m=new MeshBuilder();m.ring(10.98,10.95,.025,180,1,.001);for(let i=0;i<120;i++){const a=i/120*TAU,r=10.69,len=i%10===0?.20:.07;const p=(rr,t)=>[Math.cos(t)*rr,.008,Math.sin(t)*rr];m.quad(p(r-len,a-.0006),p(r-len,a+.0006),p(r,a+.0006),p(r,a-.0006),i%10===0?1:.4);}return m.finish();}
export function createHalo(){const m=new MeshBuilder();m.ring(1,.982,.008,80,1,.001);return m.finish();}
