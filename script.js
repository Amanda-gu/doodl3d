// ─────────────────────────────────────────
// STATE
// ─────────────────────────────────────────
let brushColor='#e05c8a', brushSz=6, tool='pen';
let drawing=false, lastP={x:0,y:0}, hasDrawn=false;
let txMode='clay', rainbowT=0;
let scene, camera, renderer, pivot=null;
let threeReady=false;
let savedColor='#e05c8a';
let doodleBBox={minX:0,maxX:100,minY:0,maxY:100,cx:50,cy:50,w:100,h:100};

// ─────────────────────────────────────────
// DRAW CANVAS
// ─────────────────────────────────────────
const dc = document.getElementById('draw-canvas');
const dctx = dc.getContext('2d');

function resizeDraw(){
  const saved = hasDrawn ? dc.toDataURL() : null;
  dc.width = window.innerWidth;
  dc.height = window.innerHeight;
  if(saved){ const im=new Image(); im.onload=()=>dctx.drawImage(im,0,0); im.src=saved; }
}
window.addEventListener('resize', resizeDraw);
resizeDraw();

function gP(e){ const s=e.touches?e.touches[0]:e; return {x:s.clientX, y:s.clientY}; }

dc.addEventListener('mousedown', e=>{ drawing=true; lastP=gP(e); if(tool==='fill')floodFill(gP(e)); });
dc.addEventListener('mousemove', e=>{ if(drawing&&tool!=='fill')stroke(gP(e)); });
dc.addEventListener('mouseup', ()=>drawing=false);
dc.addEventListener('mouseleave', ()=>drawing=false);
dc.addEventListener('touchstart', e=>{ e.preventDefault(); drawing=true; lastP=gP(e); if(tool==='fill')floodFill(gP(e)); },{passive:false});
dc.addEventListener('touchmove', e=>{ e.preventDefault(); if(drawing&&tool!=='fill')stroke(gP(e)); },{passive:false});
dc.addEventListener('touchend', ()=>drawing=false);

function stroke(p){
  if(!hasDrawn){ hasDrawn=true; document.getElementById('draw-hint').style.opacity='0'; }
  dctx.globalCompositeOperation = tool==='erase' ? 'destination-out' : 'source-over';
  dctx.strokeStyle = brushColor;
  dctx.lineWidth = tool==='erase' ? brushSz*4 : brushSz;
  dctx.lineCap='round'; dctx.lineJoin='round';
  dctx.shadowBlur = tool==='erase' ? 0 : 8;
  dctx.shadowColor = brushColor+'55';
  dctx.beginPath(); dctx.moveTo(lastP.x,lastP.y); dctx.lineTo(p.x,p.y); dctx.stroke();
  lastP=p;
}

function floodFill(p){
  if(!hasDrawn){ hasDrawn=true; document.getElementById('draw-hint').style.opacity='0'; }
  const x=~~p.x, y=~~p.y, w=dc.width, h=dc.height;
  const imgD=dctx.getImageData(0,0,w,h), d=imgD.data;
  const at=(x,y)=>(y*w+x)*4;
  const tgt=[d[at(x,y)],d[at(x,y)+1],d[at(x,y)+2],d[at(x,y)+3]];
  const fill=hexRgb(brushColor);
  if(cMatch(tgt,fill)) return;
  const stack=[[x,y]], vis=new Uint8Array(w*h);
  while(stack.length){
    const [cx,cy]=stack.pop();
    if(cx<0||cx>=w||cy<0||cy>=h||vis[cy*w+cx]) continue;
    vis[cy*w+cx]=1;
    if(!cMatch([d[at(cx,cy)],d[at(cx,cy)+1],d[at(cx,cy)+2],d[at(cx,cy)+3]],tgt)) continue;
    d[at(cx,cy)]=fill[0]; d[at(cx,cy)+1]=fill[1]; d[at(cx,cy)+2]=fill[2]; d[at(cx,cy)+3]=255;
    stack.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]);
  }
  dctx.putImageData(imgD,0,0);
}
function cMatch(a,b,t=30){return Math.abs(a[0]-b[0])<t&&Math.abs(a[1]-b[1])<t&&Math.abs(a[2]-b[2])<t&&Math.abs(a[3]-b[3])<t;}
function hexRgb(h){const c=h.replace('#','');return c.length===3?[parseInt(c[0]+c[0],16),parseInt(c[1]+c[1],16),parseInt(c[2]+c[2],16),255]:[parseInt(c.slice(0,2),16),parseInt(c.slice(2,4),16),parseInt(c.slice(4,6),16),255];}

function setCol(el){ brushColor=el.dataset.c; document.querySelectorAll('.sw').forEach(s=>s.classList.remove('on')); el.classList.add('on'); setTool('pen'); }
function setTool(t){ tool=t; ['pen','fill','erase'].forEach(x=>document.getElementById('tb-'+x)?.classList.toggle('on',x===t)); }
function clearAll(){ dctx.clearRect(0,0,dc.width,dc.height); hasDrawn=false; document.getElementById('draw-hint').style.opacity='1'; }

// ─────────────────────────────────────────
// BOUNDING BOX
// ─────────────────────────────────────────
function getDoodleBBox(){
  const w=dc.width, h=dc.height, d=dctx.getImageData(0,0,w,h).data;
  let minX=w, maxX=0, minY=h, maxY=0;
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    if(d[(y*w+x)*4+3]>20){ minX=Math.min(minX,x); maxX=Math.max(maxX,x); minY=Math.min(minY,y); maxY=Math.max(maxY,y); }
  }
  if(maxX===0){ minX=w*.2; maxX=w*.8; minY=h*.2; maxY=h*.8; }
  const pad=10;
  minX=Math.max(0,minX-pad); maxX=Math.min(w,maxX+pad);
  minY=Math.max(0,minY-pad); maxY=Math.min(h,maxY+pad);
  return { minX, maxX, minY, maxY, w:maxX-minX, h:maxY-minY, cx:minX+(maxX-minX)/2, cy:minY+(maxY-minY)/2 };
}

function dominantColor(){
  const d=dctx.getImageData(0,0,dc.width,dc.height).data;
  let r=0,g=0,b=0,n=0;
  for(let i=0;i<d.length;i+=16) if(d[i+3]>50){ r+=d[i]; g+=d[i+1]; b+=d[i+2]; n++; }
  return n ? `rgb(${~~(r/n)},${~~(g/n)},${~~(b/n)})` : '#e05c8a';
}

// ─────────────────────────────────────────
// API
// ─────────────────────────────────────────
async function claudeAPI(body){
  const res=await fetch('/api',{
    method:'POST',
    headers:{
      'Content-Type':'application/json'
    },
    body:JSON.stringify(body)
  });
  if(!res.ok){
    const txt=await res.text();
    console.error('API error',res.status,txt);
    throw new Error('API '+res.status);
  }
  return res.json();
}
function initThree(){
  if(threeReady) return; threeReady=true;
  const c3=document.getElementById('three-canvas');
  renderer=new THREE.WebGLRenderer({canvas:c3, antialias:true, alpha:true, preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled=true;

  scene=new THREE.Scene();

  // Perspective camera — fov=50, we'll scale objects to fit screen fraction
  camera=new THREE.PerspectiveCamera(50, window.innerWidth/window.innerHeight, 0.01, 1000);
  camera.position.set(0, 0, 5);

  // Lighting
  scene.add(new THREE.AmbientLight(0xfff4f8, 0.9));
  const sun=new THREE.DirectionalLight(0xffe8f0, 1.4);
  sun.position.set(3,5,4); sun.castShadow=true; scene.add(sun);
  const fill=new THREE.DirectionalLight(0xd0e8ff, 0.5);
  fill.position.set(-3,-1,2); scene.add(fill);
  const rim=new THREE.DirectionalLight(0xffe0f8, 0.35);
  rim.position.set(0,-4,-2); scene.add(rim);

  // Drag rotate
  let drag=false, prev={x:0,y:0};
  c3.addEventListener('mousedown', e=>{ drag=true; prev={x:e.clientX,y:e.clientY}; });
  window.addEventListener('mouseup', ()=>drag=false);
  window.addEventListener('mousemove', e=>{
    if(!drag||!pivot) return;
    pivot.rotation.y += (e.clientX-prev.x)*0.018;
    pivot.rotation.x += (e.clientY-prev.y)*0.018;
    prev={x:e.clientX, y:e.clientY};
  });
  let lT=null;
  c3.addEventListener('touchstart', e=>{ lT=e.touches[0]; },{passive:true});
  c3.addEventListener('touchmove', e=>{
    e.preventDefault(); if(!pivot||!lT) return;
    const t=e.touches[0];
    pivot.rotation.y += (t.clientX-lT.clientX)*0.022;
    pivot.rotation.x += (t.clientY-lT.clientY)*0.022;
    lT=t;
  },{passive:false});

  window.addEventListener('resize',()=>{
    renderer.setSize(window.innerWidth,window.innerHeight);
    camera.aspect=window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
  });

  (function loop(){
    requestAnimationFrame(loop);
    if(pivot){
      pivot.rotation.y += 0.01;
      if(txMode==='rainbow'){ rainbowT+=0.018; pivot.children[0]?.material?.color?.setHSL(rainbowT%1,.72,.62); }
    }
    renderer.render(scene,camera);
  })();
}

// ─────────────────────────────────────────
// MATERIALS — with fur bump map
// ─────────────────────────────────────────
function furBumpMap(col){
  const cv=document.createElement('canvas'); cv.width=cv.height=256;
  const cx=cv.getContext('2d');
  const c=new THREE.Color(col); const h={};c.getHSL(h);
  // base color
  cx.fillStyle=`hsl(${~~(h.h*360)},${~~(h.s*80)}%,${~~(h.l*100)}%)`;
  cx.fillRect(0,0,256,256);
  // draw fur strands as short lines
  for(let i=0;i<2200;i++){
    const x=Math.random()*256, y=Math.random()*256;
    const len=3+Math.random()*9;
    const angle=-Math.PI/2 + (Math.random()-.5)*0.8; // mostly upward with variation
    const dx=Math.cos(angle)*len, dy=Math.sin(angle)*len;
    const dark=Math.random()>.5;
    cx.strokeStyle=dark?`hsla(${~~(h.h*360)},${~~(h.s*60)}%,${~~(h.l*55)}%,0.7)`
                       :`hsla(${~~(h.h*360)},${~~(h.s*40)}%,${~~(h.l*130+15)}%,0.5)`;
    cx.lineWidth=0.5+Math.random()*1.2;
    cx.beginPath(); cx.moveTo(x,y); cx.lineTo(x+dx,y+dy); cx.stroke();
  }
  return new THREE.CanvasTexture(cv);
}

function furNormalMap(){
  // Normal map: encode fur strand directions as RGB bumps
  const cv=document.createElement('canvas'); cv.width=cv.height=256;
  const cx=cv.getContext('2d');
  cx.fillStyle='rgb(128,128,255)'; cx.fillRect(0,0,256,256); // flat normal
  for(let i=0;i<1800;i++){
    const x=Math.random()*256, y=Math.random()*256;
    const len=4+Math.random()*8;
    const angle=-Math.PI/2+(Math.random()-.5)*0.7;
    const dx=Math.cos(angle)*len, dy=Math.sin(angle)*len;
    // encode direction as normal: R=x, G=y, B=up
    const r=~~(128+dx*6), g=~~(128+dy*6), b=220;
    cx.strokeStyle=`rgb(${Math.min(255,Math.max(0,r))},${Math.min(255,Math.max(0,g))},${b})`;
    cx.lineWidth=1+Math.random()*1.5;
    cx.beginPath(); cx.moveTo(x,y); cx.lineTo(x+dx,y+dy); cx.stroke();
  }
  return new THREE.CanvasTexture(cv);
}

function makeMat(tx,col){
  const c=new THREE.Color(col);
  if(tx==='metal') return new THREE.MeshPhongMaterial({color:c,specular:new THREE.Color(.9,.9,.9),shininess:400});
  if(tx==='rainbow') return new THREE.MeshPhongMaterial({color:new THREE.Color().setHSL(0,.72,.62),shininess:130});
  if(tx==='fur') return new THREE.MeshPhongMaterial({
    color:c, shininess:12,
    map: furBumpMap(col),
    normalMap: furNormalMap(),
    normalScale: new THREE.Vector2(2.2, 2.2),
  });
  // clay — smooth matte
  return new THREE.MeshLambertMaterial({color:c});
}
function setTex(el){
  txMode=el.dataset.tx;
  document.querySelectorAll('.tx').forEach(t=>t.classList.remove('on')); el.classList.add('on');
  if(pivot?.children[0]){ pivot.children[0].material.dispose(); pivot.children[0].material=makeMat(txMode,savedColor); }
}

// ─────────────────────────────────────────
// SCREEN → WORLD coordinate mapping
// Given a screen pixel position, return the 3D world position
// at z=0 plane as seen by a perspective camera at z=5 with fov=50
// ─────────────────────────────────────────
function screenToWorld(sx, sy){
  // NDC: -1..+1
  const ndcX = (sx / window.innerWidth) * 2 - 1;
  const ndcY = -((sy / window.innerHeight) * 2 - 1); // flip Y
  // At z=0 plane with camera at z=5, fov=50:
  // visible height at z=0: 2 * tan(fov/2 * PI/180) * 5
  const halfH = Math.tan(25 * Math.PI/180) * 5;
  const halfW = halfH * camera.aspect;
  return { x: ndcX * halfW, y: ndcY * halfH };
}

// ─────────────────────────────────────────
// MAIN: DOODLE → AI CREATURE → 3D
// ─────────────────────────────────────────
async function makeIt3D(){
  const d=dctx.getImageData(0,0,dc.width,dc.height).data;
  if(!Array.from(d).some((v,i)=>i%4===3&&v>0)){ shakeBtn(); return; }

  doodleBBox = getDoodleBBox();
  savedColor = dominantColor();
  const pixelSnapshot = dctx.getImageData(0,0,dc.width,dc.height);

  // Crop snapshot to doodle bbox, scaled up for Claude
  const pad=24;
  const cropW=Math.min(600, doodleBBox.w+pad*2);
  const cropH=Math.min(600, doodleBBox.h+pad*2);
  const cropC=document.createElement('canvas');
  cropC.width=cropW; cropC.height=cropH;
  const cropCtx=cropC.getContext('2d');
  cropCtx.fillStyle='#ffffff'; cropCtx.fillRect(0,0,cropW,cropH);
  // Draw original doodle white-on-white then repaint strokes dark for contrast
  const tmpC=document.createElement('canvas');
  tmpC.width=dc.width; tmpC.height=dc.height;
  const tmpCtx=tmpC.getContext('2d');
  tmpCtx.fillStyle='#ffffff'; tmpCtx.fillRect(0,0,tmpC.width,tmpC.height);
  tmpCtx.drawImage(dc,0,0);
  cropCtx.drawImage(tmpC,
    doodleBBox.minX-pad, doodleBBox.minY-pad, doodleBBox.w+pad*2, doodleBBox.h+pad*2,
    0, 0, cropW, cropH);
  const b64=cropC.toDataURL('image/png').split(',')[1];

  // Compute doodle's aspect ratio for coordinate hints
  const dAR=(doodleBBox.w/Math.max(1,doodleBBox.h)).toFixed(2);
  const dWide=doodleBBox.w>doodleBBox.h;

  dctx.clearRect(0,0,dc.width,dc.height);
  hasDrawn=false;

  showLoading('This may take a few seconds...');
  initThree();

  let built=false;
  try{
    const resp=await claudeAPI({
      model:'claude-sonnet-4-6',
      max_tokens:3500,
      messages:[{role:'user',content:[
        {type:'image',source:{type:'base64',media_type:'image/png',data:b64}},
        {type:'text',text:`You are a creature sculptor. Look at this hand-drawn doodle carefully.

Your job:
1. Figure out what kind of creature it most resembles (animal, monster, fantasy creature, alien, whatever fits best)
2. Generate SVG paths that CREATE that creature — but shaped closely to match the user's actual drawing

The user's doodle is ${dWide?'wider than tall (landscape)':'taller than wide (portrait)'}, aspect ratio ~${dAR}.
Match this proportion in your output.

Coordinate space: 0–200 (center 100,100).
- The BODY must span roughly: ${dWide?'x: 25–175, y: 55–155':'x: 40–160, y: 20–175'}
- Match the overall silhouette shape the user drew

Return ONLY valid JSON — no markdown, no explanation:
{
  "creature": "name of creature",
  "body": "SVG path d= for main body",
  "parts": [
    {"name": "head", "path": "SVG path", "z": 1.3, "color": "same"},
    {"name": "left_ear", "path": "SVG path", "z": 1.6, "color": "same"},
    {"name": "right_ear", "path": "SVG path", "z": 1.6, "color": "same"},
    {"name": "left_eye", "path": "SVG path", "z": 2.2, "color": "dark"},
    {"name": "right_eye", "path": "SVG path", "z": 2.2, "color": "dark"},
    {"name": "snout", "path": "SVG path", "z": 1.9, "color": "light"},
    {"name": "nose", "path": "SVG path", "z": 2.4, "color": "dark"}
  ]
}

RULES — read carefully:
- MATCH THE DOODLE SHAPE. If the user drew a wide round creature, your body must be wide and round. If they drew a long-necked creature, include a neck. Honor what they drew.
- Identify creature type from the drawing — could be cat, dog, bear, dragon, alien, monster, fish, bird, anything
- Add creature-appropriate extras: horns for monsters, wings for birds/dragons, fins for fish, long ears for rabbits, etc.
- Use smooth BEZIER CURVES (C and Q commands) everywhere — creatures have organic shapes, no straight lines
- Every path MUST close with Z
- Body: large filled silhouette covering most of the coordinate space
- Head: overlapping the body at the top, sized right for the creature type
- Eyes: always present, symmetrical, small filled ovals — left eye ~x:78 y:72, right eye ~x:122 y:72 (adjust for creature)
- Parts must overlap body/head — nothing floating in empty space
- 5–10 parts total, pick what makes this creature recognizable
- "color" values: "same" (match body), "dark" (#111), "light" (lighter tint), "pink", "accent"`}
      ]}]
    });

    const raw=resp.content?.[0]?.text?.trim()||'';
    const cleaned=raw.replace(/```json|```/g,'').trim();
    const jsonMatch=cleaned.match(/\{[\s\S]*\}/);
    if(!jsonMatch) throw new Error('no json');
    const parsed=JSON.parse(jsonMatch[0]);

    if(parsed.body?.length>4){
      showLoading(`✨ Sculpting your ${parsed.creature||'creature'}…`);
      buildCreature(parsed);
      built=true;
    }
  }catch(e){ console.warn('creature error:',e); }

  if(!built){
    showLoading('Building from your strokes…');
    buildFromContour(pixelSnapshot);
  }

  hideLoading();
  enterViewMode();
}

// ─────────────────────────────────────────
// BUILD CREATURE — layered multi-part 3D
// ─────────────────────────────────────────
function buildCreature(data){
  const BASE=22, BEVEL=4;

  if(pivot){ scene.remove(pivot); pivot.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();}); pivot=null; }
  pivot=new THREE.Group();
  scene.add(pivot);

  // Color palette derived from the user's drawn color
  const base=new THREE.Color(savedColor);
  const hsl={};base.getHSL(hsl);
  const lightCol=new THREE.Color().setHSL(hsl.h,hsl.s*.5,Math.min(.93,hsl.l*1.5)).getStyle();
  const darkCol='#111118';
  const accentCol=new THREE.Color().setHSL((hsl.h+.55)%1,.7,.6).getStyle();
  const pinkCol='#f0819a';

  function colorFor(part){
    const c=part.color||'same';
    if(c==='dark') return darkCol;
    if(c==='light'||c==='lighter') return lightCol;
    if(c==='accent') return accentCol;
    if(c==='pink') return pinkCol;
    if(/eye|pupil|nose/.test(part.name)) return darkCol;
    if(/snout|muzzle|beak|bill/.test(part.name)) return lightCol;
    return savedColor;
  }

  // Collect all parts with z-offsets
  const allParts=[
    {path:data.body, z:0, depth:BASE, bevel:BEVEL, color:savedColor, name:'body'},
    ...(data.parts||[]).map(p=>({
      path:p.path,
      z:(p.z-1)*BASE*0.45,
      depth:BASE*(p.z||1),
      bevel:BEVEL*Math.max(.35,(p.z||1)*.65),
      color:colorFor(p),
      name:p.name
    }))
  ];

  // Compute shared center from all paths
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const p of allParts){
    try{
      const pts=parsePath(p.path).getPoints(40);
      for(const pt of pts){
        if(pt.x<minX)minX=pt.x; if(pt.x>maxX)maxX=pt.x;
        if(pt.y<minY)minY=pt.y; if(pt.y>maxY)maxY=pt.y;
      }
    }catch(e){}
  }
  const cx=(minX+maxX)/2, cy=(minY+maxY)/2;

  // Build meshes — all centered at (cx,cy), z-offset creates layered pop-out
  for(const p of allParts){
    try{
      const shape=parsePath(p.path);
      const geo=new THREE.ExtrudeGeometry(shape,{
        depth:p.depth, bevelEnabled:true,
        bevelThickness:p.bevel, bevelSize:p.bevel*.75, bevelSegments:8
      });
      const mesh=new THREE.Mesh(geo, makeMat(txMode, p.color));
      mesh.position.set(-cx,-cy,p.z);
      mesh.castShadow=true;
      pivot.add(mesh);
    }catch(e){ console.warn('build error',p.name,e); }
  }

  // Fit to doodle bbox on screen
  const bbox=doodleBBox;
  const wC=screenToWorld(bbox.cx,bbox.cy);
  const wTL=screenToWorld(bbox.minX,bbox.minY);
  const wBR=screenToWorld(bbox.maxX,bbox.maxY);
  const wW=Math.abs(wBR.x-wTL.x), wH=Math.abs(wBR.y-wTL.y);
  const sz=new THREE.Vector3();
  new THREE.Box3().setFromObject(pivot).getSize(sz);
  const scl=Math.min(wW/Math.max(sz.x,.01), wH/Math.max(sz.y,.01))*.88;

  pivot.position.set(wC.x,wC.y,0);
  pivot.scale.setScalar(0);
  let t=0;
  (function pop(){
    t+=0.055;
    const s=scl*(t<0.6?t/0.6:1+Math.sin((t-0.6)*Math.PI)*.1*(1.4-t));
    if(pivot)pivot.scale.setScalar(Math.max(0,s));
    if(t<1.5)requestAnimationFrame(pop);
    else if(pivot)pivot.scale.setScalar(scl);
  })();
}

// ─────────────────────────────────────────
// BUILD FROM SVG PATH (kept for potential future use)
// ─────────────────────────────────────────
function buildFromPath(pathD){
  const shape = parsePath(pathD);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 18, bevelEnabled:true, bevelThickness:5, bevelSize:4, bevelSegments:6
  });
  placeModel(geo);
}

// ─────────────────────────────────────────
// STROKE SKELETON → 3D TUBES (no fill)
// Finds centerlines of drawn strokes, builds a tube per chain
// ─────────────────────────────────────────
function buildFromContour(imgData){
  const bbox=doodleBBox;
  const sw=dc.width, sh=dc.height;
  const pxd=imgData.data;

  // Sample grid
  const RES=64;
  const gw=RES, gh=Math.max(4,Math.round(RES*(bbox.h/bbox.w)));
  const grid=new Uint8Array(gw*gh);
  for(let gy=0;gy<gh;gy++) for(let gx=0;gx<gw;gx++){
    const px=Math.round(bbox.minX+gx/gw*bbox.w);
    const py=Math.round(bbox.minY+gy/gh*bbox.h);
    if(px>=0&&px<sw&&py>=0&&py<sh&&pxd[(py*sw+px)*4+3]>20) grid[gy*gw+gx]=1;
  }

  // Scan columns for top and bottom boundary points
  const topPts=[], botPts=[];
  for(let gx=0;gx<gw;gx++){
    let top=-1,bot=-1;
    for(let gy=0;gy<gh;gy++){ if(grid[gy*gw+gx]&&top<0) top=gy; if(grid[gy*gw+gx]) bot=gy; }
    if(top>=0){ topPts.push({x:gx/gw,y:top/gh}); botPts.push({x:gx/gw,y:bot/gh}); }
  }

  if(topPts.length<3){
    // Degenerate — use bbox rect
    const shape=new THREE.Shape();
    shape.moveTo(-100,-100);shape.lineTo(100,-100);shape.lineTo(100,100);shape.lineTo(-100,100);shape.closePath();
    const geo=new THREE.ExtrudeGeometry(shape,{depth:8,bevelEnabled:true,bevelThickness:2,bevelSize:1.5,bevelSegments:4});
    placeModel(geo); return;
  }

  // Build silhouette: top contour left→right, bottom contour right→left
  const mx=x=>(x-0.5)*200, my=y=>-(y-0.5)*200*(bbox.h/bbox.w);
  const shape=new THREE.Shape();
  shape.moveTo(mx(topPts[0].x), my(topPts[0].y));
  topPts.forEach(p=>shape.lineTo(mx(p.x), my(p.y)));
  for(let i=botPts.length-1;i>=0;i--) shape.lineTo(mx(botPts[i].x), my(botPts[i].y));
  shape.closePath();

  const geo=new THREE.ExtrudeGeometry(shape,{depth:8,bevelEnabled:true,bevelThickness:2,bevelSize:1.5,bevelSegments:4});
  placeModel(geo);
}


// ─────────────────────────────────────────
// SVG PATH PARSER
// ─────────────────────────────────────────
function parsePath(d){
  const shape=new THREE.Shape();
  const cmds=d.match(/[MmLlCcQqZzHhVv][^MmLlCcQqZzHhVv]*/g)||[];
  let cx=0,cy=0,started=false;
  const rx=n=>n-100, ry=n=>-(n-100);
  for(const cmd of cmds){
    const t=cmd[0],ns=cmd.slice(1).trim().split(/[\s,]+/).filter(Boolean).map(Number);
    switch(t){
      case 'M':for(let i=0;i<ns.length;i+=2){const x=rx(ns[i]),y=ry(ns[i+1]);started?shape.lineTo(x,y):shape.moveTo(x,y);cx=ns[i];cy=ns[i+1];started=true;}break;
      case 'm':for(let i=0;i<ns.length;i+=2){cx+=ns[i];cy+=ns[i+1];started?shape.lineTo(rx(cx),ry(cy)):shape.moveTo(rx(cx),ry(cy));started=true;}break;
      case 'L':for(let i=0;i<ns.length;i+=2){cx=ns[i];cy=ns[i+1];shape.lineTo(rx(cx),ry(cy));}break;
      case 'l':for(let i=0;i<ns.length;i+=2){cx+=ns[i];cy+=ns[i+1];shape.lineTo(rx(cx),ry(cy));}break;
      case 'H':ns.forEach(n=>{cx=n;shape.lineTo(rx(cx),ry(cy));});break;
      case 'h':ns.forEach(n=>{cx+=n;shape.lineTo(rx(cx),ry(cy));});break;
      case 'V':ns.forEach(n=>{cy=n;shape.lineTo(rx(cx),ry(cy));});break;
      case 'v':ns.forEach(n=>{cy+=n;shape.lineTo(rx(cx),ry(cy));});break;
      case 'C':for(let i=0;i<ns.length;i+=6){shape.bezierCurveTo(rx(ns[i]),ry(ns[i+1]),rx(ns[i+2]),ry(ns[i+3]),rx(ns[i+4]),ry(ns[i+5]));cx=ns[i+4];cy=ns[i+5];}break;
      case 'c':for(let i=0;i<ns.length;i+=6){shape.bezierCurveTo(rx(cx+ns[i]),ry(cy+ns[i+1]),rx(cx+ns[i+2]),ry(cy+ns[i+3]),rx(cx+ns[i+4]),ry(cy+ns[i+5]));cx+=ns[i+4];cy+=ns[i+5];}break;
      case 'Q':for(let i=0;i<ns.length;i+=4){shape.quadraticCurveTo(rx(ns[i]),ry(ns[i+1]),rx(ns[i+2]),ry(ns[i+3]));cx=ns[i+2];cy=ns[i+3];}break;
      case 'q':for(let i=0;i<ns.length;i+=4){shape.quadraticCurveTo(rx(cx+ns[i]),ry(cy+ns[i+1]),rx(cx+ns[i+2]),ry(cy+ns[i+3]));cx+=ns[i+2];cy+=ns[i+3];}break;
      case 'Z':case 'z':shape.closePath();break;
    }
  }
  return shape;
}

// ─────────────────────────────────────────
// PLACE MODEL — shared by both paths
// Scales and positions mesh to match doodle's screen bbox exactly
// ─────────────────────────────────────────
function placeModel(geo){
  if(pivot){ scene.remove(pivot); pivot.traverse(o=>{ if(o.geometry)o.geometry.dispose(); if(o.material)o.material.dispose(); }); pivot=null; }

  const mesh=new THREE.Mesh(geo, makeMat(txMode, savedColor));
  mesh.castShadow=true;

  // Center geometry at origin
  geo.computeBoundingBox();
  const gb=geo.boundingBox;
  const gW=gb.max.x-gb.min.x; // should be ~200 for our shapes
  const gH=gb.max.y-gb.min.y;
  mesh.position.set(-(gb.min.x+gW/2), -(gb.min.y+gH/2), -(gb.min.z+(gb.max.z-gb.min.z)/2));

  pivot=new THREE.Group();
  pivot.add(mesh);
  scene.add(pivot);

  // Convert doodle bbox screen coords → world units
  const bbox=doodleBBox;
  const wCenter=screenToWorld(bbox.cx, bbox.cy);

  // World-space size of the doodle
  const wTopLeft=screenToWorld(bbox.minX, bbox.minY);
  const wBotRight=screenToWorld(bbox.maxX, bbox.maxY);
  const worldW=Math.abs(wBotRight.x-wTopLeft.x);
  const worldH=Math.abs(wBotRight.y-wTopLeft.y);

  // Scale so geometry (200 units wide) fits the doodle's world footprint
  const scaleX=worldW/gW;
  const scaleY=worldH/gH;
  const scl=Math.min(scaleX,scaleY); // uniform: use smaller axis to stay within bounds

  pivot.scale.setScalar(scl);
  pivot.position.set(wCenter.x, wCenter.y, 0);

  // Pop-in
  pivot.scale.setScalar(0);
  let t=0;
  (function pop(){
    t+=0.06;
    const s=scl*(t<0.6 ? t/0.6 : 1 + Math.sin((t-0.6)*Math.PI)*0.1*(1.4-t));
    if(pivot) pivot.scale.setScalar(Math.max(0,s));
    if(t<1.5) requestAnimationFrame(pop);
    else if(pivot) pivot.scale.setScalar(scl);
  })();
}


// ─────────────────────────────────────────
// UI
// ─────────────────────────────────────────
function enterViewMode(){
  document.getElementById('toolbar').classList.add('hidden');
  document.getElementById('view-controls').classList.add('show');
  document.getElementById('three-canvas').classList.add('active');
  dc.style.pointerEvents='none';
}
function backToDraw(){
  document.getElementById('toolbar').classList.remove('hidden');
  document.getElementById('view-controls').classList.remove('show');
  document.getElementById('three-canvas').classList.remove('active');
  dc.style.pointerEvents='auto';
  document.getElementById('draw-hint').style.opacity='1';
  if(pivot){ scene.remove(pivot); pivot=null; }
}
function showLoading(msg){ document.getElementById('loading').classList.add('show'); document.getElementById('ld-sub').textContent=msg||''; }
function hideLoading(){ document.getElementById('loading').classList.remove('show'); }
function shakeBtn(){
  const b=document.getElementById('go-btn');
  b.style.transform='translateX(-6px)';
  setTimeout(()=>b.style.transform='translateX(6px)',80);
  setTimeout(()=>b.style.transform='translateX(-4px)',160);
  setTimeout(()=>b.style.transform='none',240);
  const o=b.textContent; b.textContent='✏️ Draw first!'; setTimeout(()=>b.textContent=o,2000);
}

// ─────────────────────────────────────────
// CAPTURE & SHARE
// ─────────────────────────────────────────
let capMode='photo';
let mediaRecorder=null, recChunks=[], recTimerInterval=null, recSecs=0;
let capturedBlob=null, capturedType='image/png';

function setCapMode(mode){
  capMode=mode;
  document.getElementById('mode-photo').classList.toggle('on',mode==='photo');
  document.getElementById('mode-video').classList.toggle('on',mode==='video');
  // reset recording state if switching
  if(mediaRecorder&&mediaRecorder.state!=='inactive') stopRecording();
}

function handleCapture(){
  if(capMode==='photo') takePhoto();
  else {
    if(mediaRecorder&&mediaRecorder.state==='recording') stopRecording();
    else startRecording();
  }
}

// Compose all visible layers into one canvas frame
function composeFrame(){
  const w=window.innerWidth, h=window.innerHeight;
  const dpr=Math.min(window.devicePixelRatio,2);
  const out=document.createElement('canvas');
  out.width=w*dpr; out.height=h*dpr;
  const ctx=out.getContext('2d');
  ctx.scale(dpr,dpr);
  // Background: cream polka dots
  ctx.fillStyle='#fff8f2';
  ctx.fillRect(0,0,w,h);
  ctx.fillStyle='rgba(255,179,198,0.13)';
  for(let x=14;x<w;x+=28) for(let y=14;y<h;y+=28){
    ctx.beginPath(); ctx.arc(x,y,1.5,0,Math.PI*2); ctx.fill();
  }
  // Three.js canvas
  const c3=document.getElementById('three-canvas');
  if(c3.classList.contains('active')) ctx.drawImage(c3,0,0,w,h);
  return out;
}

function takePhoto(){
  // Ensure latest frame is rendered
  if(scene && camera) renderer.render(scene,camera);
  const out=composeFrame();
  out.toBlob(blob=>{
    if(!blob){ console.error('takePhoto: toBlob returned null'); return; }
    capturedBlob=blob; capturedType='image/png';
    showShare(URL.createObjectURL(blob),'image');
  },'image/png');
}

function startRecording(){
  const btn=document.getElementById('capture-btn');
  const timer=document.getElementById('rec-timer');
  recChunks=[];

  // Offscreen canvas we draw frames into for MediaRecorder — match composeFrame output size
  const dpr=Math.min(window.devicePixelRatio,2);
  const mergeCanvas=document.createElement('canvas');
  mergeCanvas.width=window.innerWidth*dpr; mergeCanvas.height=window.innerHeight*dpr;
  const mctx=mergeCanvas.getContext('2d');

  let rafId, recording=true;
  function drawFrame(){
    if(!recording) return;
    if(scene && camera) renderer.render(scene,camera);
    const frame=composeFrame();
    mctx.clearRect(0,0,mergeCanvas.width,mergeCanvas.height);
    mctx.drawImage(frame,0,0);
    rafId=requestAnimationFrame(drawFrame);
  }
  drawFrame();

  const stream=mergeCanvas.captureStream(30);
  const mimeType=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(m=>{try{return MediaRecorder.isTypeSupported(m);}catch(e){return false;}})||'video/webm';
  try{
    mediaRecorder=new MediaRecorder(stream,{mimeType});
  }catch(e){
    mediaRecorder=new MediaRecorder(stream);
  }
  mediaRecorder.ondataavailable=e=>{ if(e.data&&e.data.size>0) recChunks.push(e.data); };
  mediaRecorder.onstop=()=>{
    recording=false;
    cancelAnimationFrame(rafId);
    const blob=new Blob(recChunks,{type:mimeType});
    capturedBlob=blob; capturedType=mimeType;
    showShare(URL.createObjectURL(blob),'video');
  };
  mediaRecorder.start(100); // collect data every 100ms

  btn.classList.add('recording');
  timer.classList.add('show');
  recSecs=0; timer.textContent='⏺ 0s';
  recTimerInterval=setInterval(()=>{ recSecs++; timer.textContent=`⏺ ${recSecs}s`; },1000);
}

function stopRecording(){
  if(mediaRecorder&&mediaRecorder.state==='recording') mediaRecorder.stop();
  clearInterval(recTimerInterval);
  const btn=document.getElementById('capture-btn');
  const timer=document.getElementById('rec-timer');
  btn.classList.remove('recording');
  timer.classList.remove('show');
}

function showShare(url, type){
  const overlay=document.getElementById('share-overlay');
  const img=document.getElementById('share-card-img');
  const vid=document.getElementById('share-card-vid');
  const title=document.getElementById('share-card-title');
  if(type==='image'){
    img.src=url; img.classList.add('show'); vid.classList.remove('show');
    title.textContent='Your doodle! 📸';
  } else {
    vid.src=url; vid.classList.add('show'); img.classList.remove('show');
    title.textContent='Your doodle video! 🎥';
  }
  overlay.classList.add('show');
}

function closeShare(){
  const overlay=document.getElementById('share-overlay');
  overlay.classList.remove('show');
  document.getElementById('share-card-img').classList.remove('show');
  document.getElementById('share-card-vid').classList.remove('show');
}

function makeShareCard(sourceCanvas){
  // Bake branded card: screenshot + doodl3d watermark
  const w=sourceCanvas.width, h=sourceCanvas.height;
  const out=document.createElement('canvas');
  out.width=w; out.height=h;
  const ctx=out.getContext('2d');
  ctx.drawImage(sourceCanvas,0,0);
  // Gradient scrim at bottom
  const grad=ctx.createLinearGradient(0,h*0.72,0,h);
  grad.addColorStop(0,'rgba(0,0,0,0)');
  grad.addColorStop(1,'rgba(0,0,0,0.55)');
  ctx.fillStyle=grad; ctx.fillRect(0,0,w,h);
  // Brand dot
  const bx=20, by=h-28, br=14;
  const dg=ctx.createRadialGradient(bx,by,0,bx,by,br);
  dg.addColorStop(0,'#ffb3c6'); dg.addColorStop(1,'#dbbff5');
  ctx.fillStyle=dg; ctx.beginPath(); ctx.arc(bx,by,br,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.font='12px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('🍬',bx,by);
  // Brand name
  ctx.fillStyle='rgba(255,255,255,0.92)';
  ctx.font=`bold ${Math.round(w*0.04)}px Fredoka, sans-serif`;
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText('doodl3d',bx+br+8,by);
  return out;
}

function downloadCapture(){
  const isVideo = capturedType.startsWith('video/');
  if(isVideo){
    // For video just download the webm/mp4 directly
    const ext = capturedType.includes('mp4') ? 'mp4' : 'webm';
    const a=document.createElement('a');
    a.href=URL.createObjectURL(capturedBlob);
    a.download=`doodl3d.${ext}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  } else {
    // Bake branding into the photo
    const img=new Image();
    img.onload=()=>{
      const tmp=document.createElement('canvas');
      tmp.width=img.naturalWidth||window.innerWidth;
      tmp.height=img.naturalHeight||window.innerHeight;
      const tc=tmp.getContext('2d'); tc.drawImage(img,0,0);
      const branded=makeShareCard(tmp);
      branded.toBlob(b=>{
        const a=document.createElement('a');
        a.href=URL.createObjectURL(b);
        a.download='doodl3d.png';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      },'image/png');
    };
    img.src=URL.createObjectURL(capturedBlob);
  }
}

async function webShare(){
  const isVideo = capturedType.startsWith('video/');
  const ext = isVideo ? 'mp4' : 'png';
  const shareMime = isVideo ? 'video/mp4' : 'image/png';
  const blob = (capturedBlob.type === shareMime) ? capturedBlob : new Blob([capturedBlob],{type:shareMime});
  const file = new File([blob], `doodl3d.${ext}`, {type: shareMime});

  if(navigator.share && navigator.canShare && navigator.canShare({files:[file]})){
    try{
      await navigator.share({
        files:[file],
        title:'My doodl3d creation! 🍬',
        text:'Made with doodl3d'
      });
    }catch(e){
      if(e.name!=='AbortError') downloadCapture();
    }
  } else if(navigator.share){
    // Fallback: share URL only
    try{
      await navigator.share({title:'My doodl3d creation! 🍬', text:'Made with doodl3d'});
    }catch(e){ downloadCapture(); }
  } else {
    // Desktop fallback — just download
    downloadCapture();
  }
}

// ─────────────────────────────────────────
// INIT
// ─────────────────────────────────────────
window.addEventListener('load',()=>{
  resizeDraw();
  initThree();
});
