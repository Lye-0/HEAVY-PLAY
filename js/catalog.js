/** Geometry dimensions are arbitrary scene units, not engineering specifications. */
export const CATALOG = [
 {id:'bolt',name:'六角ボルト',en:'HEX BOLT',weight:20,radius:.19,half:.37,ext:[.25,.58,.25],mass:1.3},
 {id:'screw',name:'皿ネジ',en:'MACHINE SCREW',weight:15,radius:.14,half:.36,ext:[.23,.57,.23],mass:.7},
 {id:'nut',name:'六角ナット',en:'HEX NUT',weight:15,radius:.265,half:0,ext:[.3,.15,.3],mass:1},
 {id:'washer',name:'平ワッシャー',en:'FLAT WASHER',weight:15,radius:.27,half:0,ext:[.32,.055,.32],mass:.45},
 {id:'split',name:'スプリングワッシャー',en:'LOCK WASHER',weight:7,radius:.25,half:0,ext:[.29,.09,.29],mass:.48},
 {id:'socketbolt',name:'六角穴付きボルト',en:'SOCKET CAP BOLT',weight:10,radius:.17,half:.32,ext:[.23,.55,.23],mass:1.1},
 {id:'gear',name:'歯車',en:'SPUR GEAR',weight:4,radius:.37,half:0,ext:[.43,.10,.43],mass:1.7},
 {id:'bearing',name:'ベアリング',en:'BALL BEARING',weight:3,radius:.34,half:0,ext:[.37,.12,.37],mass:1.5},
 {id:'spring',name:'圧縮ばね',en:'COIL SPRING',weight:3,radius:.22,half:.3,ext:[.255,.58,.255],mass:.6},
 {id:'wrench',name:'スパナ',en:'OPEN-END WRENCH',weight:2,radius:.16,half:.7,ext:[.33,1.12,.075],mass:2.4},
 {id:'allen',name:'六角レンチ',en:'HEX KEY',weight:2,radius:.115,half:.58,ext:[.32,.8,.08],mass:1.1},
 {id:'socket',name:'ソケット',en:'DRIVE SOCKET',weight:2,radius:.245,half:.18,ext:[.26,.4,.26],mass:1.8},
 {id:'driver',name:'金属ドライバー',en:'STEEL SCREWDRIVER',weight:1.2,radius:.15,half:.65,ext:[.185,.94,.185],mass:1.5},
 {id:'rivet',name:'丸頭リベット',en:'ROUND RIVET',weight:3,radius:.15,half:.2,ext:[.24,.37,.24],mass:.65}
];
export const PRESETS = {light:{count:650,dpr:1,shadow:1024},standard:{count:1200,dpr:1.5,shadow:2048},high:{count:2000,dpr:2,shadow:2048}};
export function chooseType(r) {let n=r()*CATALOG.reduce((a,b)=>a+b.weight,0);for(let i=0;i<CATALOG.length;i++){n-=CATALOG[i].weight;if(n<=0)return i;}return 0;}
export const METALS = [
 {name:'STEEL',color:[.64,.69,.71],roughness:.24},
 {name:'ZINC',color:[.78,.8,.77],roughness:.30},
 {name:'BRASS',color:[.69,.45,.16],roughness:.25},
 {name:'BLACK OXIDE',color:[.18,.205,.205],roughness:.31},
 {name:'TITANIUM',color:[.43,.51,.56],roughness:.22},
 {name:'COPPER',color:[.66,.31,.17],roughness:.32}
];
