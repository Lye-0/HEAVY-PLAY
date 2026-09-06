export const VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in float aShade;
layout(location=3) in vec3 iPosition;
layout(location=4) in vec4 iQuaternion;
layout(location=5) in float iScale;
layout(location=6) in vec3 iColor;
layout(location=7) in float iRoughness;
layout(location=8) in vec2 iEffects;
uniform mat4 uVP;
out vec3 vPosition;
out vec3 vNormal;
out vec3 vColor;
out float vRoughness;
out vec2 vEffects;
vec3 rotateQ(vec3 p,vec4 q){return p+2.0*cross(q.xyz,cross(q.xyz,p)+q.w*p);}
void main(){vPosition=rotateQ(aPosition*iScale,iQuaternion)+iPosition;vNormal=rotateQ(aNormal,iQuaternion);vColor=iColor*aShade;vRoughness=iRoughness;vEffects=iEffects;gl_Position=uVP*vec4(vPosition,1.0);}
`;
export const DEPTH_FRAGMENT = `#version 300 es
precision highp float;
void main(){}
`;
export const FRAGMENT = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 vPosition;
in vec3 vNormal;
in vec3 vColor;
in float vRoughness;
in vec2 vEffects;
uniform vec3 uEye;
uniform mat4 uLightVP;
uniform sampler2DShadow uShadow;
uniform float uShadowTexel;
uniform int uKind;
uniform float uOpacity;
out vec4 fragColor;
const float PI=3.14159265359;
float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float panel(vec3 r,vec3 dir,vec3 up,vec2 size,float blur){
 vec3 side=normalize(cross(up,dir));vec3 vertical=cross(dir,side);float d=dot(r,dir);
 vec2 uv=vec2(dot(r,side),dot(r,vertical))/max(.02,d);
 vec2 f=vec2(1.0)-smoothstep(size-vec2(blur),size+vec2(blur),abs(uv));return f.x*f.y*smoothstep(.0,.2,d);
}
vec3 environment(vec3 r,float rough){
 float b=.035+rough*.58;
 vec3 c=mix(vec3(.052,.047,.035),vec3(.17,.20,.20),smoothstep(-.3,.8,r.y));
 c+=vec3(4.7,4.5,3.9)*panel(r,normalize(vec3(-.75,.65,.45)),vec3(0,1,0),vec2(.20,1.20),b)/(1.+rough*2.0);
 c+=vec3(3.9,4.5,5.0)*panel(r,normalize(vec3(.8,.5,-.35)),vec3(0,1,0),vec2(.20,1.7),b)/(1.+rough*2.);
 c+=vec3(4.1,4.2,3.8)*panel(r,normalize(vec3(.15,1.,.15)),vec3(0,0,1),vec2(.65,.28),b)/(1.+rough*1.5);
 c+=vec3(2.6,1.7,.75)*panel(r,normalize(vec3(-.7,.2,-.7)),vec3(0,1,0),vec2(.17,.80),b)/(1.+rough*2.);
 c+=vec3(.55,.62,.63)*pow(max(r.z,0.),4.);
 return c;
}
float shadow(vec3 p,vec3 n){
 vec4 sc=uLightVP*vec4(p,1.);vec3 uv=sc.xyz/sc.w*.5+.5;
 if(uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.||uv.z>1.)return 1.;
 float bias=max(.00035,.0010*(1.-dot(n,normalize(vec3(-8,17,9)))));float s=0.;
 for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)s+=texture(uShadow,vec3(uv.xy+vec2(float(x),float(y))*uShadowTexel,uv.z-bias));return s/9.;
}
vec3 lightBRDF(vec3 n,vec3 v,vec3 l,vec3 c,float rough,vec3 f0,float metal){
 vec3 h=normalize(v+l);float nl=max(dot(n,l),0.),nv=max(dot(n,v),.001),nh=max(dot(n,h),0.),vh=max(dot(v,h),0.);
 float a=rough*rough,a2=a*a,d=nh*nh*(a2-1.)+1.;float D=a2/(PI*d*d+.00001);
 float k=(rough+1.)*(rough+1.)/8.,G=(nv/(nv*(1.-k)+k))*(nl/(nl*(1.-k)+k));
 vec3 F=f0+(1.-f0)*pow(1.-vh,5.);vec3 spec=D*G*F/max(.003,4.*nv*nl);
 return ((1.-metal)*c/PI*(1.-F)+spec)*nl;
}
vec3 aces(vec3 c){return clamp((c*(2.51*c+.03))/(c*(2.43*c+.59)+.14),0.,1.);}
void main(){
 vec3 n=normalize(vNormal);if(!gl_FrontFacing)n=-n;
 vec3 v=normalize(uEye-vPosition),c=vColor;float rough=vRoughness,metal=.97;
 if(uKind==4){fragColor=vec4(vec3(.89,.98,.46),uOpacity);return;}
 float grain=hash(floor(vPosition*380.));
 if(uKind==1||uKind==2){metal=.22;rough=.78;c*=.93+grain*.08;float r=length(vPosition.xz);
  float groove=1.-smoothstep(.0,.012,abs(fract(r*.8)-.5));c*=1.-groove*.075;
  if(uKind==2){c*=1.-.10*smoothstep(2.,10.,r);}
 }else{
  rough=clamp(rough+(grain-.5)*.035,.12,.7);
  n=normalize(n+vec3(sin(vPosition.y*490.)*.009,0.,sin(vPosition.x*340.)*.008));
 }
 vec3 f0=mix(vec3(.045),c,metal);float nv=max(dot(n,v),0.);
 vec3 fresnel=f0+(max(vec3(1.-rough),f0)-f0)*pow(1.-nv,5.);
 float sh=shadow(vPosition,n),ao=vEffects.y*mix(.72,1.,smoothstep(.02,.6,vPosition.y));
 vec3 reflected=reflect(-v,n);vec3 env=environment(reflected,rough);
 vec3 color=env*fresnel*(.74+rough*.1)*ao*mix(.50,1.,sh);
 if(uKind==1||uKind==2)color*=.42;
 color+=(1.-metal)*c*(.26+max(n.y,0.)*.26)*ao*mix(.23,1.,sh);
 color+=lightBRDF(n,v,normalize(vec3(-8,17,9)),c,rough,f0,metal)*vec3(4.,3.9,3.5)*sh;
 color+=lightBRDF(n,v,normalize(vec3(8,6,-8)),c,rough,f0,metal)*vec3(1.0,1.2,1.35);
 color+=lightBRDF(n,v,normalize(vec3(-8,3,-9)),c,rough,f0,metal)*vec3(.72,.46,.18);
 if(uKind==3)color+=c*.18;
 color+=vEffects.x*vec3(.26,.33,.045)*(pow(1.-nv,2.)+.12);
 color=pow(aces(color*.90),vec3(1./2.2));
 float distanceToEye=length(uEye-vPosition);float fog=smoothstep(27.,100.,distanceToEye)*.75;
 color=mix(color,vec3(.070,.081,.075),fog);
 color+=(hash(vec3(gl_FragCoord.xy,1.))-.5)/255.;
 fragColor=vec4(color,uOpacity);
}
`;
