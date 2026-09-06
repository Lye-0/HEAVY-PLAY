import {VERTEX,FRAGMENT,DEPTH_FRAGMENT} from './shaders.js';
import {createGeometry,createPlane,createStage,createTrim,createHalo} from './geometry.js';
import {CATALOG,METALS} from './catalog.js';
import {perspective,lookAt,multiply,ortho,normalize,cross,clamp} from './math.js';

export class Renderer {
 constructor(canvas,preset){
  const gl=canvas.getContext('webgl2',{alpha:false,antialias:true,powerPreference:'high-performance'});if(!gl)throw new Error('WEBGL2_UNAVAILABLE');
  this.gl=gl;this.canvas=canvas;this.dpr=preset.dpr;this.width=1;this.height=1;this.lost=false;this.halos=[];this.yaw=.20;this.pitch=.56;this.distance=23.5;this.target=[-1.25,.95,0];this.eye=[0,0,0];this.autoRotate=true;this.shadowSize=preset.shadow;this.shadowDirty=true;this.shadowFrame=0;
  this.program=this.link(VERTEX,FRAGMENT);this.depthProgram=this.link(VERTEX,DEPTH_FRAGMENT);
  this.uniforms=this.locations(this.program,['uVP','uEye','uLightVP','uShadow','uShadowTexel','uKind','uOpacity']);this.depthVP=gl.getUniformLocation(this.depthProgram,'uVP');
  this.lightVP=multiply(ortho(-13,13,-13,13,.1,55),lookAt([-10,20,12],[0,0,0]));
  this.groups=CATALOG.map(c=>this.makeMesh(createGeometry(c.id),2800));
  this.floor=this.staticMesh(createPlane(),[.033,.041,.035],.78,1);
  this.stage=this.staticMesh(createStage(),[.043,.052,.044],.59,2);
  this.trim=this.staticMesh(createTrim(),[.34,.37,.19],.42,3);
  this.halo=this.makeMesh(createHalo(),1);this.halo.kind=4;
  this.createShadow(preset.shadow);
  gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.clearColor(.070,.081,.075,1);
  this.resize();
 }
 link(vs,fs){const g=this.gl,compile=(type,source)=>{const s=g.createShader(type);g.shaderSource(s,source);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS)){const log=g.getShaderInfoLog(s);g.deleteShader(s);throw new Error(log);}return s;};const v=compile(g.VERTEX_SHADER,vs),f=compile(g.FRAGMENT_SHADER,fs),p=g.createProgram();g.attachShader(p,v);g.attachShader(p,f);g.linkProgram(p);g.deleteShader(v);g.deleteShader(f);if(!g.getProgramParameter(p,g.LINK_STATUS))throw new Error(g.getProgramInfoLog(p));return p;}
 locations(p,names){return Object.fromEntries(names.map(n=>[n,this.gl.getUniformLocation(p,n)]));}
 makeMesh(vertices,capacity){
  const g=this.gl,vao=g.createVertexArray();g.bindVertexArray(vao);const vb=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,vb);g.bufferData(g.ARRAY_BUFFER,vertices,g.STATIC_DRAW);
  for(const [loc,n,off]of [[0,3,0],[1,3,12],[2,1,24]]){g.enableVertexAttribArray(loc);g.vertexAttribPointer(loc,n,g.FLOAT,false,28,off);}
  const ib=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,ib);g.bufferData(g.ARRAY_BUFFER,capacity*56,g.DYNAMIC_DRAW);
  for(const [loc,n,off]of [[3,3,0],[4,4,12],[5,1,28],[6,3,32],[7,1,44],[8,2,48]]){g.enableVertexAttribArray(loc);g.vertexAttribPointer(loc,n,g.FLOAT,false,56,off);g.vertexAttribDivisor(loc,1);}
  g.bindVertexArray(null);return {vao,vb,ib,cpu:vertices,vertices:vertices.length/7,data:new Float32Array(capacity*14),count:0,kind:0};
 }
 put(mesh,p,q,scale,color,roughness,effect=0,ao=1){const i=mesh.count++*14;mesh.data.set([...p,...q,scale,...color,roughness,effect,ao],i);}
 upload(mesh){const g=this.gl;g.bindBuffer(g.ARRAY_BUFFER,mesh.ib);g.bufferSubData(g.ARRAY_BUFFER,0,mesh.data.subarray(0,mesh.count*14));}
 staticMesh(vertices,color,roughness,kind){const m=this.makeMesh(vertices,1);m.kind=kind;this.put(m,[0,0,0],[0,0,0,1],1,color,roughness);this.upload(m);return m;}
 createShadow(size){const g=this.gl;if(this.shadowTexture)g.deleteTexture(this.shadowTexture);if(this.shadowBuffer)g.deleteFramebuffer(this.shadowBuffer);this.shadowSize=size;
  const t=g.createTexture();g.bindTexture(g.TEXTURE_2D,t);g.texImage2D(g.TEXTURE_2D,0,g.DEPTH_COMPONENT24,size,size,0,g.DEPTH_COMPONENT,g.UNSIGNED_INT,null);
  g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_COMPARE_MODE,g.COMPARE_REF_TO_TEXTURE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_COMPARE_FUNC,g.LEQUAL);
  const f=g.createFramebuffer();g.bindFramebuffer(g.FRAMEBUFFER,f);g.framebufferTexture2D(g.FRAMEBUFFER,g.DEPTH_ATTACHMENT,g.TEXTURE_2D,t,0);g.drawBuffers([g.NONE]);g.readBuffer(g.NONE);if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw new Error('SHADOW_BUFFER_UNAVAILABLE');g.bindFramebuffer(g.FRAMEBUFFER,null);this.shadowTexture=t;this.shadowBuffer=f;this.shadowDirty=true;
 }
 setQuality(p){this.dpr=p.dpr;if(p.shadow!==this.shadowSize)this.createShadow(p.shadow);this.resize();}
 resize(){this.width=this.canvas.clientWidth||innerWidth;this.height=this.canvas.clientHeight||innerHeight;const d=Math.min(devicePixelRatio||1,this.dpr);this.canvas.width=Math.round(this.width*d);this.canvas.height=Math.round(this.height*d);this.updateCamera();}
 updateCamera(){const aspect=this.width/this.height;const portrait=aspect<.8;this.fov=(portrait?51:43)*Math.PI/180;const focus=portrait?[0,.95,0]:this.target;const dist=this.distance*(portrait?1.42:1);const cp=Math.cos(this.pitch);this.eye=[Math.sin(this.yaw)*cp*dist,Math.sin(this.pitch)*dist,Math.cos(this.yaw)*cp*dist];this.eye=this.eye.map((x,i)=>x+focus[i]);this.view=lookAt(this.eye,focus);this.vp=multiply(perspective(this.fov,aspect,.1,180),this.view);this.forward=normalize(focus.map((x,i)=>x-this.eye[i]));this.right=normalize(cross(this.forward,[0,1,0]));this.up=cross(this.right,this.forward);}
 orbit(dx,dy){this.yaw-=dx*.006;this.pitch=clamp(this.pitch+dy*.005,.19,1.35);this.updateCamera();}
 zoom(amount){this.distance=clamp(this.distance*Math.exp(amount*.001),9,43);this.updateCamera();}
 resetCamera(){this.yaw=.20;this.pitch=.56;this.distance=23.5;this.updateCamera();}
 ray(x,y){const rect=this.canvas.getBoundingClientRect(),nx=((x-rect.left)/rect.width)*2-1,ny=1-((y-rect.top)/rect.height)*2,h=Math.tan(this.fov/2),aspect=this.width/this.height;return {origin:this.eye.slice(),direction:normalize(this.forward.map((f,i)=>f+nx*h*aspect*this.right[i]+ny*h*this.up[i]))};}
 project(p){const m=this.vp,x=p[0],y=p[1],z=p[2],w=m[3]*x+m[7]*y+m[11]*z+m[15];return [(m[0]*x+m[4]*y+m[8]*z+m[12])/w*.5*this.width+.5*this.width,-(m[1]*x+m[5]*y+m[9]*z+m[13])/w*.5*this.height+.5*this.height];}
 updateInstances(bodies){for(const m of this.groups)m.count=0;for(const b of bodies){const metal=METALS[b.metal];this.put(this.groups[b.type],b.p,b.q,b.scale,metal.color.map(x=>x*b.shade),metal.roughness,b.highlight,.90);}for(const m of this.groups)this.upload(m);}
 drawMesh(m,depth=false){if(!m.count)return;const g=this.gl;if(!depth)g.uniform1i(this.uniforms.uKind,m.kind);g.bindVertexArray(m.vao);g.drawArraysInstanced(g.TRIANGLES,0,m.vertices,m.count);}
 render(bodies,time,moving=true){
  if(this.lost)return;const g=this.gl;this.updateInstances(bodies);
  if(this.shadowDirty||moving||this.shadowFrame++%90===0){g.bindFramebuffer(g.FRAMEBUFFER,this.shadowBuffer);g.viewport(0,0,this.shadowSize,this.shadowSize);g.clear(g.DEPTH_BUFFER_BIT);g.useProgram(this.depthProgram);g.uniformMatrix4fv(this.depthVP,false,this.lightVP);g.enable(g.POLYGON_OFFSET_FILL);g.polygonOffset(1.2,2.0);this.drawMesh(this.stage,true);for(const m of this.groups)this.drawMesh(m,true);g.disable(g.POLYGON_OFFSET_FILL);this.shadowDirty=false;}
  g.bindFramebuffer(g.FRAMEBUFFER,null);g.viewport(0,0,this.canvas.width,this.canvas.height);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);g.useProgram(this.program);
  const u=this.uniforms;g.uniformMatrix4fv(u.uVP,false,this.vp);g.uniformMatrix4fv(u.uLightVP,false,this.lightVP);g.uniform3fv(u.uEye,this.eye);g.uniform1f(u.uShadowTexel,1/this.shadowSize);g.uniform1f(u.uOpacity,1);g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,this.shadowTexture);g.uniform1i(u.uShadow,0);
  this.drawMesh(this.floor);this.drawMesh(this.stage);this.drawMesh(this.trim);for(const m of this.groups)this.drawMesh(m);
  if(this.halos.length){g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA);g.depthMask(false);for(const h of this.halos){this.halo.count=0;this.put(this.halo,h.p,h.q||[0,0,0,1],h.r,[1,1,.5],.5);this.upload(this.halo);g.uniform1f(u.uOpacity,h.alpha);this.drawMesh(this.halo);}g.depthMask(true);g.disable(g.BLEND);}
  g.bindVertexArray(null);
 }
 dispose(){const g=this.gl;for(const m of [...this.groups,this.floor,this.stage,this.trim,this.halo]){g.deleteBuffer(m.vb);g.deleteBuffer(m.ib);g.deleteVertexArray(m.vao);}g.deleteProgram(this.program);g.deleteProgram(this.depthProgram);g.deleteTexture(this.shadowTexture);g.deleteFramebuffer(this.shadowBuffer);}
}
