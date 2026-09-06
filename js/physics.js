import {clamp,rng,randomQuat,rotate,integrateQuat} from './math.js';
import {CATALOG,chooseType} from './catalog.js';

/**
 * Purpose-built, approximate rigid-body solver. Rounded capsule contacts,
 * rotational impulses, Coulomb friction, an indexed broadphase, and sleeping.
 * Thread grooves / holes are visual geometry, not precision collision meshes.
 */
export class World {
 constructor(count=1200,seed=417){this.seed=seed;this.bodies=[];this.time=0;this.onImpact=null;this.impactBudget=0;this.active=0;this.random=rng(seed);this.create(count);}
 create(count){
  const r=this.random,R=4.65*Math.cbrt(count/1200),H=9.0*Math.cbrt(count/1200);
  for(let i=0;i<count;i++){
   const type=chooseType(r),scale=.76+r()*.47,metalRoll=r(),metal=metalRoll<.57?0:metalRoll<.69?1:metalRoll<.86?2:metalRoll<.93?3:metalRoll<.985?4:5;
   const y=H*(1-Math.cbrt(r())),rr=R*(1-y/H)*Math.sqrt(r()),a=r()*Math.PI*2;
   this.add(type,[Math.cos(a)*rr,y+.68,Math.sin(a)*rr],randomQuat(r),scale,metal);
  }
 }
 add(type,p,q,scale=1,metal=0){const c=CATALOG[type],mass=c.mass*scale**3;
  const b={id:this.bodies.length,type,p:p.slice(),q:q.slice(),v:[0,0,0],w:[0,0,0],scale,metal,r:c.radius*scale,h:c.half*scale,mass,im:1/mass,ii:.24/(mass*(.4*(c.radius*scale)**2+(c.half*scale)**2/3+.01)),axis:[0,1,0],sleep:false,sleepTime:0,contact:false,highlight:0,shade:.90+this.random()*.12};
  b.axis=rotate(b.q,[0,1,0]);this.bodies.push(b);return b;
 }
 applySnapshot(snapshot){for(let i=0;i<this.bodies.length;i++){const b=this.bodies[i],j=i*7;if(j+6>=snapshot.length)break;b.p=[snapshot[j],snapshot[j+1],snapshot[j+2]];b.q=snapshot.slice(j+3,j+7);b.axis=rotate(b.q,[0,1,0]);b.v.fill(0);b.w.fill(0);b.sleep=true;}this.active=0;}
 snapshot(){return this.bodies.flatMap(b=>[...b.p,...b.q].map(v=>+v.toFixed(5)));}
 wakeAll(){for(const b of this.bodies){b.sleep=false;b.sleepTime=0;}}
 wake(b){b.sleep=false;b.sleepTime=0;}
 impulse(b,imp,offset=[0,0,0]){this.wake(b);for(let k=0;k<3;k++)b.v[k]+=imp[k]*b.im;b.w[0]+=(offset[1]*imp[2]-offset[2]*imp[1])*b.ii;b.w[1]+=(offset[2]*imp[0]-offset[0]*imp[2])*b.ii;b.w[2]+=(offset[0]*imp[1]-offset[1]*imp[0])*b.ii;}
 blast(p,power=1,radius=6.2){this.wakeAll();let count=0;for(const b of this.bodies){let x=b.p[0]-p[0],y=b.p[1]-p[1],z=b.p[2]-p[2],d=Math.hypot(x,y,z);if(d>radius)continue;const f=(1-d/radius)**1.2*power;d=Math.max(.4,d);b.v[0]+=x/d*f*12;b.v[1]+=(Math.max(.15,y/d)*8+6)*f;b.v[2]+=z/d*f*12;b.w[0]+=(this.random()-.5)*f*16;b.w[1]+=(this.random()-.5)*f*16;b.w[2]+=(this.random()-.5)*f*16;count++;}return count;}
 magnet(p,dt){let n=0;for(const b of this.bodies){const dx=p[0]-b.p[0],dy=p[1]-b.p[1],dz=p[2]-b.p[2],d=Math.hypot(dx,dy,dz);if(d>7.5)continue;this.wake(b);const k=24*(1-d/9),drag=Math.exp(-3*dt);for(let j=0;j<3;j++)b.v[j]=(b.v[j]+clamp((p[j]-b.p[j])*k,-65,65)*dt)*drag;b.v[1]+=19*dt;n++;}return n;}
 pull(b,p,dt){this.wake(b);for(let k=0;k<3;k++){const a=clamp((p[k]-b.p[k])*105-b.v[k]*16,-160,160);b.v[k]+=a*dt;}b.v[1]+=19*dt;}
 step(dt=1/60,iterations=4){
  this.time+=dt;this.impactBudget=3;let active=0;
  for(const b of this.bodies){if(b.sleep)continue;active++;b.contact=false;b.v[1]-=19*dt;
   for(let k=0;k<3;k++){b.v[k]=clamp(b.v[k]*.999,-32,32);b.w[k]=clamp(b.w[k]*.995,-30,30);b.p[k]+=b.v[k]*dt;}
   integrateQuat(b.q,b.w,dt);b.axis=rotate(b.q,[0,1,0]);
   const rad=Math.hypot(b.p[0],b.p[2]);if(rad>23){b.v[0]-=b.p[0]/rad*(rad-23)*dt*14;b.v[2]-=b.p[2]/rad*(rad-23)*dt*14;}
   if(b.p[1]<-8){b.p[1]=9;b.p[0]*=.3;b.p[2]*=.3;b.v.fill(0);}
  }
  this.active=active;if(!active)return;
  const cell=1.0,grid=new Map(),bounds=new Array(this.bodies.length);
  const key=(x,y,z)=>((x+128)&511)|(((y+128)&511)<<9)|(((z+128)&511)<<18);
  for(const b of this.bodies){const bb=[];for(let k=0;k<3;k++){const e=Math.abs(b.axis[k])*b.h+b.r+.018;bb.push(Math.floor((b.p[k]-e)/cell),Math.floor((b.p[k]+e)/cell));}bounds[b.id]=bb;
   for(let x=bb[0];x<=bb[1];x++)for(let y=bb[2];y<=bb[3];y++)for(let z=bb[4];z<=bb[5];z++){const k=key(x,y,z);let bucket=grid.get(k);if(!bucket)grid.set(k,bucket=[]);bucket.push(b.id);}
  }
  const pairs=[],seen=new Int32Array(this.bodies.length);seen.fill(-1);
  for(const b of this.bodies){const bb=bounds[b.id];for(let x=bb[0];x<=bb[1];x++)for(let y=bb[2];y<=bb[3];y++)for(let z=bb[4];z<=bb[5];z++){
   const bucket=grid.get(key(x,y,z));if(!bucket)continue;for(const j of bucket){if(j<=b.id||seen[j]===b.id)continue;seen[j]=b.id;const c=this.bodies[j];if(b.sleep&&c.sleep)continue;const dx=b.p[0]-c.p[0],dy=b.p[1]-c.p[1],dz=b.p[2]-c.p[2],rr=b.r+b.h+c.r+c.h;if(dx*dx+dy*dy+dz*dz<rr*rr)pairs.push(b,c);}
  }}
  for(let it=0;it<iterations;it++){
   for(let i=0;i<pairs.length;i+=2)this.collide(pairs[i],pairs[i+1],it===0);
   for(const b of this.bodies)if(!b.sleep)this.floor(b,it===0);
  }
  for(const b of this.bodies){if(b.sleep)continue;const speed=b.v[0]**2+b.v[1]**2+b.v[2]**2+(b.w[0]**2+b.w[1]**2+b.w[2]**2)*.06;
   if(b.contact&&speed<.10)b.sleepTime+=dt;else b.sleepTime=0;
   if(b.sleepTime>.55){b.sleep=true;b.v.fill(0);b.w.fill(0);}
  }
 }
 collide(a,b,sound){
  const u=a.axis,v=b.axis,wx=a.p[0]-b.p[0],wy=a.p[1]-b.p[1],wz=a.p[2]-b.p[2],uv=u[0]*v[0]+u[1]*v[1]+u[2]*v[2],d=u[0]*wx+u[1]*wy+u[2]*wz,e=v[0]*wx+v[1]*wy+v[2]*wz,den=1-uv*uv;
  let s=den>1e-5?clamp((uv*e-d)/den,-a.h,a.h):0,t=clamp(uv*s+e,-b.h,b.h);s=clamp(uv*t-d,-a.h,a.h);t=clamp(uv*s+e,-b.h,b.h);
  let nx=wx+u[0]*s-v[0]*t,ny=wy+u[1]*s-v[1]*t,nz=wz+u[2]*s-v[2]*t,dd=nx*nx+ny*ny+nz*nz,rs=a.r+b.r;
  if(dd>=rs*rs)return;let dist=Math.sqrt(dd);if(dist<1e-6){nx=.01;ny=1;nz=0;dist=1;}nx/=dist;ny/=dist;nz/=dist;
  a.contact=b.contact=true;
  // Supported sleeping contacts remain immovable until a meaningful impact.
  const rel=(a.v[0]-b.v[0])*nx+(a.v[1]-b.v[1])*ny+(a.v[2]-b.v[2])*nz;
  if(rel<-.75){if(a.sleep)this.wake(a);if(b.sleep)this.wake(b);}
  const ia=a.sleep?0:a.im,ib=b.sleep?0:b.im,sum=ia+ib;if(!sum)return;
  const depth=Math.max(0,rs-Math.sqrt(dd)-.004),corr=Math.min(.10,depth*.60)/sum;
  a.p[0]+=nx*corr*ia;a.p[1]+=ny*corr*ia;a.p[2]+=nz*corr*ia;b.p[0]-=nx*corr*ib;b.p[1]-=ny*corr*ib;b.p[2]-=nz*corr*ib;
  const ax=u[0]*s-nx*a.r,ay=u[1]*s-ny*a.r,az=u[2]*s-nz*a.r,bx=v[0]*t+nx*b.r,by=v[1]*t+ny*b.r,bz=v[2]*t+nz*b.r;
  const rvx=a.v[0]+a.w[1]*az-a.w[2]*ay-b.v[0]-b.w[1]*bz+b.w[2]*by;
  const rvy=a.v[1]+a.w[2]*ax-a.w[0]*az-b.v[1]-b.w[2]*bx+b.w[0]*bz;
  const rvz=a.v[2]+a.w[0]*ay-a.w[1]*ax-b.v[2]-b.w[0]*by+b.w[1]*bx;
  const vn=rvx*nx+rvy*ny+rvz*nz;if(vn>=0)return;
  const acx=ay*nz-az*ny,acy=az*nx-ax*nz,acz=ax*ny-ay*nx,bcx=by*nz-bz*ny,bcy=bz*nx-bx*nz,bcz=bx*ny-by*nx;
  const ai=a.sleep?0:a.ii,bi=b.sleep?0:b.ii,j=-(1+(vn<-1.5?.20:0))*vn/(sum+ai*(acx*acx+acy*acy+acz*acz)+bi*(bcx*bcx+bcy*bcy+bcz*bcz));
  let tx=rvx-vn*nx,ty=rvy-vn*ny,tz=rvz-vn*nz,tl=Math.hypot(tx,ty,tz);if(tl>1e-5){tx/=tl;ty/=tl;tz/=tl;}else tx=ty=tz=0;
  const fj=Math.min(j*.76,tl/(sum+ai*(ax*ax+ay*ay+az*az)+bi*(bx*bx+by*by+bz*bz)));
  const jx=nx*j-tx*fj,jy=ny*j-ty*fj,jz=nz*j-tz*fj;
  a.v[0]+=jx*ia;a.v[1]+=jy*ia;a.v[2]+=jz*ia;b.v[0]-=jx*ib;b.v[1]-=jy*ib;b.v[2]-=jz*ib;
  a.w[0]+=(ay*jz-az*jy)*ai;a.w[1]+=(az*jx-ax*jz)*ai;a.w[2]+=(ax*jy-ay*jx)*ai;b.w[0]-=(by*jz-bz*jy)*bi;b.w[1]-=(bz*jx-bx*jz)*bi;b.w[2]-=(bx*jy-by*jx)*bi;
  if(Math.abs(vn)<1.2){for(let k=0;k<3;k++){a.w[k]*=.95;b.w[k]*=.95;}a.v[0]*=.992;a.v[2]*=.992;b.v[0]*=.992;b.v[2]*=.992;}
  if(sound&&vn<-2.4&&this.onImpact&&this.impactBudget-->0)this.onImpact(-vn,a);
 }
 floor(b,sound){
  const c=CATALOG[b.type],u=b.axis,ry=c.ext[1]*b.scale,rr=c.ext[0]*b.scale;
  let rx,hy,rz;
  if(c.id==='wrench'||c.id==='allen'){
   const xx=rotate(b.q,[1,0,0]),zz=rotate(b.q,[0,0,1]),ex=c.ext[0]*b.scale,ez=c.ext[2]*b.scale;
   const sx=xx[1]>0?-ex:ex,sy=u[1]>0?-ry:ry,sz=zz[1]>0?-ez:ez;
   rx=xx[0]*sx+u[0]*sy+zz[0]*sz;hy=xx[1]*sx+u[1]*sy+zz[1]*sz;rz=xx[2]*sx+u[2]*sy+zz[2]*sz;
  }else{
   const sign=u[1]>0?-1:1,len=Math.sqrt(Math.max(0,1-u[1]*u[1])),f=len>1e-5?rr/len:0;
   rx=u[0]*sign*ry+u[0]*u[1]*f;hy=u[1]*sign*ry+(-1+u[1]*u[1])*f;rz=u[2]*sign*ry+u[2]*u[1]*f;
  }
  const ground=Math.hypot(b.p[0],b.p[2])>11.03?-.24:0,depth=ground-(b.p[1]+hy);if(depth<=0)return;
  b.contact=true;b.p[1]+=depth*.88;
  const vy=b.v[1]+b.w[2]*rx-b.w[0]*rz;
  if(vy<0){const j=-(1+(vy<-1.8?.22:0))*vy/(b.im+(rx*rx+rz*rz)*b.ii);b.v[1]+=j*b.im;b.w[0]-=rz*j*b.ii;b.w[2]+=rx*j*b.ii;
   const vx=b.v[0]+b.w[1]*rz-b.w[2]*hy,vz=b.v[2]+b.w[0]*hy-b.w[1]*rx,vl=Math.hypot(vx,vz);
   if(vl>.0001){const f=Math.min(j*.68,vl/(b.im+(rx*rx+hy*hy+rz*rz)*b.ii)),fx=-vx/vl*f,fz=-vz/vl*f;b.v[0]+=fx*b.im;b.v[2]+=fz*b.im;b.w[0]+=hy*fz*b.ii;b.w[1]+=(rz*fx-rx*fz)*b.ii;b.w[2]-=hy*fx*b.ii;}
   if(sound&&vy<-2&&this.onImpact&&this.impactBudget-->0)this.onImpact(-vy,b);
  }
  b.w[0]*=.965;b.w[1]*=.965;b.w[2]*=.965;
 }
}
