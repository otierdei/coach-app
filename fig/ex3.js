/* Exercise figures v3, exercise library. Needs three.js r149, fig3.js and the model data.
   Authoring is in the body frame (figure stands facing +z, left = +x); a pose can rotate that frame (lying, side plank).
   IK targets are in world metres; pole, dir and ref are body frame unless w:true. */
(function(){
  const T = THREE, F3 = FIG3, D2R = Math.PI/180;
  const V = a => new T.Vector3(a[0],a[1],a[2]);
  const nrm = a => { const l = Math.hypot(a[0],a[1],a[2])||1; return [a[0]/l,a[1]/l,a[2]/l]; };
  // generic lerp over matching numbers, arrays and objects
  function mix(a, b, t){
    if(typeof a === "number") return a + (b - a)*t;
    if(Array.isArray(a)) return a.map((x,i)=>mix(x, b[i], t));
    if(a && typeof a === "object"){ const o = {}; for(const k in a) o[k] = (b && k in b) ? mix(a[k], b[k], t) : a[k]; return o; }
    return t < .5 ? a : b;
  }
  // limb helpers in the body frame. flex: forward from hanging down; abd: sideways out (+ = away from the body)
  function limb(flex, abd, side, kind){
    const s = side === "L" ? 1 : -1, f = flex*D2R, a = (abd||0)*D2R;
    let d = new T.Vector3(0, -Math.cos(f), Math.sin(f)), r = kind === "arm" ? new T.Vector3(0, -Math.sin(f), -Math.cos(f)) : new T.Vector3(0, Math.sin(f), Math.cos(f));
    const q = new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1), s*a); d.applyQuaternion(q); r.applyQuaternion(q);
    return [d.toArray(), r.toArray()];
  }
  const arm = (flex, abd, s) => limb(flex, abd, s, "arm"), leg = (flex, abd, s) => limb(flex, abd, s, "leg");
  // spine pitch (forward bend), side bend (+ = toward the body's left) and twist
  function spineDir(p, sd, tw){
    const q = new T.Quaternion().setFromEuler(new T.Euler(p*D2R, (tw||0)*D2R, -(sd||0)*D2R, "YZX"));
    return [new T.Vector3(0,1,0).applyQuaternion(q).toArray(), new T.Vector3(0,0,1).applyQuaternion(q).toArray()];
  }
  const SP = ["hips","spineA","spineB","spineC","neck","head"];
  function frameQ(fr){
    if(fr == null) return new T.Quaternion();
    if(typeof fr === "number") return new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0), fr*D2R);
    const x = V(nrm(fr.x)), y0 = V(nrm(fr.y)), y = y0.sub(x.clone().multiplyScalar(y0.dot(x))).normalize(), z = new T.Vector3().crossVectors(x, y);
    return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z));
  }
  // authoring pose -> fig3 apply spec
  function resolve(p){
    const Q = frameQ(p.frame), R = a => V(a).applyQuaternion(Q).toArray(), dirs = {};
    const sp = p.spine || [0,0,0,0,0,0], sd = p.side || [0,0,0,0,0,0], tw = p.twist || [0,0,0,0,0,0];
    SP.forEach((n,i)=>{ const [d,r] = spineDir(sp[i], sd[i], tw[i]); dirs[n] = [R(d), R(r)]; });
    if(p.shrug != null){ const M = F3.M(); const sh = Array.isArray(p.shrug) ? p.shrug : [p.shrug, p.shrug];
      [".L",".R"].forEach((s,k)=>{ const b = M.bones[M.nb["clavicle"+s]]; const d = V(b.t).sub(V(b.h)).normalize().applyAxisAngle(new T.Vector3(0,0,1), (k?-1:1)*sh[k]*D2R);
        // clavicles follow the upper spine
        const qs = new T.Quaternion().setFromEuler(new T.Euler(sp[3]*D2R, 0, -(sd[3]||0)*D2R, "YZX"));
        dirs["clavicle"+s] = [R(d.applyQuaternion(qs).toArray()), R(new T.Vector3(0,0,1).applyQuaternion(qs).toArray())]; }); }
    for(const [n,[d,r]] of Object.entries(p.limbs||{})) dirs[n] = [R(d), R(r)];
    for(const [n,[d,r]] of Object.entries(p.wlimbs||{})) dirs[n] = [d, r];
    const ik = {};
    for(const [n,o] of Object.entries(p.ik||{})) ik[n] = {target:o.t, pole: o.w ? o.pole : R(o.pole), dir: o.dir && (o.w ? o.dir : R(o.dir)), ref: o.ref && (o.w ? o.ref : R(o.ref))};
    const aim = {}; for(const [n,o] of Object.entries(p.aim||{})) aim[n] = {target:o.t, ref: o.w ? o.ref : R(o.ref)};
    return {dirs, ik, aim, curl: p.curl, at: p.at};
  }
  const tmp = new T.Vector3();
  function boneW(F, n){ return F.bones[F3.M().nb[n]].getWorldPosition(new T.Vector3()); }
  function tipW(F, n){ const M = F3.M(), i = M.nb[n], b = M.bones[i]; const d = V(b.t).sub(V(b.h)).multiplyScalar(.1); const q = F.bones[i].getWorldQuaternion(new T.Quaternion()); return boneW(F,n).add(d.applyQuaternion(q)); }
  function place(F, p){
    const r = resolve(p), at = r.at || {hips:[0,.94,0]};
    const spec = {hips:[0,0,0], dirs:r.dirs, ik:{}, aim:{}, curl:r.curl};
    let hips;
    if(at.hips) hips = at.hips;
    else { F3.apply(F, spec); const k = at.shoulders ? "upperarm" : "thigh", m = boneW(F,k+".L").add(boneW(F,k+".R")).multiplyScalar(.5), g = at.shoulders || at.hipjoints;
      hips = [g[0]-m.x, g[1]-m.y, g[2]-m.z]; }
    F3.apply(F, {hips, dirs:r.dirs, ik:r.ik, aim:r.aim, curl:r.curl});
  }

  // body numbers measured once from the model
  let K = null;
  function measure(){
    if(K) return K;
    const F = F3.build(); K = {};
    place(F, {at:{hips:[0,1,0]}, limbs:{"thigh.L":leg(0,0,"L"),"thigh.R":leg(0,0,"R"),"shin.L":leg(0,0,"L"),"shin.R":leg(0,0,"R")}});
    const sh = boneW(F,"upperarm.L").add(boneW(F,"upperarm.R")).multiplyScalar(.5), an = boneW(F,"foot.L").add(boneW(F,"foot.R")).multiplyScalar(.5), hj = boneW(F,"thigh.L");
    K.body = [sh.y-an.y, sh.z-an.z]; K.hipOff = [hj.x, hj.y-1, hj.z]; K.hipToSh = sh.y - 1;
    const M = F3.M(), d = (a,b)=>V(M.bones[M.nb[a]].h).distanceTo(V(M.bones[M.nb[b]].h))*.1;
    K.thigh = d("thigh.L","shin.L"); K.shin = d("shin.L","foot.L"); K.ua = d("upperarm.L","forearm.L"); K.fa = d("forearm.L","hand.L");
    const fb = M.bones[M.nb["foot.L"]]; K.ankleH = (fb.h[1] - Math.min(...M.pos.filter((_,i)=>i%3===1)))*.1;
    K.foot = [nrm([0, fb.t[1]-fb.h[1], fb.t[2]-fb.h[2]]), null]; K.foot[1] = nrm([0, K.foot[0][2], -K.foot[0][1]]);
    return K;
  }
  // plank: rigid body turning about the ankles; returns frame pitch and shoulder point for a shoulder height
  function plank(hS, ank){
    const k = measure(), [dy, dz] = k.body; let lo = 20, hi = 89.9;
    for(let i=0;i<40;i++){ const m = (lo+hi)/2, th = m*D2R, y = dy*Math.cos(th) - dz*Math.sin(th); if(y > hS - ank[1]) lo = m; else hi = m; }
    const th = (lo+hi)/2*D2R; return {pitch: th/D2R, sh: [0, hS, ank[2] + dy*Math.sin(th) + dz*Math.cos(th)]};
  }
  const footFlat = (s, yaw) => { const k = measure(), q = new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0), (yaw||0)*D2R*(s==="L"?1:-1));
    return {dir: V(k.foot[0]).applyQuaternion(q).toArray(), ref: V(k.foot[1]).applyQuaternion(q).toArray()}; };
  const stand = (x, z, s, yaw) => Object.assign({t:[x, measure().ankleH, z], pole:[0,0,1]}, footFlat(s, yaw));

  // props: simple matte shapes in stone tones, coloured for the light or dark stage (TH is set by make)
  let TH = {dark:false};
  const col = h => new T.Color(h).convertSRGBToLinear();
  const matP = (h, r) => new T.MeshStandardMaterial({color: col(h), roughness: r==null ? .9 : r, metalness: 0});
  const C_ = k => ({wood:[0xB8AC9C,0x9C8F7E], dark:[0x6B6257,0x7E7468], steel:[0x77716A,0xA49B8F], plate:[0x4A443D,0x6E655A], band:[0x8C2F45,0xE08A9C], door:[0xD9D3CA,0x5A5047], pad:[0xA79C8C,0x857A6C]})[k][TH.dark?1:0];
  const solid = m => { m.userData.solid = true; return m; };
  const PR = {
    floor(S){ return S.userData.floor || {scale:{set(){}}}; },
    box(S, c, s, h){ const m = new T.Mesh(new T.BoxGeometry(s[0], s[1], s[2]), matP(h==null ? C_("wood") : h)); m.position.set(c[0], c[1], c[2]); S.add(m); return solid(m); },
    bar(S, y, z, len){ const m = new T.Mesh(new T.CylinderGeometry(.017,.017,len||1.2,20), matP(C_("steel"),.5)); m.rotation.z = Math.PI/2; m.position.set(0, y, z||0); S.add(m); return m; },
    rail(S, x, y, z0, z1){ const m = new T.Mesh(new T.CylinderGeometry(.02,.02,z1-z0,16), matP(C_("steel"),.5)); m.rotation.x = Math.PI/2; m.position.set(x, y, (z0+z1)/2); S.add(m);
      for(const z of [z0+.05, z1-.05]){ const p = new T.Mesh(new T.CylinderGeometry(.018,.018,y,12), matP(C_("dark"),.7)); p.position.set(x, y/2, z); S.add(p); } return m; },
    // chair: seat centre (x, z), seat height .46, back rest on the side given by back (+1: +z, -1: -z)
    chair(S, x, z, back){ const g = new T.Group(), h = .46, w = .44, d = .42;
      const seat = solid(new T.Mesh(new T.BoxGeometry(w, .035, d), matP(C_("wood")))); seat.position.set(0, h-.0175, 0); g.add(seat);
      for(const [sx, sz] of [[1,1],[1,-1],[-1,1],[-1,-1]]){ const l = new T.Mesh(new T.BoxGeometry(.03, h-.035, .03), matP(C_("dark"))); l.position.set(sx*(w/2-.03), (h-.035)/2, sz*(d/2-.03)); g.add(l); }
      if(back){ const bk = solid(new T.Mesh(new T.BoxGeometry(w, .38, .025), matP(C_("wood")))); bk.position.set(0, h+.21, back*(d/2-.012)); g.add(bk);
        for(const sx of [1,-1]){ const p = new T.Mesh(new T.BoxGeometry(.03, .4, .03), matP(C_("dark"))); p.position.set(sx*(w/2-.03), h+.2, back*(d/2-.015)); g.add(p); } }
      g.position.set(x, 0, z); S.add(g); return g; },
    table(S, x, z, w, d, h){ const g = new T.Group(); const top = solid(new T.Mesh(new T.BoxGeometry(w, .035, d), matP(C_("wood")))); top.position.y = h-.0175; g.add(top);
      for(const [sx, sz] of [[1,1],[1,-1],[-1,1],[-1,-1]]){ const l = new T.Mesh(new T.BoxGeometry(.04, h-.035, .04), matP(C_("dark"))); l.position.set(sx*(w/2-.04), (h-.035)/2, sz*(d/2-.04)); g.add(l); }
      g.position.set(x, 0, z); S.add(g); return g; },
    // door with a band anchor: panel in the x/y plane at z (faces +z or -z), or turned to the y/z plane at x (side:true)
    door(S, pos, anchorY, side){ const g = new T.Group(); const p = solid(new T.Mesh(new T.BoxGeometry(.86, 2.02, .04), matP(C_("door")))); p.position.y = 1.01; g.add(p);
      const fr = matP(C_("dark")); for(const sx of [1,-1]){ const f = new T.Mesh(new T.BoxGeometry(.05, 2.06, .07), fr); f.position.set(sx*.455, 1.03, 0); g.add(f); }
      const a = new T.Mesh(new T.BoxGeometry(.06, .05, .07), matP(C_("plate"))); a.position.set(0, anchorY, 0); g.add(a);
      g.userData.big = true;
      if(side){ g.rotation.y = Math.PI/2; g.position.set(pos, 0, 0); } else g.position.set(0, 0, pos); S.add(g); return g; },
    dumbbell(F, s, axis, kg){
      const M = F3.M(), i = M.nb["hand."+s], b = M.bones[i], g = new T.Group();
      const h = new T.Mesh(new T.CylinderGeometry(.014,.014,.13,14), matP(C_("steel"),.5)); g.add(h);
      for(const y of [-.075,.075]){ const pl = new T.Mesh(new T.CylinderGeometry(.045,.045,.035,24), matP(C_("plate"),.8)); pl.position.y = y; g.add(pl); }
      const rq = F.rq || (F3.apply(F,{hips:[0,0,0],dirs:{}}), F.rq);
      const x0 = new T.Vector3(1,0,0).applyQuaternion(rq[i]), y0 = new T.Vector3(0,1,0).applyQuaternion(rq[i]), z0 = new T.Vector3(0,0,1).applyQuaternion(rq[i]);
      const ax = axis === "dir" ? y0 : x0;
      g.quaternion.setFromUnitVectors(new T.Vector3(0,1,0), ax);
      const off = y0.clone().multiplyScalar(axis === "dir" ? .15 : .055).add(z0.clone().multiplyScalar(axis === "dir" ? .0 : .035));
      g.position.copy(off); F.bones[i].add(g); g.traverse(o=>{ if(o.isMesh) o.castShadow = true; }); return g;
    },
    // resistance band: a tube through points, rebuilt every frame from the pose (after)
    band(S){ const m = new T.Mesh(new T.BufferGeometry(), matP(C_("band"), .75)); m.castShadow = true; S.add(m);
      return { m, set(pts){ const c = new T.CatmullRomCurve3(pts.map(p=>Array.isArray(p) ? V(p) : p), false, "centripetal"); m.geometry.dispose(); m.geometry = new T.TubeGeometry(c, Math.max(24, pts.length*14), .0085, 8, false); } }; }
  };
  // grip point of a hand (between wrist and knuckles)
  const gripW = (F, s) => boneW(F, "hand."+s).add(tipW(F, "hand."+s)).multiplyScalar(.5);

  // ---------- the exercises ----------
  const hangLegs = (k) => ({ "thigh.L":leg(6+k*8,3,"L"), "thigh.R":leg(6+k*8,3,"R"), "shin.L":leg(-14-k*14,3,"L"), "shin.R":leg(-14-k*14,3,"R"), "foot.L":[[0,-.55,.85],[0,.85,.55]], "foot.R":[[0,-.55,.85],[0,.85,.55]] });
  const flatHand = (x, z, yaw) => { const a = (yaw||0)*D2R*(x>0?1:-1); return {t:[x,.056,z], w:true, dir:[Math.sin(a),0,Math.cos(a)], ref:[0,-1,0]}; };
  const armsDown = (fl) => ({ "upperarm.L":arm(fl||4,8,"L"), "upperarm.R":arm(fl||4,8,"R"), "forearm.L":arm((fl||4)+12,6,"L"), "forearm.R":arm((fl||4)+12,6,"R") });

  let EXC = null;
  function defs(){
  const EX = {};
  const SIDE = {x:[0,-1,0], y:[0,0,1]};
  // tempo per exercise in seconds [to key 1, hold, back to key 0, hold]; ecc: the way to key 1 is the lowering (slower)
  const BAR = S => PR.bar(S, 2.3, 0);
  const hangIK = (x, y, z) => ({"hand.L":{t:[x,y,z], pole:[1,-.15,.15], dir:[0,1,.25], ref:[0,-.25,1]}, "hand.R":{t:[-x,y,z], pole:[-1,-.15,.15], dir:[0,1,.25], ref:[0,-.25,1]}});
  EX.pullup = { re:/pull ups/i, en:"Pull ups", de:"Klimmzüge", work:["lats","biceps","traps","forearms","delts"],
    mus:{en:"Lats, biceps, upper back", de:"Latissimus, Bizeps, oberer Rücken"},
    cues:{en:["Start from a dead hang, arms long","Pull the elbows down to the ribs","Chin over the bar, lower in about two seconds"], de:["Aus dem toten Hang starten, Arme lang","Ellbogen Richtung Rippen ziehen","Kinn über die Stange, in etwa zwei Sekunden ablassen"]},
    err:{en:"Kicking the legs or stopping halfway down.", de:"Mit den Beinen Schwung holen oder nur halb ablassen."},
    cam:{p:[2.5,1.5,-4.3], l:[0,1.3,0]}, props(S){ BAR(S); },
    keys:[ {at:{shoulders:[0,1.76,0]}, spine:[-4,-4,-2,0,4,2], shrug:22, limbs:hangLegs(0), curl:{"fingers.L":95,"fingers.R":95}, ik:hangIK(.32,2.235,-.045)},
           {at:{shoulders:[0,2.08,-.07]}, spine:[-14,-12,-10,-6,-8,-16], shrug:4, limbs:hangLegs(1), curl:{"fingers.L":95,"fingers.R":95}, ik:hangIK(.32,2.235,-.045)} ] };

  const chinIK = {"hand.L":{t:[.2,2.235,.045], pole:[.35,-.2,1], dir:[0,1,-.25], ref:[0,.25,-1]}, "hand.R":{t:[-.2,2.235,.045], pole:[-.35,-.2,1], dir:[0,1,-.25], ref:[0,.25,-1]}};
  EX.chinup = { re:/chin ups/i, en:"Chin ups", de:"Chin ups (Untergriff)", work:["biceps","lats","forearms","traps"],
    mus:{en:"Biceps, lats", de:"Bizeps, Latissimus"},
    cues:{en:["Palms face you, hands shoulder wide","Pull the chest to the bar","Lower all the way to straight arms"], de:["Handflächen zu dir, schulterbreit","Brust zur Stange ziehen","Ganz bis zu gestreckten Armen ablassen"]},
    err:{en:"Only the chin reaches forward, the chest stays low.", de:"Nur das Kinn wird nach vorn gestreckt, die Brust bleibt unten."},
    cam:{p:[2.7,1.6,3.5], l:[0,1.38,0]}, props(S){ BAR(S); },
    keys:[0,1].map(k=>({at:{shoulders:k?[0,2.06,.07]:[0,1.76,0]}, spine:k?[-12,-10,-8,-6,-6,-12]:[-4,-4,-2,0,4,2], shrug:k?4:22, limbs:hangLegs(k), curl:{"fingers.L":95,"fingers.R":95}, ik:chinIK})) };

  // band assisted: loop band over the bar, right knee in the loop, shin back
  const bandLegs = k => Object.assign(hangLegs(k), {"thigh.R":leg(14+k*6,3,"R"), "shin.R":leg(-78,3,"R"), "foot.R":[[0,-.2,-.98],[0,.98,-.2]]});
  const kneeBand = (F, S) => { const k = boneW(F,"shin.R"), a = boneW(F,"foot.R"), d = a.clone().sub(k), p = k.clone().add(d.multiplyScalar(.2)), top = 2.317;
    return [[-.07,top,0],[-.06,(top+p.y)/2,(p.z)*.5],[p.x+.05,p.y-.06,p.z],[p.x-.05,p.y-.06,p.z],[.06,(top+p.y)/2,(p.z)*.5],[.07,top,0]].map(x=>x.map?V(x):x); };
  EX.bandpull = { ...EX.pullup, re:/band assisted pull/i, en:"Band assisted pull ups", de:"Klimmzüge mit Band",
    cues:{en:["Band over the bar, one knee in the loop","Pull the elbows down, chin over the bar","Lower slowly, about three seconds"], de:["Band über die Stange, ein Knie in die Schlaufe","Ellbogen nach unten ziehen, Kinn über die Stange","Langsam ablassen, etwa drei Sekunden"]},
    err:{en:"Letting the band throw you up instead of pulling.", de:"Sich vom Band hochschleudern lassen statt selbst zu ziehen."},
    cam:{p:[3.6,1.45,-3.2], l:[0,1.3,0]}, props(S,F){ BAR(S); F.band = PR.band(S); }, after(F){ F.band.set(kneeBand(F)); },
    keys:EX.pullup.keys.map((x,k)=>({...x, limbs:bandLegs(k)})) };
  EX.bandchin = { ...EX.chinup, re:/band assisted chin/i, en:"Band assisted chin ups", de:"Klimmzüge im Untergriff mit Band",
    cues:{en:["Band over the bar, one knee in the loop","Palms face you, pull the chest to the bar","Lower slowly, about three seconds"], de:["Band über die Stange, ein Knie in die Schlaufe","Handflächen zu dir, Brust zur Stange ziehen","Langsam ablassen, etwa drei Sekunden"]},
    err:{en:"Bouncing out of the bottom on the band.", de:"Unten aus dem Band herausfedern."},
    cam:{p:[3.5,1.45,3.2], l:[0,1.3,0]}, props(S,F){ BAR(S); F.band = PR.band(S); }, after(F){ F.band.set(kneeBand(F)); },
    keys:EX.chinup.keys.map((x,k)=>({...x, limbs:bandLegs(k)})) };

  EX.kneeraise = { re:/hanging knee/i, en:"Hanging knee raises", de:"Hängendes Knieheben", work:["abs","obliques","forearms"],
    mus:{en:"Abs, hip flexors, grip", de:"Bauch, Hüftbeuger, Griff"},
    cues:{en:["Hang still, shoulders active","Roll the pelvis up, knees to the chest","Lower without swinging"], de:["Ruhig hängen, Schultern aktiv","Becken einrollen, Knie zur Brust","Ohne Schwung ablassen"]},
    err:{en:"Swinging, so the momentum does the work.", de:"Schwingen, sodass der Schwung die Arbeit macht."},
    cam:{p:[3.5,1.4,1.7], l:[0,1.42,0]}, props(S){ BAR(S); },
    keys:[0,1].map(k=>({at:{shoulders:[0,1.8,-.01]}, spine:k?[-38,-22,-8,0,8,10]:[-2,-2,0,0,4,2], shrug:14, curl:{"fingers.L":95,"fingers.R":95},
      limbs: k ? {"thigh.L":leg(112,4,"L"),"thigh.R":leg(112,4,"R"),"shin.L":leg(10,4,"L"),"shin.R":leg(10,4,"R"),"foot.L":[[0,-.4,.9],[0,.9,.4]],"foot.R":[[0,-.4,.9],[0,.9,.4]]} : hangLegs(0),
      ik:hangIK(.3,2.235,-.045)})) };

  EX.falsegrip = { re:/false grip/i, en:"False grip hang", de:"False Grip Hang", work:["forearms","lats","biceps","traps"],
    mus:{en:"Forearms, wrist flexors, lats", de:"Unterarme, Handgelenkbeuger, Latissimus"},
    cues:{en:["Wrist crease on top of the bar","Pull the shoulders down","Small bend in the elbows, hold"], de:["Handgelenk liegt auf der Stange","Schultern nach unten ziehen","Ellbogen leicht gebeugt, halten"]},
    err:{en:"Hanging in the shoulders with the ears between the arms.", de:"In den Schultern hängen, die Ohren zwischen den Armen."},
    cam:{p:[3.2,1.75,2.0], l:[0,1.55,0]}, props(S){ BAR(S); }, hold:true,
    keys:[0,1].map(k=>({at:{shoulders:k?[0,1.9,-.06]:[0,1.8,-.04]}, spine:k?[-8,-6,-4,-2,-2,-6]:[-2,-2,0,0,4,2], shrug:k?2:20, limbs:hangLegs(0), curl:{"fingers.L":85,"fingers.R":85},
      ik:{"hand.L":{t:[.29,2.315,-.03], pole:[1,-.25,.1], dir:[0,-.1,1], ref:[0,-1,-.1]}, "hand.R":{t:[-.29,2.315,-.03], pole:[-1,-.25,.1], dir:[0,-.1,1], ref:[0,-1,-.1]}}})) };

  // dead hang: full grip, from passive to active shoulders
  EX.deadhang = { re:/dead hang/i, en:"Dead hang", de:"Toter Hang", work:["forearms","lats","traps"],
    mus:{en:"Grip, forearms, shoulders", de:"Griff, Unterarme, Schultern"},
    cues:{en:["Full grip, hands shoulder wide","Pull the shoulders slightly down","Legs still, breathe calmly"], de:["Voller Griff, schulterbreit","Schultern leicht nach unten ziehen","Beine ruhig, ruhig atmen"]},
    err:{en:"Swinging or letting the shoulders sag to the ears.", de:"Schwingen oder die Schultern bis zu den Ohren sinken lassen."},
    cam:{p:[2.6,1.55,3.2], l:[0,1.42,0]}, props(S){ BAR(S); }, hold:true,
    keys:[0,1].map(k=>({at:{shoulders:k?[0,1.80,0]:[0,1.74,0]}, spine:[-3,-3,-2,0,4,2], shrug:k?8:26, limbs:hangLegs(0), curl:{"fingers.L":95,"fingers.R":95}, ik:hangIK(.3,2.235,-.045)})) };

  const dipLegs = {"thigh.L":leg(8,2,"L"),"thigh.R":leg(8,2,"R"),"shin.L":leg(-70,2,"L"),"shin.R":leg(-70,2,"R"),"foot.L":[[0,-.8,-.6],[0,-.6,.8]],"foot.R":[[0,-.8,-.6],[0,-.6,.8]]};
  EX.dips = { re:/^dips/i, en:"Dips", de:"Dips", work:["triceps","pecs","delts"], ecc:true,
    mus:{en:"Triceps, chest, front shoulders", de:"Trizeps, Brust, vordere Schulter"},
    cues:{en:["Lock out on top, shoulders down","Lean slightly forward, elbows back","Down to about 90 degrees, press up"], de:["Oben gestreckt, Schultern tief","Leicht nach vorn lehnen, Ellbogen nach hinten","Bis etwa 90 Grad runter, hochdrücken"]},
    err:{en:"Shoulders roll forward and up at the bottom.", de:"Unten rollen die Schultern nach vorn und oben."},
    cam:{p:[2.9,1.5,2.3], l:[0,1.1,0]}, props(S){ PR.rail(S, .27, 1.12, -.45, .5); PR.rail(S, -.27, 1.12, -.45, .5); },
    keys:[0,1].map(k=>({at:{shoulders:k?[0,1.40,-.1]:[0,1.65,-.03]}, spine:k?[30,28,24,18,6,0]:[8,8,6,4,0,-4], shrug:k?0:-4, limbs:dipLegs, curl:{"fingers.L":70,"fingers.R":70},
      ik:{"hand.L":{t:[.27,1.165,.02], w:true, pole:[.25,0,-1], dir:[.2,-.15,.97], ref:[-.35,-.93,0]}, "hand.R":{t:[-.27,1.165,.02], w:true, pole:[-.25,0,-1], dir:[-.2,-.15,.97], ref:[.35,-.93,0]}}})) };

  // chair dips: hands on the front edge of a chair behind you, knees bent, feet on the floor
  EX.chairdip = { re:/chair dips/i, en:"Chair dips", de:"Dips am Stuhl", work:["triceps","pecs","delts"], ecc:true,
    mus:{en:"Triceps, front shoulders", de:"Trizeps, vordere Schulter"},
    cues:{en:["Hands on the front edge, fingers forward","Hips close to the chair, lower straight down","Upper arms to level, press back up"], de:["Hände an der Vorderkante, Finger nach vorn","Hüfte nah am Stuhl, gerade nach unten","Oberarme bis waagerecht, wieder hochdrücken"]},
    err:{en:"Going too deep, so the shoulders roll forward.", de:"Zu tief gehen, sodass die Schultern nach vorn kippen."},
    cam:{p:[3.5,1.15,1.0], l:[0,.62,0]}, props(S){ PR.chair(S, 0, -.33, -1); },
    keys:[0,1].map(k=>({at:{shoulders:k?[0,.86,.02]:[0,1.07,-.05]}, spine:k?[0,0,0,0,0,-4]:[2,2,0,0,0,-4], shrug:k?2:-2, curl:{"fingers.L":40,"fingers.R":40},
      ik:{"hand.L":{t:[.2,.5,-.15], w:true, pole:[.15,.1,-1], dir:[0,-.3,.95], ref:[0,-.95,-.3]}, "hand.R":{t:[-.2,.5,-.15], w:true, pole:[-.15,.1,-1], dir:[0,-.3,.95], ref:[0,-.95,-.3]},
          "foot.L":stand(.13,.46,"L",4), "foot.R":stand(-.13,.46,"R",4)}})) };

  // floor push ups: body turns about the ankles
  function pushKeys(o){
    const ank = o.ank, top = plank(o.top, ank), bot = plank(o.bot, ank), hz = top.sh[2] + (o.hz||.02);
    const hand = (x, k) => Object.assign(flatHand(x, hz, o.yaw||0), {pole:[x>0?(o.pl||.3):-(o.pl||.3), .1, -1]});
    return [top, bot].map((P,k)=>{
      const sh = P.sh.slice(); if(o.shift) sh[0] = k*o.shift;
      const ik = {"hand.L":hand(o.hx), "hand.R":hand(-o.hx)};
      if(o.straight && k){ ik["hand.R"].pole = [-1, .25, 0]; }
      for(const [s,x] of [["L",o.fx],["R",-o.fx]]) ik["foot."+s] = o.fd ? {t:[x, ank[1], ank[2]], w:true, pole:[0,0,1], dir:nrm(o.fd), ref:nrm(o.fr)} : {t:[x, ank[1], ank[2]], pole:[0,0,1], dir:measure().foot[0], ref:measure().foot[1]};
      return {frame:P.pitch, at:{shoulders:sh}, spine:[0,0,0,0,-8,-14], shrug:k?2:6, ik, curl:{"fingers.L":5,"fingers.R":5}};
    });
  }
  EX.pushup = { re:/^push ups/i, en:"Push ups", de:"Liegestütze", work:["pecs","triceps","delts","abs"], ecc:true,
    mus:{en:"Chest, triceps, front shoulders, core", de:"Brust, Trizeps, vordere Schulter, Rumpf"},
    cues:{en:["Hands under the shoulders, body one line","Elbows about 45 degrees from the body","Chest to a fist above the floor, press away"], de:["Hände unter den Schultern, Körper eine Linie","Ellbogen etwa 45 Grad vom Körper","Brust bis eine Faust über den Boden, wegdrücken"]},
    err:{en:"Hips sag or lead, the body is not one line.", de:"Hüfte hängt durch oder geht voran, der Körper ist keine Linie."},
    cam:{p:[2.7,1.2,1.9], l:[0,.25,-.3]}, props(S){},
    get keys(){ return this._k || (this._k = pushKeys({top:.56, bot:.2, ank:[0,.205,-1.0], hx:.24, fx:.09})); } };

  // band across the upper back, ends under the hands
  const backBand = F => { const hl = gripW(F,"L"), hr = gripW(F,"R"), sl = boneW(F,"upperarm.L"), sr = boneW(F,"upperarm.R"), P = (o, x, y, z) => o.clone().add(new T.Vector3(x, y, z));
    return [hl.clone().setY(.012), P(sl, .075, .01, .0), P(sl, -.05, .07, -.03), P(sr, .05, .07, -.03), P(sr, -.075, .01, .0), hr.clone().setY(.012)]; };
  EX.bandpush = { ...EX.pushup, re:/band resisted push/i, en:"Band resisted push ups", de:"Liegestütze mit Band", keys:EX.pushup.keys,
    cues:{en:["Band across the upper back, ends under the hands","Body one line, elbows about 45 degrees","Lower with control, press hard against the band"], de:["Band über den oberen Rücken, Enden unter den Händen","Körper eine Linie, Ellbogen etwa 45 Grad","Kontrolliert ablassen, kräftig gegen das Band drücken"]},
    err:{en:"Band slides down to the lower back.", de:"Das Band rutscht auf den unteren Rücken."},
    props(S,F){ F.band = PR.band(S); }, after(F){ F.band.set(backBand(F)); } };
  EX.closepush = { ...EX.pushup, re:/close grip push/i, en:"Close grip push ups", de:"Enge Liegestütze", work:["triceps","pecs","delts","abs"],
    mus:{en:"Triceps, chest, front shoulders", de:"Trizeps, Brust, vordere Schulter"},
    cues:{en:["Hands under the shoulders, a bit narrower","Elbows brush the ribs on the way down","Press up to straight arms"], de:["Hände unter den Schultern, etwas enger","Ellbogen streifen beim Absenken die Rippen","Bis zu gestreckten Armen hochdrücken"]},
    err:{en:"Elbows flare out to the sides.", de:"Die Ellbogen gehen zur Seite."},
    get keys(){ return this._k || (this._k = pushKeys({top:.56, bot:.22, ank:[0,.205,-1.0], hx:.15, fx:.09, pl:.08})); } };

  EX.decline = { re:/decline push/i, en:"Decline push ups", de:"Liegestütze mit Füßen erhöht", work:["pecs","delts","triceps"], ecc:true,
    mus:{en:"Upper chest, front shoulders, triceps", de:"Obere Brust, vordere Schulter, Trizeps"},
    cues:{en:["Feet on the chair, hands on the floor","Body straight, no sagging hips","Lower the chest between the hands"], de:["Füße auf dem Stuhl, Hände am Boden","Körper gerade, Hüfte hängt nicht","Brust zwischen die Hände senken"]},
    err:{en:"Head drops first instead of the chest.", de:"Der Kopf sinkt zuerst statt der Brust."},
    cam:{p:[3.0,1.3,1.9], l:[0,.32,-.3]}, props(S){ PR.box(S, [0,.21,-1.02], [.45,.42,.4]); },
    get keys(){ return this._k || (this._k = pushKeys({top:.56, bot:.21, ank:[0,.475,-.92], hx:.25, fx:.09, fd:[0,-.12,-.99], fr:[0,-.99,.12]})); } };

  EX.archer = { re:/archer push/i, en:"Archer push ups", de:"Archer Liegestütze", work:["pecs","triceps","delts"], ecc:true,
    mus:{en:"Chest and triceps, one side at a time", de:"Brust und Trizeps, je eine Seite"},
    cues:{en:["Hands very wide, fingers turned out","Lower toward one hand, the other arm stays straight","Press back to the middle, switch sides"], de:["Hände sehr breit, Finger nach außen","Zu einer Hand absenken, der andere Arm bleibt gestreckt","Zur Mitte zurück, Seite wechseln"]},
    err:{en:"The straight arm bends and takes over.", de:"Der gestreckte Arm beugt sich und übernimmt."},
    cam:{p:[1.9,1.55,2.3], l:[0,.2,-.3]}, props(S){},
    get keys(){ return this._k || (this._k = pushKeys({top:.53, bot:.24, ank:[0,.205,-1.0], hx:.62, fx:.2, yaw:55, shift:.2, straight:true, pl:.2})); } };

  EX.pike = { re:/pike push/i, en:"Pike push ups", de:"Pike Liegestütze", work:["delts","triceps","pecs","traps"], ecc:true,
    mus:{en:"Shoulders, triceps, upper chest", de:"Schultern, Trizeps, obere Brust"},
    cues:{en:["Hips high, feet on the box","Lower the head in front of the hands","Elbows point back, press to straight arms"], de:["Hüfte hoch, Füße auf der Box","Kopf vor den Händen absenken","Ellbogen nach hinten, bis die Arme gestreckt sind"]},
    err:{en:"Hips drop, so it turns into a push up.", de:"Die Hüfte sinkt, es wird ein normaler Liegestütz."},
    cam:{p:[3.55,1.1,-.45], l:[0,.38,-.42]}, props(S){ PR.box(S, [0,.225,-1.0], [.6,.45,.42]); },
    keys:[0,1].map(k=>({at:{shoulders:k?[0,.3,.18]:[0,.54,-.02]}, spine:k?[135,135,138,146,158,168]:[150,150,152,156,168,176], shrug:k?6:14, curl:{"fingers.L":5,"fingers.R":5},
      ik:{"hand.L":{t:[.24,.06,0], w:true, pole:[.22,.1,-1], dir:[.15,0,1], ref:[0,-1,0]}, "hand.R":{t:[-.24,.06,0], w:true, pole:[-.22,.1,-1], dir:[-.15,0,1], ref:[0,-1,0]},
          "foot.L":{t:[.13,.515,-.9], w:true, pole:[0,-.2,1], dir:[0,-.3,-.95], ref:[0,-.95,.3]}, "foot.R":{t:[-.13,.515,-.9], w:true, pole:[0,-.2,1], dir:[0,-.3,-.95], ref:[0,-.95,.3]}}})) };

  // overhead press, right arm, one dumbbell; left hand on the hip
  EX.ohpress = { re:/overhead press/i, en:"Overhead press", de:"Schulterdrücken", work:["delts","triceps","traps"],
    mus:{en:"Shoulders, triceps", de:"Schultern, Trizeps"},
    cues:{en:["Dumbbell at the shoulder, elbow under the wrist","Ribs down, glutes tight","Press straight up, lower to the shoulder"], de:["Kurzhantel an der Schulter, Ellbogen unter dem Handgelenk","Rippen unten, Gesäß fest","Gerade nach oben drücken, bis zur Schulter ablassen"]},
    err:{en:"Arching the lower back to get the weight up.", de:"Ins Hohlkreuz gehen, um das Gewicht hochzubringen."},
    cam:{p:[2.6,1.45,2.6], l:[0,1.2,0]}, props(S,F){ PR.dumbbell(F,"R","x"); },
    keys:[0,1].map(k=>({at:{hips:[0,.94,0]}, spine:[0,0,0,0,-2,-2], shrug:k?18:6, curl:{"fingers.R":85,"fingers.L":20},
      limbs:{"upperarm.R":k?arm(170,8,"R"):arm(22,62,"R"), "forearm.R":k?arm(176,4,"R"):arm(178,-4,"R"), "hand.R":k?[arm(176,4,"R")[0],[-1,0,0]]:[arm(178,-4,"R")[0],[-1,0,0]],
             "upperarm.L":arm(-10,34,"L"),"forearm.L":arm(70,-40,"L")},
      ik:{"foot.L":stand(.13,0,"L",6),"foot.R":stand(-.13,0,"R",6)}})) };

  EX.hollow = { re:/hollow/i, en:"Hollow body hold", de:"Hollow Body Hold", work:["abs","obliques","quads"],
    mus:{en:"Abs, deep core, hip flexors", de:"Bauch, tiefer Rumpf, Hüftbeuger"},
    cues:{en:["Lower back pressed into the floor","Shoulders and legs just off the floor","Start tucked, then reach long"], de:["Unterer Rücken drückt in den Boden","Schultern und Beine knapp über dem Boden","Erst eingerollt, dann lang machen"]},
    err:{en:"The lower back lifts off the floor.", de:"Der untere Rücken hebt vom Boden ab."},
    cam:{p:[2.5,1.3,1.3], l:[0,.12,-.1]}, props(S){}, hold:true,
    keys:[0,1].map(k=>({frame:-90, at:{hips:[0,.032,.05]}, spine:[-2,2,7,12,16,12],
      limbs: k ? {"thigh.L":leg(24,4,"L"),"thigh.R":leg(24,4,"R"),"shin.L":leg(24,4,"L"),"shin.R":leg(24,4,"R"),"foot.L":[[0,-.95,.3],[0,.3,.95]],"foot.R":[[0,-.95,.3],[0,.3,.95]],
                  "upperarm.L":arm(168,10,"L"),"upperarm.R":arm(168,10,"R"),"forearm.L":arm(172,8,"L"),"forearm.R":arm(172,8,"R")}
               : {"thigh.L":leg(100,6,"L"),"thigh.R":leg(100,6,"R"),"shin.L":leg(-15,6,"L"),"shin.R":leg(-15,6,"R"),"foot.L":[[0,-.8,.6],[0,.6,.8]],"foot.R":[[0,-.8,.6],[0,.6,.8]],
                  "upperarm.L":arm(55,12,"L"),"upperarm.R":arm(55,12,"R"),"forearm.L":arm(62,8,"L"),"forearm.R":arm(62,8,"R")}})) };

  // dead bug: on the back, arms up, hips and knees at 90; left arm and right leg reach long
  EX.deadbug = { re:/dead bug/i, en:"Dead bug", de:"Dead Bug", work:["abs","obliques"], tempo:[1.6,.6,1.4,.7],
    mus:{en:"Deep core, abs", de:"Tiefer Rumpf, Bauch"},
    cues:{en:["Arms up, hips and knees at 90 degrees","Lower back stays pressed to the floor","Reach one arm and the opposite leg long, slowly"], de:["Arme hoch, Hüfte und Knie im rechten Winkel","Unterer Rücken bleibt am Boden","Einen Arm und das andere Bein langsam lang machen"]},
    err:{en:"The lower back arches as the leg goes down.", de:"Beim Absenken des Beins geht der untere Rücken ins Hohlkreuz."},
    cam:{p:[2.5,1.25,1.4], l:[0,.2,-.1]}, props(S){},
    keys:[0,1].map(k=>({frame:-90, at:{hips:[0,.05,.05]}, spine:[0,0,1,2,6,8],
      limbs:{"thigh.L":leg(92,6,"L"),"shin.L":leg(2,6,"L"),"foot.L":[[0,-.9,.4],[0,.4,.9]],
             "thigh.R":leg(k?14:92,6,"R"),"shin.R":leg(k?12:2,6,"R"),"foot.R":k?[[0,-.95,.3],[0,.3,.95]]:[[0,-.9,.4],[0,.4,.9]],
             "upperarm.R":arm(92,10,"R"),"forearm.R":arm(94,8,"R"),
             "upperarm.L":arm(k?168:92,10,"L"),"forearm.L":arm(k?172:94,8,"L")}})) };

  // lying leg raises: on the back, hands at the sides, straight legs from low to vertical
  EX.legraise = { re:/lying leg raise/i, en:"Lying leg raises", de:"Beinheben im Liegen", work:["abs","obliques","quads"], tempo:[1.2,.4,2.2,.6],
    mus:{en:"Lower abs, hip flexors", de:"Unterer Bauch, Hüftbeuger"},
    cues:{en:["Hands by the hips, lower back pressed down","Lift straight legs to vertical","Lower slowly, stop just above the floor"], de:["Hände neben der Hüfte, unterer Rücken am Boden","Gestreckte Beine bis senkrecht heben","Langsam ablassen, kurz über dem Boden stoppen"]},
    err:{en:"Dropping the legs fast, the lower back lifts.", de:"Die Beine fallen lassen, der untere Rücken hebt ab."},
    cam:{p:[2.6,1.2,1.0], l:[0,.25,-.05]}, props(S){},
    keys:[0,1].map(k=>({frame:-90, at:{hips:[0,.05,.05]}, spine:[k?-6:0,0,0,1,6,8],
      limbs:{"thigh.L":leg(k?84:12,3,"L"),"thigh.R":leg(k?84:12,3,"R"),"shin.L":leg(k?86:13,3,"L"),"shin.R":leg(k?86:13,3,"R"),"foot.L":[[0,-.9,.4],[0,.4,.9]],"foot.R":[[0,-.9,.4],[0,.4,.9]],
             "upperarm.L":arm(0,14,"L"),"upperarm.R":arm(0,14,"R"),"forearm.L":arm(2,10,"L"),"forearm.R":arm(2,10,"R")}})) };

  EX.bulgarian = { re:/bulgarian/i, en:"Bulgarian split squat", de:"Bulgarian Split Squat", work:["quads","glutes","adductors"], ecc:true,
    mus:{en:"Quads and glutes of the front leg", de:"Oberschenkel vorne und Gesäß, vorderes Bein"},
    cues:{en:["Rear foot laces down on the bench","Drop the back knee straight down","Front knee over the toes, push through the heel"], de:["Hinterer Fuß mit dem Rist auf der Bank","Hinteres Knie gerade nach unten","Vorderes Knie über den Zehen, über die Ferse hoch"]},
    err:{en:"Front heel lifts, the weight shifts onto the toes.", de:"Die vordere Ferse hebt ab, das Gewicht geht auf die Zehen."},
    cam:{p:[3.7,1.3,.9], l:[0,.66,-.1]}, props(S){ PR.box(S, [-.05,.2,-.69], [.5,.4,.36]); },
    keys:[0,1].map(k=>({at:{hips:k?[0,.53,-.13]:[0,.87,-.08]}, spine:k?[18,14,10,6,-4,-6]:[6,4,2,0,0,-2], limbs:armsDown(k?14:4),
      ik:{"foot.L":stand(.12,.33,"L",8), "foot.R":{t:[-.12,.5,-.57], w:true, pole:[0,-1,.25], dir:[0,-.3,-.95], ref:[0,-.95,.3]}}})) };

  // reverse lunge: the right foot steps back, back knee to just above the floor (three keys: the foot lifts on the way)
  const lunge = (u) => { const z = -.66*u, lift = Math.sin(Math.PI*Math.min(1,u*1.15))*.07, hy = .94 - .36*u, hz = -.17*u;
    const back = u < .5 ? Object.assign(stand(-.12, z, "R", 4), {t:[-.12, measure().ankleH + lift, z]}) : {t:[-.12, measure().ankleH + .085*u + lift, z], w:true, pole:[0,-.2,1], dir:nrm([0,-.55-.1*(1-u),.83]), ref:nrm([0,.83,.55+.1*(1-u)])};
    return {at:{hips:[0,hy,hz]}, spine:[6+6*u,4+4*u,2,0,-2,-2], limbs:armsDown(4+8*u), ik:{"foot.L":stand(.12,.12,"L",6), "foot.R":back}}; };
  EX.revlunge = { re:/reverse lunge/i, en:"Reverse lunges", de:"Ausfallschritte rückwärts", work:["quads","glutes","adductors"], ecc:true,
    mus:{en:"Quads and glutes of the front leg", de:"Oberschenkel vorne und Gesäß, vorderes Bein"},
    cues:{en:["Step back long, land on the ball of the foot","Back knee straight down to just above the floor","Push through the front heel back to standing"], de:["Lang nach hinten treten, auf dem Fußballen landen","Hinteres Knie gerade bis knapp über den Boden","Über die vordere Ferse zurück in den Stand"]},
    err:{en:"Front knee caves inward.", de:"Das vordere Knie knickt nach innen."},
    cam:{p:[4.1,1.35,1.1], l:[0,.8,-.2]}, props(S){},
    keys:[lunge(0), lunge(.5), lunge(1)] };

  // step up onto a chair: left foot on the seat, stand up tall, right foot follows
  const stepK = k => ({at:{hips:k?[0,1.38,.36]:[0,.84,.0]}, spine:k?[2,2,0,0,0,-2]:[22,18,12,8,-4,-8], limbs:armsDown(k?4:18),
    ik:{"foot.L":Object.assign(stand(.12,.38,"L",4), {t:[.12,.46+measure().ankleH,.38]}),
        "foot.R":k ? Object.assign(stand(-.12,.32,"R",4), {t:[-.12,.46+measure().ankleH+.05,.28]}) : stand(-.12,-.22,"R",4)}});
  EX.stepup = { re:/step ups/i, en:"Step ups", de:"Step ups", work:["quads","glutes"],
    mus:{en:"Quads and glutes of the leg on the chair", de:"Oberschenkel vorne und Gesäß, Bein auf dem Stuhl"},
    cues:{en:["Whole foot on a sturdy chair","Push through the heel on the chair, stand tall","Lower slowly, no push off the floor foot"], de:["Ganzer Fuß auf einem stabilen Stuhl","Über die Ferse auf dem Stuhl hochdrücken, aufrecht stehen","Langsam ablassen, kein Abdruck vom Fuß am Boden"]},
    err:{en:"Pushing off the bottom foot instead of the top leg.", de:"Vom unteren Fuß abdrücken statt mit dem oberen Bein zu arbeiten."},
    cam:{p:[4.3,1.7,1.5], l:[0,1.0,.2]}, props(S){ PR.chair(S, 0, .45, 1); },
    keys:[stepK(0), stepK(1)] };

  EX.pistol = { re:/pistol/i, en:"Box pistol squat", de:"Pistol Squat auf die Box", work:["quads","glutes"], ecc:true,
    mus:{en:"Quads and glutes, balance", de:"Oberschenkel vorne, Gesäß, Gleichgewicht"},
    cues:{en:["Stand on one leg, the other leg forward","Sit back slowly until you touch the box","Arms forward, stand up without bouncing"], de:["Auf einem Bein, das andere nach vorn","Langsam nach hinten setzen, bis die Box berührt","Arme nach vorn, ohne Schwung aufstehen"]},
    err:{en:"Dropping onto the box instead of touching it.", de:"Auf die Box fallen lassen statt sie nur zu berühren."},
    cam:{p:[3.6,1.25,1.6], l:[0,.66,-.05]}, props(S){ PR.box(S, [0,.21,-.36], [.42,.42,.38]); },
    keys:[0,1].map(k=>({at:{hips:k?[0,.53,-.24]:[0,.92,-.01]}, spine:k?[34,30,24,16,-6,-14]:[4,2,0,0,0,-2],
      limbs:{"thigh.L":leg(k?72:24,2,"L"),"shin.L":leg(k?72:16,2,"L"),"foot.L":[[0,-.2,.98],[0,.98,.2]], "upperarm.L":arm(k?84:30,6,"L"),"upperarm.R":arm(k?84:30,6,"R"),"forearm.L":arm(k?86:38,4,"L"),"forearm.R":arm(k?86:38,4,"R")},
      ik:{"foot.R":stand(-.09,.1,"R",4)}})) };

  // skater squat: on the left leg, right knee goes back down to a cushion, arms forward
  EX.skater = { re:/skater squat/i, en:"Skater squats", de:"Skater Squats", work:["quads","glutes"], ecc:true,
    mus:{en:"Quads and glutes of the standing leg, balance", de:"Oberschenkel vorne und Gesäß des Standbeins, Gleichgewicht"},
    cues:{en:["Stand on one leg, the other knee bent behind you","Lower until the back knee touches the cushion","Arms forward, drive up through the whole foot"], de:["Auf einem Bein, das andere Knie hinten gebeugt","Absenken, bis das hintere Knie das Kissen berührt","Arme nach vorn, über den ganzen Fuß hochdrücken"]},
    err:{en:"The standing knee caves inward.", de:"Das Standbein Knie knickt nach innen."},
    cam:{p:[3.9,1.35,1.6], l:[0,.78,-.1]}, props(S){ PR.box(S, [-.09,.025,-.26], [.3,.05,.26], C_("pad")); },
    keys:[0,1].map(k=>({at:{hips:k?[0,.56,-.12]:[0,.92,0]}, spine:k?[40,34,26,18,-8,-12]:[6,4,2,0,0,-2],
      limbs:{"thigh.R":leg(k?-8:4,3,"R"),"shin.R":leg(k?-86:-80,3,"R"),"foot.R":[[0,-.35,-.94],[0,.94,-.35]],
             "upperarm.L":arm(k?84:20,8,"L"),"upperarm.R":arm(k?84:20,8,"R"),"forearm.L":arm(k?88:30,4,"L"),"forearm.R":arm(k?88:30,4,"R")},
      ik:{"foot.L":stand(.1,.06,"L",4)}})) };

  // cossack squat: wide stance, sit into the left leg, right leg straight with the toes up
  EX.cossack = { re:/cossack/i, en:"Cossack squats", de:"Cossack Squats", work:["adductors","glutes","quads"], ecc:true,
    mus:{en:"Inner thigh, glutes, quads", de:"Adduktoren, Gesäß, Oberschenkel vorne"},
    cues:{en:["Wide stance, toes slightly out","Sit into one leg, heel stays down","Other leg straight, toes point up"], de:["Breiter Stand, Zehen leicht nach außen","In ein Bein setzen, Ferse bleibt unten","Anderes Bein gestreckt, Zehen zeigen nach oben"]},
    err:{en:"The heel of the bent leg lifts.", de:"Die Ferse des gebeugten Beins hebt ab."},
    cam:{p:[.4,1.25,3.6], l:[.1,.6,0]}, props(S){},
    keys:[0,1].map(k=>({at:{hips:k?[.27,.5,-.12]:[0,.86,0]}, spine:k?[30,26,20,12,-6,-10]:[4,2,0,0,0,-2],
      limbs:{"upperarm.L":arm(k?78:6,k?8:12,"L"),"upperarm.R":arm(k?78:6,k?8:12,"R"),"forearm.L":arm(k?84:14,k?4:8,"L"),"forearm.R":arm(k?84:14,k?4:8,"R")},
      ik:{"foot.L":Object.assign(stand(.46,0,"L",22), {pole:[.5,0,1]}),
          "foot.R":k ? {t:[-.46,measure().ankleH+.02,0], w:true, pole:[0,1,0], dir:[0,.75,.66], ref:[0,.66,-.75]} : Object.assign(stand(-.46,0,"R",22), {pole:[-.5,0,1]})}})) };

  // single leg Romanian deadlift: stand on the left leg, dumbbell in the right hand, hinge until the trunk is almost level
  EX.slrdl = { re:/romanian deadlift/i, en:"Single leg Romanian deadlift", de:"Einbeiniges Rumänisches Kreuzheben", work:["hamstrings","glutes","lowerback"], ecc:true, tempo:[2.6,.6,1.2,.7],
    mus:{en:"Hamstrings, glutes, balance", de:"Beinbeuger, Gesäß, Gleichgewicht"},
    cues:{en:["Dumbbell in the hand opposite the standing leg","Hips back, back leg and trunk move as one line","Lower slowly until you feel the hamstring, hips stay square"], de:["Kurzhantel in der Hand gegenüber dem Standbein","Hüfte nach hinten, hinteres Bein und Rumpf als eine Linie","Langsam senken, bis der Beinbeuger zieht, Hüfte bleibt gerade"]},
    err:{en:"Rounding the back or opening the hip to the side.", de:"Den Rücken runden oder die Hüfte zur Seite aufdrehen."},
    cam:{p:[3.9,1.4,1.5], l:[0,.85,-.15]}, props(S,F){ PR.dumbbell(F,"R","x"); },
    keys:[0,1].map(k=>({at:{hips:k?[0,.86,-.1]:[0,.93,0]}, spine:k?[74,74,74,74,70,64]:[2,2,0,0,0,-2], curl:{"fingers.R":85},
      limbs:{"thigh.R":k?leg(-70,4,"R"):leg(-4,3,"R"),"shin.R":k?leg(-74,4,"R"):leg(-40,3,"R"),"foot.R":k?[[0,-.95,-.3],[0,-.3,.95]]:[[0,-.75,.66],[0,.66,.75]],
             "upperarm.R":arm(k?2:4,4,"R"),"forearm.R":arm(k?2:6,3,"R"),"upperarm.L":k?arm(30,30,"L"):arm(6,10,"L"),"forearm.L":k?arm(40,20,"L"):arm(12,8,"L")},
      ik:{"foot.L":Object.assign(stand(.1,.02,"L",6), {pole:[0,0,1]})}})) };

  // band hamstring curl: lying on the stomach, band low on the door anchor behind the feet, right heel curls toward the glutes
  const bhAnk = (F) => boneW(F,"foot.R");
  EX.bandham = { re:/band hamstring curl/i, en:"Band hamstring curl", de:"Beinbeuger Curl mit Band", work:["hamstrings","glutes","calves"], tempo:[1.0,.5,2.2,.7],
    mus:{en:"Hamstrings", de:"Beinbeuger"},
    cues:{en:["Lie on your stomach, band low on the door anchor behind you","Hips stay on the floor, curl the heel toward the glutes","Lower against the band, slower than you curl"], de:["In Bauchlage, Band unten am Türanker hinter dir","Hüfte bleibt am Boden, Ferse Richtung Gesäß ziehen","Gegen das Band ablassen, langsamer als hoch"]},
    err:{en:"The hips lift off the floor.", de:"Die Hüfte hebt vom Boden ab."},
    cam:{p:[4.2,1.6,.6], l:[0,.3,-.35]}, props(S,F){ PR.door(S, -1.45, .08); F.band = PR.band(S); },
    after(F){ const a = bhAnk(F); F.band.set([[0,.08,-1.41],[a.x*.5,.08,(a.z-1.41)/2+.05],[a.x,a.y-.01,a.z-.04]]); },
    keys:[0,1].map(k=>({frame:90, at:{hips:[0,.17,0]}, spine:[-8,-12,-10,-6,-14,-20],
      limbs:{"thigh.L":leg(-2,5,"L"),"shin.L":leg(-2,5,"L"),"foot.L":[[0,-.25,-.97],[0,.97,-.25]],
             "thigh.R":leg(-3,5,"R"),"shin.R":k?leg(-100,5,"R"):leg(-6,5,"R"),"foot.R":k?[[0,.6,-.8],[0,.8,.6]]:[[0,-.2,-.98],[0,.98,-.2]],
             "upperarm.L":arm(-6,14,"L"),"upperarm.R":arm(-6,14,"R"),"forearm.L":arm(-8,10,"L"),"forearm.R":arm(-8,10,"R")}})) };

  EX.copenhagen = { re:/copenhagen/i, en:"Copenhagen plank, knee version", de:"Copenhagen Plank, Knie Variante", work:["adductors","obliques","abs"],
    mus:{en:"Inner thigh, side core", de:"Adduktoren, seitlicher Rumpf"},
    cues:{en:["Forearm under the shoulder, top knee on the bench","Lift the hips into one line","Bottom leg comes up to the bench, hold"], de:["Unterarm unter der Schulter, oberes Knie auf der Bank","Hüfte heben bis zur Linie","Unteres Bein zur Bank heben, halten"]},
    err:{en:"The hips sag back toward the floor.", de:"Die Hüfte sinkt wieder Richtung Boden."},
    cam:{p:[-3.1,1.1,-.1], l:[0,.32,-.5]}, props(S){ PR.table(S, .02, -.98, .5, .34, .49); },
    keys:[0,1].map(k=>({frame:SIDE, at:{shoulders:[0, .5, 0]}, spine:[0,0,0,0,0,0], side:k?[0,0,0,0,0,0]:[-16,-12,-6,0,4,4], shrug:0, aim:{"thigh.R":{t:[0,.585,-.93], ref:[0,0,1]}},
      limbs:{"upperarm.R":arm(20,4,"R"),"forearm.R":arm(60,0,"R"),
             "thigh.R":leg(4,-2,"R"),"shin.R":leg(4,-2,"R"),"foot.R":[[0,-.9,.4],[0,.4,.9]],
             "thigh.L":leg(4, k?2:24,"L"),"shin.L":leg(4,k?-4:-6,"L"),"foot.L":[[0,-.9,.4],[0,.4,.9]]},
      ik:{"hand.L":{t:[-.27,.061,.02], w:true, pole:[.4,-1,0], dir:[-1,0,0], ref:[0,-1,0]}}})) };

  // band adductor pull: standing side on to the door, band at ankle height on the left ankle, pull the left leg across in front
  EX.bandadd = { re:/adductor/i, en:"Band adductor pull", de:"Adduktorenzug mit Band", work:["adductors","obliques"],
    mus:{en:"Inner thigh, groin", de:"Adduktoren, Leiste"},
    cues:{en:["Side on to the door, band around the near ankle","Stand tall, hand on the wall if needed","Pull the leg across in front, back slowly"], de:["Seitlich zur Tür, Band um den Knöchel auf der Türseite","Aufrecht stehen, Hand bei Bedarf an der Wand","Bein vor dem Standbein vorbeiziehen, langsam zurück"]},
    err:{en:"Leaning the trunk instead of moving the leg.", de:"Mit dem Oberkörper kippen statt das Bein zu bewegen."},
    cam:{p:[.6,1.25,3.6], l:[.2,.75,0]}, props(S,F){ PR.door(S, 1.05, .12, true); F.band = PR.band(S); },
    after(F){ const a = boneW(F,"foot.L"); F.band.set([[1.01,.12,0],[(a.x+1.01)/2,(a.y+.12)/2,a.z*.5],[a.x+.02,a.y+.005,a.z]]); },
    keys:[0,1].map(k=>({at:{hips:[k?.02:-.02,.94,0]}, spine:[0,0,0,0,0,-2], side:[k?2:-2,0,0,0,0,0],
      limbs:{"thigh.L":leg(k?16:4,k?-16:24,"L"),"shin.L":leg(k?18:4,k?-16:24,"L"),"foot.L":[[0,-.5,.86],[0,.86,.5]],
             "upperarm.L":arm(8,34,"L"),"forearm.L":arm(20,30,"L"),"upperarm.R":arm(-8,30,"R"),"forearm.R":arm(70,-40,"R")},
      ik:{"foot.R":stand(-.1,0,"R",6)}})) };

  // broad jump: a sequence, not a back and forth
  const bj = (z, hy, sp, arms, kf, kfL, air) => ({at:{hips:[0, hy, z]}, spine:sp, limbs:{"upperarm.L":arm(arms,10,"L"),"upperarm.R":arm(arms,10,"R"),"forearm.L":arm(arms+14,6,"L"),"forearm.R":arm(arms+14,6,"R")},
    ik:{"foot.L":Object.assign(stand(.12, z+kf, "L", 6), air?{t:[.12, air, z+kf]}:{}), "foot.R":Object.assign(stand(-.12, z+kfL, "R", 6), air?{t:[-.12, air, z+kfL]}:{})}});
  EX.broad = { re:/broad jump/i, en:"Broad jumps", de:"Weitsprung aus dem Stand", work:["glutes","quads","hamstrings","calves"],
    mus:{en:"Glutes, quads, calves: power", de:"Gesäß, Oberschenkel, Waden: Explosivkraft"},
    cues:{en:["Swing the arms back and load the hips","Jump forward and up, arms drive through","Land soft with bent knees, stick it"], de:["Arme nach hinten, Hüfte laden","Nach vorn oben springen, Arme schwingen mit","Weich mit gebeugten Knien landen, stehen bleiben"]},
    err:{en:"Landing with straight legs or knees caving in.", de:"Mit gestreckten Beinen landen oder die Knie knicken nach innen."},
    cam:{p:[4.7,1.15,.95], l:[0,.7,.65]}, props(S){ PR.floor(S).scale.set(1.4,1.4,1.4); }, seq:true,
    keys:[ bj(0,.93,[2,2,0,0,0,0],6,0,0), bj(-.02,.62,[42,36,26,18,-12,-10],-40,.05,.05), bj(.3,.98,[40,34,26,18,-6,-8],150,-.18,-.18,0.072),
           bj(.75,1.14,[18,14,8,4,0,-4],100,.1,.1,.62), bj(1.3,.64,[38,32,22,14,-10,-10],75,.12,.12), bj(1.3,.92,[4,2,0,0,0,0],8,.0,.0) ],
    times:[0,.22,.38,.55,.74,1] };

  // squat jump: from a half squat straight up, land soft back into it
  const sj = (k) => ({at:{hips:k?[0,1.07,0]:[0,.6,-.14]}, spine:k?[0,0,0,0,-2,-4]:[36,30,22,14,-10,-12],
    limbs:{"upperarm.L":arm(k?160:-30,10,"L"),"upperarm.R":arm(k?160:-30,10,"R"),"forearm.L":arm(k?168:-20,6,"L"),"forearm.R":arm(k?168:-20,6,"R")},
    ik:{"foot.L":k?{t:[.12,.2,.04], w:true, pole:[0,0,1], dir:[0,-.75,.66], ref:[0,.66,.75]}:stand(.12,0,"L",8), "foot.R":k?{t:[-.12,.2,.04], w:true, pole:[0,0,1], dir:[0,-.75,.66], ref:[0,.66,.75]}:stand(-.12,0,"R",8)}});
  EX.squatjump = { re:/squat jumps/i, en:"Squat jumps", de:"Strecksprünge", work:["glutes","quads","calves"], tempo:[.42,.06,.5,1.1],
    mus:{en:"Glutes, quads, calves: power", de:"Gesäß, Oberschenkel, Waden: Explosivkraft"},
    cues:{en:["Half squat, arms back","Jump straight up, arms drive overhead","Land soft and quiet back into the squat"], de:["Halbe Kniebeuge, Arme hinten","Gerade nach oben springen, Arme schwingen hoch","Weich und leise zurück in die Kniebeuge landen"]},
    err:{en:"Stiff, loud landing on the heels.", de:"Steife, laute Landung auf den Fersen."},
    cam:{p:[3.9,1.45,2.5], l:[0,1.0,0]}, props(S){}, keys:[sj(0), sj(1)] };

  // curls: standing, both arms
  const curlPose = (fl, hammer) => { const fa = s => arm(fl, 2, s), pn = s => hammer ? [s==="L"?-1:1, 0, 0] : [0, Math.sin(fl*D2R), Math.cos(fl*D2R)];
    return {at:{hips:[0,.94,0]}, spine:[0,0,0,0,0,0], curl:{"fingers.L":85,"fingers.R":85},
      limbs:{"upperarm.L":arm(4,6,"L"),"upperarm.R":arm(4,6,"R"),"forearm.L":fa("L"),"forearm.R":fa("R"),"hand.L":[fa("L")[0], pn("L")],"hand.R":[fa("R")[0], pn("R")]},
      ik:{"foot.L":stand(.12,0,"L",6),"foot.R":stand(-.12,0,"R",6)}}; };
  EX.hammer = { re:/hammer curl/i, en:"Hammer curls", de:"Hammer Curls", work:["biceps","forearms"],
    mus:{en:"Biceps, forearm (brachioradialis)", de:"Bizeps, Unterarm (Oberarmspeichenmuskel)"},
    cues:{en:["Palms face each other","Elbows stay at the sides","Curl up, lower in two to three seconds"], de:["Handflächen zeigen zueinander","Ellbogen bleiben am Körper","Hochbeugen, in zwei bis drei Sekunden ablassen"]},
    err:{en:"Swinging the weight up with the back.", de:"Das Gewicht mit dem Rücken hochschwingen."},
    cam:{p:[2.6,1.35,2.4], l:[0,1.0,0]}, props(S,F){ PR.dumbbell(F,"L","x"); PR.dumbbell(F,"R","x"); },
    keys:[curlPose(4,true), curlPose(138,true)] };
  EX.curl = { re:/db curls|dumbbell curl|^curls/i, en:"Dumbbell curls", de:"Bizeps Curls", work:["biceps","forearms"],
    mus:{en:"Biceps", de:"Bizeps"},
    cues:{en:["Palms face forward","Elbows stay at the sides","Squeeze on top, lower slowly"], de:["Handflächen zeigen nach vorn","Ellbogen bleiben am Körper","Oben anspannen, langsam ablassen"]},
    err:{en:"Elbows drift forward to finish the rep.", de:"Die Ellbogen wandern nach vorn, um die Wiederholung zu schaffen."},
    cam:{p:[2.6,1.35,2.4], l:[0,1.0,0]}, props(S,F){ PR.dumbbell(F,"L","x"); PR.dumbbell(F,"R","x"); },
    keys:[curlPose(4,false), curlPose(140,false)] };
  // band curls: standing on the middle of the band, one end in each hand
  const floorBand = F => { const hl = gripW(F,"L"), hr = gripW(F,"R");
    return [hl, new T.Vector3(hl.x*.9, .3, (hl.z+.04)/2), new T.Vector3(.07,.012,.06), new T.Vector3(-.07,.012,.06), new T.Vector3(hr.x*.9, .3, (hr.z+.04)/2), hr]; };
  EX.bandhammer = { ...EX.hammer, re:/band hammer/i, en:"Band hammer curls", de:"Hammer Curls mit Band",
    cues:{en:["Stand on the band, palms face each other","Elbows stay at the sides","Curl up, lower against the band in two seconds"], de:["Auf dem Band stehen, Handflächen zueinander","Ellbogen bleiben am Körper","Hochbeugen, in zwei Sekunden gegen das Band ablassen"]},
    err:{en:"Letting the band snap the hands down.", de:"Die Hände vom Band nach unten reißen lassen."},
    props(S,F){ F.band = PR.band(S); }, after(F){ F.band.set(floorBand(F)); } };
  EX.bandcurl = { ...EX.curl, re:/band curls/i, en:"Band curls", de:"Curls mit Band",
    cues:{en:["Stand on the band, palms up","Elbows stay at the sides","Squeeze on top, lower against the band in two seconds"], de:["Auf dem Band stehen, Handflächen nach oben","Ellbogen bleiben am Körper","Oben anspannen, in zwei Sekunden gegen das Band ablassen"]},
    err:{en:"Leaning back to finish the rep.", de:"Sich nach hinten lehnen, um die Wiederholung zu schaffen."},
    props(S,F){ F.band = PR.band(S); }, after(F){ F.band.set(floorBand(F)); } };

  EX.ohtri = { re:/overhead triceps/i, en:"Overhead triceps extension", de:"Trizepsdrücken über Kopf", work:["triceps"], ecc:true,
    mus:{en:"Triceps, long head", de:"Trizeps, langer Kopf"},
    cues:{en:["Hold one dumbbell with both hands overhead","Elbows point up, lower behind the head","Stretch at the bottom, press up"], de:["Eine Kurzhantel mit beiden Händen über dem Kopf","Ellbogen zeigen nach oben, hinter den Kopf senken","Unten dehnen, hochdrücken"]},
    err:{en:"Elbows flare wide and the back arches.", de:"Die Ellbogen gehen weit auseinander, der Rücken geht ins Hohlkreuz."},
    cam:{p:[3.2,1.6,1.8], l:[0,1.22,0]}, props(S,F){ F.db = PR.dumbbell(F,"L","x"); F.mesh.add(F.db); },
    after(F){ const a = boneW(F,"hand.L").add(boneW(F,"hand.R")).multiplyScalar(.5); const db = F.db; db.parent.updateMatrixWorld(true);
      const inv = new T.Matrix4().copy(db.parent.matrixWorld).invert(); db.position.copy(a.add(new T.Vector3(0,-.075,0)).applyMatrix4(inv)); db.quaternion.identity(); },
    keys:[0,1].map(k=>({at:{hips:[0,.94,0]}, spine:[-2,-2,-2,-2,4,6], shrug:k?16:22, curl:{"fingers.L":70,"fingers.R":70},
      ik:{"hand.L":{t:k?[.035,1.62,-.2]:[.035,1.92,.02], w:true, pole:[.35,1,.6], dir:k?[0,-.3,-.95]:[0,1,.05], ref:[-1,0,0]}, "hand.R":{t:k?[-.035,1.62,-.2]:[-.035,1.92,.02], w:true, pole:[-.35,1,.6], dir:k?[0,-.3,-.95]:[0,1,.05], ref:[1,0,0]},
          "foot.L":stand(.12,0,"L",6),"foot.R":stand(-.12,0,"R",6)}})) };

  // band triceps pushdown: band high on the door in front, elbows pinned at the sides
  const doorHands = (F, ay, az) => { const hl = gripW(F,"L"), hr = gripW(F,"R"), A = new T.Vector3(0, ay, az - .04);
    return [hl, hl.clone().lerp(A,.5).add(new T.Vector3(-.02,0,0)), A, hr.clone().lerp(A,.5).add(new T.Vector3(.02,0,0)), hr]; };
  EX.pushdown = { re:/triceps pushdown/i, en:"Band triceps pushdown", de:"Trizepsdrücken mit Band", work:["triceps"],
    mus:{en:"Triceps", de:"Trizeps"},
    cues:{en:["Band high on the door anchor, step back a little","Elbows stay pinned at your sides","Press down to straight arms, two seconds back up"], de:["Band oben am Türanker, etwas zurücktreten","Ellbogen bleiben fest am Körper","Bis zu gestreckten Armen drücken, zwei Sekunden zurück"]},
    err:{en:"The elbows move forward and the shoulders help.", de:"Die Ellbogen wandern nach vorn, die Schultern helfen mit."},
    cam:{p:[2.9,1.45,-1.6], l:[0,1.15,.3]}, props(S,F){ PR.door(S, .95, 1.95); F.band = PR.band(S); }, after(F){ F.band.set(doorHands(F, 1.95, .95)); },
    keys:[0,1].map(k=>({at:{hips:[0,.93,0]}, spine:[10,8,6,4,0,-4], curl:{"fingers.L":85,"fingers.R":85},
      limbs:{"upperarm.L":arm(6,10,"L"),"upperarm.R":arm(6,10,"R"),"forearm.L":arm(k?14:96,4,"L"),"forearm.R":arm(k?14:96,4,"R"),"hand.L":[arm(k?14:96,4,"L")[0],[-1,0,0]],"hand.R":[arm(k?14:96,4,"R")[0],[1,0,0]]},
      ik:{"foot.L":stand(.12,-.02,"L",6),"foot.R":stand(-.12,-.02,"R",6)}})) };

  // band rows: band at chest height on the door in front, pull the elbows back
  EX.bandrow = { re:/band rows/i, en:"Band rows", de:"Rudern mit Band", work:["lats","traps","biceps","delts"],
    mus:{en:"Upper back, lats, rear shoulders", de:"Oberer Rücken, Latissimus, hintere Schulter"},
    cues:{en:["Band at chest height, step back until it is tight","Pull the elbows back past the ribs","Squeeze the shoulder blades, two seconds back"], de:["Band auf Brusthöhe, zurücktreten bis es spannt","Ellbogen nach hinten an den Rippen vorbei ziehen","Schulterblätter zusammen, zwei Sekunden zurück"]},
    err:{en:"Shrugging the shoulders toward the ears.", de:"Die Schultern Richtung Ohren ziehen."},
    cam:{p:[3.0,1.45,-1.4], l:[0,1.12,.35]}, props(S,F){ PR.door(S, 1.05, 1.18); F.band = PR.band(S); }, after(F){ F.band.set(doorHands(F, 1.18, 1.05)); },
    keys:[0,1].map(k=>({at:{hips:[0,.92,0]}, spine:[4,2,0,0,0,-2], shrug:k?2:14, curl:{"fingers.L":85,"fingers.R":85},
      limbs:{"upperarm.L":k?arm(-28,14,"L"):arm(78,8,"L"),"upperarm.R":k?arm(-28,14,"R"):arm(78,8,"R"),"forearm.L":arm(k?84:82,2,"L"),"forearm.R":arm(k?84:82,2,"R"),"hand.L":[arm(k?84:82,2,"L")[0],[-1,0,0]],"hand.R":[arm(k?84:82,2,"R")[0],[1,0,0]]},
      ik:{"foot.L":stand(.13,.04,"L",6),"foot.R":stand(-.13,-.06,"R",6)}})) };

  // inverted rows under a table: heels on the floor, body straight, chest to the table edge
  const invK = k => { const ank = [0, .05, .62], hS = k ? .5 : .27, k0 = measure(), [dy, dz] = k0.body; let lo = -89, hi = -20;
    for(let i=0;i<40;i++){ const m = (lo+hi)/2, th = m*D2R, y = dy*Math.cos(th) - dz*Math.sin(th); if(y > hS - ank[1]) hi = m; else lo = m; }
    const th = (lo+hi)/2*D2R, sh = [0, hS, ank[2] + dy*Math.sin(th) + dz*Math.cos(th)];
    return {frame:th/D2R, at:{shoulders:sh}, spine:[0,0,0,0,-4,-8], shrug:k?2:16, curl:{"fingers.L":20,"fingers.R":20},
      ik:{"hand.L":{t:[.27,.66,-.4], w:true, pole:[.6,-.3,.4], dir:[0,1,-.08], ref:[0,.08,1]}, "hand.R":{t:[-.27,.66,-.4], w:true, pole:[-.6,-.3,.4], dir:[0,1,-.08], ref:[0,.08,1]},
          "foot.L":{t:[.1,ank[1],ank[2]], w:true, pole:[0,1,0], dir:[0,.95,.3], ref:[0,-.3,.95]}, "foot.R":{t:[-.1,ank[1],ank[2]], w:true, pole:[0,1,0], dir:[0,.95,.3], ref:[0,-.3,.95]}}}; };
  EX.invrow = { re:/inverted row/i, en:"Inverted rows", de:"Rudern unter dem Tisch", work:["lats","traps","biceps","delts"],
    mus:{en:"Upper back, lats, biceps", de:"Oberer Rücken, Latissimus, Bizeps"},
    cues:{en:["Under a sturdy table, grip the edge shoulder wide","Heels on the floor, body straight like a plank","Pull the chest to the edge, lower with control"], de:["Unter einem stabilen Tisch, Kante schulterbreit greifen","Fersen am Boden, Körper gerade wie ein Brett","Brust zur Kante ziehen, kontrolliert ablassen"]},
    err:{en:"Hips sag and only the arms move.", de:"Die Hüfte hängt durch und nur die Arme arbeiten."},
    cam:{p:[3.2,1.05,.95], l:[0,.4,-.2]}, props(S){ PR.table(S, 0, -.78, 1.1, .7, .75); },
    keys:[invK(0), invK(1)] };

  // dumbbell floor press, right arm: on the back, knees bent, upper arm to the floor and up to straight
  EX.floorpress = { re:/floor press/i, en:"Dumbbell floor press", de:"KH Bodendrücken", work:["pecs","triceps","delts"], ecc:true, tempo:[1.8,.4,1.0,.7],
    mus:{en:"Chest, triceps, front shoulders", de:"Brust, Trizeps, vordere Schulter"},
    cues:{en:["On your back, knees bent, feet flat","Elbow about 45 degrees from the body","Lower until the upper arm touches the floor, press up"], de:["Auf dem Rücken, Knie gebeugt, Füße flach","Ellbogen etwa 45 Grad vom Körper","Absenken, bis der Oberarm den Boden berührt, hochdrücken"]},
    err:{en:"Dropping the elbow onto the floor without control.", de:"Den Ellbogen unkontrolliert auf den Boden fallen lassen."},
    cam:{p:[-2.7,1.25,.7], l:[0,.25,-.1]}, props(S,F){ PR.dumbbell(F,"R","x"); },
    keys:[0,1].map(k=>({frame:-90, at:{hips:[0,.06,0]}, spine:[0,0,0,0,6,10], curl:{"fingers.R":85},
      limbs:{"upperarm.R":k?arm(6,50,"R"):arm(90,4,"R"),"forearm.R":k?arm(88,-6,"R"):arm(90,2,"R"),"hand.R":[k?arm(88,-6,"R")[0]:arm(90,2,"R")[0],[0,-1,0]],
             "upperarm.L":arm(10,40,"L"),"forearm.L":arm(14,36,"L")},
      ik:{"foot.L":{t:[.13,measure().ankleH,.5], w:true, pole:[0,1,.2], dir:measure().foot[0], ref:measure().foot[1]}, "foot.R":{t:[-.13,measure().ankleH,.5], w:true, pole:[0,1,.2], dir:measure().foot[0], ref:measure().foot[1]}}})) };

  EX.warmup = { re:/warm up/i, en:"Warm up + mobility", de:"Aufwärmen + Mobilität", work:["quads","glutes","delts"],
    mus:{en:"Whole body", de:"Ganzer Körper"},
    cues:{en:["Sink into a deep squat, chest up","Stand and reach both arms overhead","Breathe, five slow rounds"], de:["Tief in die Hocke, Brust aufrecht","Aufstehen und beide Arme nach oben strecken","Ruhig atmen, fünf langsame Runden"]},
    err:{en:"Rushing through it instead of moving slowly.", de:"Durchhetzen statt langsam zu bewegen."},
    cam:{p:[3.3,1.4,2.2], l:[0,.95,0]}, props(S){},
    keys:[0,1].map(k=>({at:{hips:k?[0,.95,0]:[0,.46,-.16]}, spine:k?[-4,-4,-4,-4,-6,-10]:[34,26,18,10,-10,-14], shrug:k?20:6,
      limbs:{"upperarm.L":arm(k?172:88,k?14:8,"L"),"upperarm.R":arm(k?172:88,k?14:8,"R"),"forearm.L":arm(k?176:92,8,"L"),"forearm.R":arm(k?176:92,8,"R")},
      ik:{"foot.L":stand(.16,.02,"L",16),"foot.R":stand(-.16,.02,"R",16)}})) };

  return EX;
  }
  const ex = () => EXC || (EXC = defs());
  // ---------- rendering ----------
  // smootherstep: starts and ends at rest, so every turn point has a calm pause instead of a jolt
  const ease = t => t*t*t*(t*(t*6-15)+10);
  function poseAt(E, t){
    const keys = E.keys;
    if(E.seq){ const ts = E.times; let i = 0; while(i < ts.length-2 && t > ts[i+1]) i++;
      const u = (t - ts[i])/(ts[i+1]-ts[i]); return mix(keys[i], keys[i+1], Math.min(1, Math.max(0, u))); }
    if(keys.length === 2) return mix(keys[0], keys[1], t);
    const n = keys.length - 1, x = Math.min(n - 1e-6, Math.max(0, t*n)), i = Math.floor(x); return mix(keys[i], keys[i+1], x - i);
  }
  // seconds per phase [to key 1, hold, back, hold]; the lowering is the slower half
  function tempoOf(E){ return E.tempo || (E.hold ? [1.5,2.2,1.3,.9] : E.ecc ? [1.7,.45,1.0,.8] : [1.0,.45,1.7,.75]); }
  function period(E){ return E.seq ? 3.8 : tempoOf(E).reduce((a,b)=>a+b, 0); }
  // one cycle: seconds -> movement value 0..1
  function cycle(E, sec){
    const P = period(E); let s = ((sec % P) + P) % P;
    if(E.seq){ const run = P*.8; return s < run ? (s/run)*.15 + ease(s/run)*.85 : 1; }
    const [a, b, c] = tempoOf(E);
    if(s < a) return ease(s/a); s -= a; if(s < b) return 1; s -= b; if(s < c) return 1 - ease(s/c); return 0;
  }
  // points of the figure over one cycle plus the props (not the door, which may run out of the frame)
  function fit(E, F, S, C, disc, catcher){
    const dir = V(E.cam.p).sub(V(E.cam.l)).normalize(), pts = [], v = new T.Vector3(), mesh = F.mesh, n = mesh.geometry.attributes.position.count;
    for(const t of [0, .25, .5, .75, 1]){ place(F, poseAt(E, t)); E.after && E.after(F); S.updateMatrixWorld(true);
      for(let i=0;i<n;i+=5){ v.fromBufferAttribute(mesh.geometry.attributes.position, i); mesh.boneTransform(i, v); pts.push(v.clone().applyMatrix4(mesh.matrixWorld)); }
      S.traverse(o=>{ if(!o.isMesh || o === mesh || o === disc || o === catcher || o.userData.big) return; let big = false; o.traverseAncestors(a=>{ if(a.userData && a.userData.big) big = true; }); if(big) return;
        const b = new T.Box3().setFromObject(o); if(b.isEmpty()) return; for(const x of [b.min.x,b.max.x]) for(const y of [b.min.y,b.max.y]) for(const z of [b.min.z,b.max.z]) pts.push(new T.Vector3(x,y,z)); }); }
    const bb = new T.Box3().setFromPoints(pts), look = bb.getCenter(new T.Vector3());
    if(E.cam.dy) look.y += E.cam.dy;
    C.position.copy(look.clone().add(dir.clone().multiplyScalar(4))); C.lookAt(look); C.updateMatrixWorld(true);
    const e = C.matrixWorld.elements, right = new T.Vector3(e[0],e[1],e[2]), up = new T.Vector3(e[4],e[5],e[6]);
    const tv = Math.tan(C.fov*D2R/2), th = tv*C.aspect, m = E.cam.m || .8;
    let d = 1.2; for(const p of pts){ const r = p.clone().sub(look), a = r.dot(dir); d = Math.max(d, a + Math.abs(r.dot(right))/(m*th), a + Math.abs(r.dot(up))/(m*tv)); }
    return {look, base: dir.multiplyScalar(d)};
  }
  // opts: w, h, dark (stage colours), floor (CSS colour of the floor disc)
  function make(el, id, opts){
    const E = ex()[id]; if(!E) return null; opts = opts || {};
    TH = {dark: !!opts.dark};
    const w = opts.w || el.clientWidth || 320, h = opts.h || Math.round(w*.85);
    const {R,S,C} = F3.scene(el, w, h, TH.dark), F = F3.build();
    F.g.setAttribute("color", new T.BufferAttribute(F3.colours(E.work, TH.dark), 3)); S.add(F.mesh);
    // floor: one flat disc in a tone just off the stage, the soft shadow lies on top of it
    let fc; try{ fc = opts.floor ? new T.Color(opts.floor) : null; }catch(e){ fc = null; }
    const disc = new T.Mesh(new T.CircleGeometry(1.9, 72), new T.MeshBasicMaterial({color: (fc || new T.Color(TH.dark ? 0x3A3027 : 0xE1DED8)).convertSRGBToLinear()}));
    disc.rotation.x = -Math.PI/2; disc.position.y = -.002; S.add(disc); S.userData.floor = disc;
    const catcher = new T.Mesh(new T.PlaneGeometry(8, 8), new T.ShadowMaterial({opacity: TH.dark ? .42 : .2})); catcher.rotation.x = -Math.PI/2; catcher.receiveShadow = true; S.add(catcher);
    E.props && E.props(S, F);
    S.traverse(o=>{ if(o.isMesh && o !== disc && o !== catcher && o !== F.mesh) o.castShadow = true; });
    // framing (19.11.2026): the camera keeps its direction but is centred and distanced so the figure and the props
    // stay inside the frame over the whole movement (before, heads, feet or hands were cut off in some figures)
    const {look, base} = fit(E, F, S, C, disc, catcher);
    const draw = (t, sway) => { place(F, poseAt(E, t)); E.after && E.after(F); const q = new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0), (sway||0)); C.position.copy(look.clone().add(base.clone().applyQuaternion(q))); C.lookAt(look); R.render(S, C); };
    let raf = 0, t0 = 0, run = false; const per = period(E);
    // the camera drifts slowly (one swing over two cycles), small enough not to distract
    const loop = now => { if(!run) return; if(!R.domElement.isConnected){ run = false; return; } if(!t0) t0 = now; const sec = (now - t0)/1000; draw(cycle(E, sec), Math.sin(sec/(per*2)*2*Math.PI)*.12); raf = requestAnimationFrame(loop); };
    draw(0, 0);
    return { E, F, S, draw, get running(){ return run; }, play(){ if(run) return; run = true; t0 = 0; raf = requestAnimationFrame(loop); }, stop(){ run = false; cancelAnimationFrame(raf); },
      dispose(){ run = false; cancelAnimationFrame(raf); R.dispose(); R.forceContextLoss(); F.g.dispose(); R.domElement.remove(); } };
  }
  const find = name => { const X = ex(); return Object.keys(X).find(k => X[k].re.test(name || "")); };
  window.EX3 = { get EX(){ return ex(); }, make, find, place, poseAt, cycle, period, measure, resolve, mix, arm, leg };
})();
