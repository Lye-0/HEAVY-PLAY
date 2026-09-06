/** Small allocation-conscious 3D math helpers. Matrices are column-major. */
export const TAU = Math.PI * 2;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b-a)*t;
export function rng(seed=1) {return () => {seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
export function normalize(v) {const d=Math.hypot(...v)||1;return v.map(x=>x/d);}
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export function perspective(fov, aspect, near, far) {const f=1/Math.tan(fov/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);}
export function ortho(l,r,b,t,n,f) {return new Float32Array([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1]);}
export function lookAt(eye, target, up=[0,1,0]) {const z=normalize(eye.map((x,i)=>x-target[i])),x=normalize(cross(up,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
export function multiply(a,b) {const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;}
export function rotate(q,v) {const [x,y,z,w]=q,[a,b,c]=v;const tx=2*(y*c-z*b),ty=2*(z*a-x*c),tz=2*(x*b-y*a);return [a+w*tx+y*tz-z*ty,b+w*ty+z*tx-x*tz,c+w*tz+x*ty-y*tx];}
export function randomQuat(r) {const u=r(),a=TAU*r(),b=TAU*r(),s=Math.sqrt(1-u),t=Math.sqrt(u);return [s*Math.sin(a),s*Math.cos(a),t*Math.sin(b),t*Math.cos(b)];}
export function integrateQuat(q,w,dt) {const [x,y,z,s]=q,[a,b,c]=w,h=dt*.5; q[0]+=h*(a*s+b*z-c*y);q[1]+=h*(b*s+c*x-a*z);q[2]+=h*(c*s+a*y-b*x);q[3]+=h*(-a*x-b*y-c*z);const m=1/(Math.hypot(...q)||1);for(let i=0;i<4;i++)q[i]*=m;return q;}
export function raySphere(o,d,c,r) {const v=o.map((x,i)=>x-c[i]),b=dot(v,d),det=b*b-dot(v,v)+r*r;if(det<0)return null;const t=-b-Math.sqrt(det);return t>0?t:null;}
