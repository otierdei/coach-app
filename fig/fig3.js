/* Exercise figures v3: CC0 MakeHuman body (athletic male), 20 bone rig, white skin, working muscles red.
   Posing: every bone gets a world direction plus a bend reference; arms and legs are solved with two bone IK,
   so hands and feet sit exactly on their targets (floor, box, bar). */
(function(){
  const T = window.THREE;
  const v3 = (a) => new T.Vector3(a[0], a[1], a[2]);
  const lerp = (a,b,t) => a+(b-a)*t, ease = t => t<.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2;
  const lv = (a,b,t) => a.map((x,i)=>lerp(x,b[i],t));
  const SC = 0.1; // model is in decimetres

  let M = null; // model data
  function setModel(m){ M = m; M.nb = {}; m.bones.forEach((b,i)=>M.nb[b.n]=i); buildNeighbours(); }
  function buildNeighbours(){
    const n = M.pos.length/3, nb = Array.from({length:n},()=>new Set());
    for(let i=0;i<M.idx.length;i+=3){ const a=M.idx[i],b=M.idx[i+1],c=M.idx[i+2]; nb[a].add(b);nb[a].add(c);nb[b].add(a);nb[b].add(c);nb[c].add(a);nb[c].add(b); }
    M.adj = nb.map(s=>[...s]);
  }

  // colour per vertex: white, red where the muscle works, a soft grey seam between muscles for the contours
  const WHITE = [0.95,0.93,0.90], RED = [0.60,0.07,0.05], SEAM = 0.5;
  function colours(work){
    const n = M.pos.length/3, R = M.regions, act = new Float32Array(n), seam = new Float32Array(n);
    const on = new Set(work.map(w=>R.indexOf(w)));
    for(let i=0;i<n;i++) act[i] = on.has(M.reg[i]) ? 1 : 0;
    for(let i=0;i<n;i++){ const r = M.seg[i]; for(const j of M.adj[i]) if(M.seg[j]!==r && (r||M.seg[j])) { seam[i] = (r && M.seg[j]) ? 1 : .55; break; } }
    let a = act, s = seam;
    for(let k=0;k<2;k++){ const a2=new Float32Array(n), s2=new Float32Array(n);
      for(let i=0;i<n;i++){ let sa=a[i]*2, ss=s[i]*3, c=2, cs=3; for(const j of M.adj[i]){ sa+=a[j]; ss+=s[j]; c++; cs++; } a2[i]=sa/c; s2[i]=s[i]; }
      a=a2; s=s2; }
    const col = new Float32Array(n*3);
    for(let i=0;i<n;i++){ const t = Math.min(1, Math.max(0, (a[i]-.3)/.4)), d = 1 - (1-SEAM)*s[i];
      for(let c=0;c<3;c++) col[i*3+c] = lerp(WHITE[c], RED[c], t) * d; }
    return col;
  }

  function build(){
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(M.pos.map(x=>x*SC), 3));
    g.setIndex(M.idx);
    g.setAttribute('skinIndex', new T.Uint16BufferAttribute(M.si, 4));
    g.setAttribute('skinWeight', new T.Float32BufferAttribute(M.sw, 4));
    g.computeVertexNormals();
    const bones = M.bones.map(b=>{ const o = new T.Bone(); o.name = b.n; return o; });
    M.bones.forEach((b,i)=>{ const h = v3(b.h).multiplyScalar(SC);
      if(b.p){ const p = M.bones[M.nb[b.p]]; bones[M.nb[b.p]].add(bones[i]); bones[i].position.copy(h.sub(v3(p.h).multiplyScalar(SC))); }
      else bones[i].position.copy(h); });
    const mat = new T.MeshStandardMaterial({vertexColors:true, roughness:.62, metalness:0});
    const mesh = new T.SkinnedMesh(g, mat);
    const root = bones[0]; mesh.add(root); mesh.bind(new T.Skeleton(bones));
    return {mesh, bones, g};
  }

  // rest frames: direction head->tail and a bend reference per bone
  const FWD = [0,0,1];
  function restRef(name){
    if(/upperarm|forearm/.test(name)) return [0,0,-1];   // elbow points back
    if(/hand/.test(name)) return [0,0,1];               // palm forward in rest (A pose)
    if(/foot/.test(name)) return [0,1,0];               // top of the foot
    return FWD;                                          // torso, legs: front
  }
  const _m = new T.Matrix4(), _q = new T.Quaternion();
  function basisQ(dir, ref){
    const y = dir.clone().normalize(), z = ref.clone().sub(y.clone().multiplyScalar(ref.dot(y))).normalize(), x = new T.Vector3().crossVectors(y, z);
    _m.makeBasis(x, y, z); return new T.Quaternion().setFromRotationMatrix(_m);
  }
  function restQ(i){ const b = M.bones[i]; if(b.r){ let d0 = v3(b.t).sub(v3(b.h)); return basisQ(d0, v3(b.r)); } let d = v3(b.t).sub(v3(b.h)); if(d.length()<1e-4) d = new T.Vector3(0,1,0); return basisQ(d, v3(restRef(b.n))); }

  // pose = {hips:[x,y,z] (world m), dirs:{bone:[dir, ref]}, ik:{hand.L:{target, pole}, ...}}
  function apply(F, pose){
    const B = F.bones, wq = {};
    if(!F.rq) F.rq = M.bones.map((_,i)=>restQ(i));
    F.mesh.position.set(0,0,0);
    // root placement: hips head goes to pose.hips
    const hh = v3(M.bones[0].h).multiplyScalar(SC);
    B[0].position.set(pose.hips[0], pose.hips[1], pose.hips[2]);
    const set = (name, dir, ref) => { const i = M.nb[name]; const q = basisQ(v3(dir), v3(ref)).multiply(F.rq[i].clone().invert()); wq[name] = q; };
    const len = name => { const b = M.bones[M.nb[name]]; return v3(b.t).sub(v3(b.h)).length()*SC; };
    for(const [n,[d,r]] of Object.entries(pose.dirs)) set(n, d, r);
    // fill bones not given: inherit parent world rotation
    const order = M.bones.map(b=>b.n);
    const world = {}; // world position of bone heads, computed as we go
    const localQ = (n) => { const b = M.bones[M.nb[n]]; const pq = b.p ? wq[b.p] : new T.Quaternion(); return pq.clone().invert().multiply(wq[n]); };
    const solveChain = (a, bnm, c, target, pole, endDir, endRef) => {
      // positions of a's head from parent chain
      updateTo(a);
      const A = headW(a), l1 = len(a), l2 = len(bnm), Tg = v3(target), D = Tg.clone().sub(A); let d = D.length();
      d = Math.min(d, (l1+l2)*0.999); const dir = D.normalize();
      const cosA = (l1*l1 + d*d - l2*l2)/(2*l1*d), sinA = Math.sqrt(Math.max(0,1-cosA*cosA));
      const p = v3(pole).sub(dir.clone().multiplyScalar(v3(pole).dot(dir))).normalize();
      const elbow = A.clone().add(dir.clone().multiplyScalar(cosA*l1)).add(p.clone().multiplyScalar(sinA*l1));
      const end = A.clone().add(dir.clone().multiplyScalar(d));
      set(a, elbow.clone().sub(A).toArray(), pole); set(bnm, end.clone().sub(elbow).toArray(), pole);
      if(endDir) set(c, endDir, endRef); else wq[c] = wq[bnm].clone();
    };
    const updateTo = (n) => { for(const m of order){ if(!wq[m]){ const b = M.bones[M.nb[m]]; wq[m] = b.p ? wq[b.p].clone() : new T.Quaternion(); } } commit(); };
    const commit = () => { for(const m of order){ B[M.nb[m]].quaternion.copy(localQ(m)); } B[0].updateMatrixWorld(true); };
    const headW = n => B[M.nb[n]].getWorldPosition(new T.Vector3());
    for(const [n, o] of Object.entries(pose.aim||{})){ updateTo(n); const i = M.nb[n], b = M.bones[i], ch = M.bones.find(x=>x.p===n);
      // aim the bone so its child's head lands on the target
      const d = v3(o.target).sub(headW(n)); set(n, d.toArray(), o.ref); }
    for(const [c, o] of Object.entries(pose.ik||{})){
      const s = c.slice(-2), chain = c.startsWith('hand') ? ['upperarm'+s,'forearm'+s,'hand'+s] : ['thigh'+s,'shin'+s,'foot'+s];
      // target is where the END bone's head should be (wrist / ankle)
      solveChain(chain[0], chain[1], chain[2], o.target, o.pole, o.dir, o.ref);
    }
    updateTo('head');
    for(const [n,deg] of Object.entries(pose.curl||{})){ const i = M.nb[n], b = M.bones[i]; const ax = new T.Vector3(1,0,0).applyQuaternion(F.rq[i]);
      wq[n] = wq[b.p].clone().multiply(new T.Quaternion().setFromAxisAngle(ax, deg*Math.PI/180)); }
    if(pose.curl) commit();
  }

  function scene(el, w, h){
    const R = new T.WebGLRenderer({antialias:true, alpha:true, preserveDrawingBuffer:!!window.FIG3_KEEP}); R.setPixelRatio(Math.min(2, window.devicePixelRatio||1)); R.setSize(w, h);
    R.outputEncoding = T.sRGBEncoding; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
    el.appendChild(R.domElement);
    const S = new T.Scene(), C = new T.PerspectiveCamera(30, w/h, .05, 50);
    S.add(new T.HemisphereLight(0xffffff, 0x6f675d, .55));
    const k = new T.DirectionalLight(0xffffff, 1.7); k.position.set(3,3.5,2.2); S.add(k);
    const r = new T.DirectionalLight(0xffeedd, .55); r.position.set(-3,2,-2.5); S.add(r);
    return {R,S,C};
  }
  window.FIG3 = {setModel, build, apply, colours, scene, lerp, lv, ease, M:()=>M};
})();
