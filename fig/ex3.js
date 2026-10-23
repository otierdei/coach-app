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

  // props
  const col = h => new T.Color(h).convertSRGBToLinear();
  const matP = (h, r) => new T.MeshStandardMaterial({color: col(h), roughness: r==null ? .85 : r, metalness: 0});
  const PR = {
    floor(S){ const m = new T.Mesh(new T.CircleGeometry(1.7, 56), new T.MeshBasicMaterial({color: col(0x2a2622)})); m.rotation.x = -Math.PI/2; m.position.y = -.001; S.add(m); return m; },
    box(S, c, s, h){ const m = new T.Mesh(new T.BoxGeometry(s[0], s[1], s[2]), matP(h||0x4a433b)); m.position.set(c[0], c[1], c[2]); S.add(m); return m; },
    bar(S, y, z, len){ const m = new T.Mesh(new T.CylinderGeometry(.016,.016,len||1.2,16), matP(0x8a8073,.35)); m.rotation.z = Math.PI/2; m.position.set(0, y, z||0); S.add(m); return m; },
    rail(S, x, y, z0, z1){ const m = new T.Mesh(new T.CylinderGeometry(.02,.02,z1-z0,16), matP(0x8a8073,.35)); m.rotation.x = Math.PI/2; m.position.set(x, y, (z0+z1)/2); S.add(m);
      for(const z of [z0+.05, z1-.05]){ const p = new T.Mesh(new T.CylinderGeometry(.018,.018,y,10), matP(0x5a5249,.5)); p.position.set(x, y/2, z); S.add(p); } return m; },
    dumbbell(F, s, axis, kg){
      const M = F3.M(), i = M.nb["hand."+s], b = M.bones[i], g = new T.Group();
      const h = new T.Mesh(new T.CylinderGeometry(.014,.014,.13,12), matP(0x8a8073,.35)); g.add(h);
      for(const y of [-.075,.075]){ const pl = new T.Mesh(new T.CylinderGeometry(.045,.045,.035,20), matP(0x3a342e,.6)); pl.position.y = y; g.add(pl); }
      const rq = F.rq || (F3.apply(F,{hips:[0,0,0],dirs:{}}), F.rq);
      const x0 = new T.Vector3(1,0,0).applyQuaternion(rq[i]), y0 = new T.Vector3(0,1,0).applyQuaternion(rq[i]), z0 = new T.Vector3(0,0,1).applyQuaternion(rq[i]);
      const ax = axis === "dir" ? y0 : x0;
      g.quaternion.setFromUnitVectors(new T.Vector3(0,1,0), ax);
      const off = y0.clone().multiplyScalar(axis === "dir" ? .15 : .055).add(z0.clone().multiplyScalar(axis === "dir" ? .0 : .035));
      g.position.copy(off); F.bones[i].add(g); return g;
    }
  };

  // ---------- the exercises ----------
  const hangLegs = (k) => ({ "thigh.L":leg(6+k*8,3,"L"), "thigh.R":leg(6+k*8,3,"R"), "shin.L":leg(-14-k*14,3,"L"), "shin.R":leg(-14-k*14,3,"R"), "foot.L":[[0,-.55,.85],[0,.85,.55]], "foot.R":[[0,-.55,.85],[0,.85,.55]] });
  const flatHand = (x, z, yaw) => { const a = (yaw||0)*D2R*(x>0?1:-1); return {t:[x,.056,z], w:true, dir:[Math.sin(a),0,Math.cos(a)], ref:[0,-1,0]}; };
  const armsDown = (fl) => ({ "upperarm.L":arm(fl||4,8,"L"), "upperarm.R":arm(fl||4,8,"R"), "forearm.L":arm((fl||4)+12,6,"L"), "forearm.R":arm((fl||4)+12,6,"R") });

  let EXC = null;
  function defs(){
  const EX = {};
  EX.pullup = { re:/pull ups/i, en:"Pull ups", de:"Klimmzüge", work:["lats","biceps","traps","forearms","delts"],
    mus:{en:"Lats, biceps, upper back", de:"Latissimus, Bizeps, oberer Rücken"},
    cues:{en:["Dead hang, arms long","Pull the elbows down to the ribs","Chin over the bar, lower slowly"], de:["Aus dem toten Hang, Arme lang","Ellbogen Richtung Rippen ziehen","Kinn über die Stange, langsam ablassen"]},
    cam:{p:[2.1,1.7,-3.7], l:[0,1.5,0]}, props(S){ PR.bar(S, 2.3, 0); },
    keys:[ {at:{shoulders:[0,1.76,0]}, spine:[-4,-4,-2,0,4,2], shrug:22, limbs:hangLegs(0), curl:{"fingers.L":95,"fingers.R":95},
             ik:{"hand.L":{t:[.32,2.235,-.045], pole:[1,-.15,.15], dir:[0,1,.25], ref:[0,-.25,1]}, "hand.R":{t:[-.32,2.235,-.045], pole:[-1,-.15,.15], dir:[0,1,.25], ref:[0,-.25,1]}}},
           {at:{shoulders:[0,2.08,-.07]}, spine:[-14,-12,-10,-6,-8,-16], shrug:4, limbs:hangLegs(1), curl:{"fingers.L":95,"fingers.R":95},
             ik:{"hand.L":{t:[.32,2.235,-.045], pole:[1,-.15,.15], dir:[0,1,.25], ref:[0,-.25,1]}, "hand.R":{t:[-.32,2.235,-.045], pole:[-1,-.15,.15], dir:[0,1,.25], ref:[0,-.25,1]}}} ] };

  EX.chinup = { re:/chin ups/i, en:"Chin ups", de:"Chin ups (Untergriff)", work:["biceps","lats","forearms","traps"],
    mus:{en:"Biceps, lats", de:"Bizeps, Latissimus"},
    cues:{en:["Palms face you, hands shoulder wide","Pull the chest to the bar","Lower all the way"], de:["Handflächen zu dir, schulterbreit","Brust zur Stange ziehen","Ganz ablassen"]},
    cam:{p:[2.7,1.75,3.3], l:[0,1.5,0]}, props(S){ PR.bar(S, 2.3, 0); },
    keys:[0,1].map(k=>({at:{shoulders:k?[0,2.06,.07]:[0,1.76,0]}, spine:k?[-12,-10,-8,-6,-6,-12]:[-4,-4,-2,0,4,2], shrug:k?4:22, limbs:hangLegs(k), curl:{"fingers.L":95,"fingers.R":95},
      ik:{"hand.L":{t:[.2,2.235,.045], pole:[.35,-.2,1], dir:[0,1,-.25], ref:[0,.25,-1]}, "hand.R":{t:[-.2,2.235,.045], pole:[-.35,-.2,1], dir:[0,1,-.25], ref:[0,.25,-1]}}})) };

  EX.kneeraise = { re:/hanging knee/i, en:"Hanging knee raises", de:"Hängendes Knieheben", work:["abs","obliques","forearms"],
    mus:{en:"Abs, hip flexors, grip", de:"Bauch, Hüftbeuger, Griff"},
    cues:{en:["Hang still, shoulders active","Roll the pelvis up, knees to chest","Lower without swinging"], de:["Ruhig hängen, Schultern aktiv","Becken einrollen, Knie zur Brust","Ohne Schwung ablassen"]},
    cam:{p:[3.5,1.45,1.6], l:[0,1.45,0]}, props(S){ PR.bar(S, 2.3, 0); },
    keys:[0,1].map(k=>({at:{shoulders:[0,1.8,-.01]}, spine:k?[-38,-22,-8,0,8,10]:[-2,-2,0,0,4,2], shrug:14, curl:{"fingers.L":95,"fingers.R":95},
      limbs: k ? {"thigh.L":leg(112,4,"L"),"thigh.R":leg(112,4,"R"),"shin.L":leg(10,4,"L"),"shin.R":leg(10,4,"R"),"foot.L":[[0,-.4,.9],[0,.9,.4]],"foot.R":[[0,-.4,.9],[0,.9,.4]]} : hangLegs(0),
      ik:{"hand.L":{t:[.3,2.235,-.045], pole:[1,-.15,.15], dir:[0,1,.25], ref:[0,-.25,1]}, "hand.R":{t:[-.3,2.235,-.045], pole:[-1,-.15,.15], dir:[0,1,.25], ref:[0,-.25,1]}}})) };

  EX.falsegrip = { re:/false grip/i, en:"False grip hang", de:"False Grip Hang", work:["forearms","lats","biceps","traps"],
    mus:{en:"Forearms, wrist flexors, lats", de:"Unterarme, Handgelenkbeuger, Latissimus"},
    cues:{en:["Wrist crease on top of the bar","Pull the shoulders down","Small bend in the elbows, hold"], de:["Handgelenk liegt auf der Stange","Schultern nach unten ziehen","Ellbogen leicht gebeugt, halten"]},
    cam:{p:[3.2,1.85,1.9], l:[0,1.6,0]}, props(S){ PR.bar(S, 2.3, 0); },
    keys:[0,1].map(k=>({at:{shoulders:k?[0,1.9,-.06]:[0,1.8,-.04]}, spine:k?[-8,-6,-4,-2,-2,-6]:[-2,-2,0,0,4,2], shrug:k?2:20, limbs:hangLegs(0), curl:{"fingers.L":85,"fingers.R":85},
      ik:{"hand.L":{t:[.29,2.315,-.03], pole:[1,-.25,.1], dir:[0,-.1,1], ref:[0,-1,-.1]}, "hand.R":{t:[-.29,2.315,-.03], pole:[-1,-.25,.1], dir:[0,-.1,1], ref:[0,-1,-.1]}}})) };

  const dipLegs = {"thigh.L":leg(8,2,"L"),"thigh.R":leg(8,2,"R"),"shin.L":leg(-70,2,"L"),"shin.R":leg(-70,2,"R"),"foot.L":[[0,-.8,-.6],[0,-.6,.8]],"foot.R":[[0,-.8,-.6],[0,-.6,.8]]};
  EX.dips = { re:/^dips/i, en:"Dips", de:"Dips", work:["triceps","pecs","delts"],
    mus:{en:"Triceps, chest, front shoulders", de:"Trizeps, Brust, vordere Schulter"},
    cues:{en:["Lock out on top, shoulders down","Lean slightly forward, elbows back","Down to 90 degrees, press up"], de:["Oben gestreckt, Schultern tief","Leicht nach vorn lehnen, Ellbogen nach hinten","Bis 90 Grad runter, hochdrücken"]},
    cam:{p:[2.9,1.55,2.2], l:[0,1.15,0]}, props(S){ PR.floor(S); PR.rail(S, .27, 1.12, -.45, .5); PR.rail(S, -.27, 1.12, -.45, .5); },
    keys:[0,1].map(k=>({at:{shoulders:k?[0,1.40,-.1]:[0,1.65,-.03]}, spine:k?[30,28,24,18,6,0]:[8,8,6,4,0,-4], shrug:k?0:-4, limbs:dipLegs, curl:{"fingers.L":70,"fingers.R":70},
      ik:{"hand.L":{t:[.27,1.165,.02], w:true, pole:[.25,0,-1], dir:[.2,-.15,.97], ref:[-.35,-.93,0]}, "hand.R":{t:[-.27,1.165,.02], w:true, pole:[-.25,0,-1], dir:[-.2,-.15,.97], ref:[.35,-.93,0]}}})) };

  // floor push ups: body turns about the ankles
  function pushKeys(o){
    const ank = o.ank, top = plank(o.top, ank), bot = plank(o.bot, ank), hz = top.sh[2] + (o.hz||.02);
    const hand = (x, k) => Object.assign(flatHand(x, hz, o.yaw||0), {pole:[x>0?(o.pl||.3):-(o.pl||.3), .1, -1]});
    return [top, bot].map((P,k)=>{
      const sh = P.sh.slice(); if(o.shift) sh[0] = k*o.shift;
      const ik = {"hand.L":hand(o.hx), "hand.R":hand(-o.hx)};
      if(o.straight && k){ ik["hand.R"].pole = [-1, .25, 0]; }
      for(const [s,x] of [["L",o.fx],["R",-o.fx]]) ik["foot."+s] = {t:[x, ank[1], ank[2]], pole:[0,0,1], dir:measure().foot[0], ref:measure().foot[1]};
      return {frame:P.pitch, at:{shoulders:sh}, spine:[0,0,0,0,-8,-14], shrug:k?2:6, ik, curl:{"fingers.L":5,"fingers.R":5}};
    });
  }
  EX.pushup = { re:/^push ups/i, en:"Push ups", de:"Liegestütze", work:["pecs","triceps","delts","abs"],
    mus:{en:"Chest, triceps, front shoulders, core", de:"Brust, Trizeps, vordere Schulter, Rumpf"},
    cues:{en:["Hands under the shoulders, body one line","Elbows about 45 degrees from the body","Chest to a fist above the floor, press away"], de:["Hände unter den Schultern, Körper eine Linie","Ellbogen etwa 45 Grad vom Körper","Brust bis eine Faust über den Boden, wegdrücken"]},
    cam:{p:[2.7,1.25,1.9], l:[0,.25,-.3]}, props(S){ PR.floor(S); },
    get keys(){ return this._k || (this._k = pushKeys({top:.56, bot:.2, ank:[0,.205,-1.0], hx:.24, fx:.09})); } };

  EX.decline = { re:/decline push/i, en:"Decline push ups", de:"Liegestütze mit Füßen erhöht", work:["pecs","delts","triceps"],
    mus:{en:"Upper chest, front shoulders, triceps", de:"Obere Brust, vordere Schulter, Trizeps"},
    cues:{en:["Feet on the chair, hands on the floor","Body straight, no sagging hips","Lower the chest between the hands"], de:["Füße auf dem Stuhl, Hände am Boden","Körper gerade, Hüfte hängt nicht","Brust zwischen die Hände senken"]},
    cam:{p:[2.6,1.15,1.5], l:[0,.32,-.4]}, props(S){ PR.floor(S); PR.box(S, [0,.21,-1.02], [.45,.42,.4]); },
    get keys(){ return this._k || (this._k = pushKeys({top:.56, bot:.21, ank:[0,.53,-1.02], hx:.25, fx:.09})); } };

  EX.archer = { re:/archer push/i, en:"Archer push ups", de:"Archer Liegestütze", work:["pecs","triceps","delts"],
    mus:{en:"Chest and triceps, one side at a time", de:"Brust und Trizeps, je eine Seite"},
    cues:{en:["Hands very wide, fingers turned out","Lower toward one hand, the other arm stays straight","Press back to the middle, switch sides"], de:["Hände sehr breit, Finger nach außen","Zu einer Hand absenken, der andere Arm bleibt gestreckt","Zur Mitte zurück, Seite wechseln"]},
    cam:{p:[1.9,1.6,2.3], l:[0,.2,-.3]}, props(S){ PR.floor(S); },
    get keys(){ return this._k || (this._k = pushKeys({top:.53, bot:.24, ank:[0,.205,-1.0], hx:.62, fx:.2, yaw:55, shift:.2, straight:true, pl:.2})); } };

  EX.pike = { re:/pike push/i, en:"Pike push ups", de:"Pike Liegestütze", work:["delts","triceps","pecs","traps"],
    mus:{en:"Shoulders, triceps, upper chest", de:"Schultern, Trizeps, obere Brust"},
    cues:{en:["Hips high, feet on the box","Lower the head in front of the hands","Elbows point back, press to straight arms"], de:["Hüfte hoch, Füße auf der Box","Kopf vor den Händen absenken","Ellbogen nach hinten, bis die Arme gestreckt sind"]},
    cam:{p:[3.55,1.15,-.45], l:[0,.38,-.42]}, props(S){ PR.floor(S); PR.box(S, [0,.225,-1.0], [.6,.45,.42]); },
    keys:[0,1].map(k=>({at:{shoulders:k?[0,.3,.18]:[0,.54,-.02]}, spine:k?[135,135,138,146,158,168]:[150,150,152,156,168,176], shrug:k?6:14, curl:{"fingers.L":5,"fingers.R":5},
      ik:{"hand.L":{t:[.24,.06,0], w:true, pole:[.22,.1,-1], dir:[.15,0,1], ref:[0,-1,0]}, "hand.R":{t:[-.24,.06,0], w:true, pole:[-.22,.1,-1], dir:[-.15,0,1], ref:[0,-1,0]},
          "foot.L":{t:[.13,.53,-.98], w:true, pole:[0,-.2,1], dir:[0,-.8,-.6], ref:[0,.6,-.8]}, "foot.R":{t:[-.13,.53,-.98], w:true, pole:[0,-.2,1], dir:[0,-.8,-.6], ref:[0,.6,-.8]}}})) };

  EX.hollow = { re:/hollow/i, en:"Hollow body hold", de:"Hollow Body Hold", work:["abs","obliques","quads"],
    mus:{en:"Abs, deep core, hip flexors", de:"Bauch, tiefer Rumpf, Hüftbeuger"},
    cues:{en:["Lower back pressed into the floor","Shoulders and legs just off the floor","Start tucked, then reach long"], de:["Unterer Rücken drückt in den Boden","Schultern und Beine knapp über dem Boden","Erst eingerollt, dann lang machen"]},
    cam:{p:[2.5,1.35,1.3], l:[0,.12,-.1]}, props(S){ PR.floor(S); }, hold:true,
    keys:[0,1].map(k=>({frame:-90, at:{hips:[0,.032,.05]}, spine:[-2,2,7,12,16,12],
      limbs: k ? {"thigh.L":leg(24,4,"L"),"thigh.R":leg(24,4,"R"),"shin.L":leg(24,4,"L"),"shin.R":leg(24,4,"R"),"foot.L":[[0,-.95,.3],[0,.3,.95]],"foot.R":[[0,-.95,.3],[0,.3,.95]],
                  "upperarm.L":arm(168,10,"L"),"upperarm.R":arm(168,10,"R"),"forearm.L":arm(172,8,"L"),"forearm.R":arm(172,8,"R")}
               : {"thigh.L":leg(100,6,"L"),"thigh.R":leg(100,6,"R"),"shin.L":leg(-15,6,"L"),"shin.R":leg(-15,6,"R"),"foot.L":[[0,-.8,.6],[0,.6,.8]],"foot.R":[[0,-.8,.6],[0,.6,.8]],
                  "upperarm.L":arm(55,12,"L"),"upperarm.R":arm(55,12,"R"),"forearm.L":arm(62,8,"L"),"forearm.R":arm(62,8,"R")}})) };

  EX.bulgarian = { re:/bulgarian/i, en:"Bulgarian split squat", de:"Bulgarian Split Squat", work:["quads","glutes","adductors"],
    mus:{en:"Quads and glutes of the front leg", de:"Oberschenkel vorne und Gesäß, vorderes Bein"},
    cues:{en:["Rear foot laces down on the bench","Drop the back knee straight down","Front knee over the toes, push through the heel"], de:["Hinterer Fuß mit dem Rist auf der Bank","Hinteres Knie gerade nach unten","Vorderes Knie über den Zehen, über die Ferse hoch"]},
    cam:{p:[3.7,1.35,.9], l:[0,.68,-.1]}, props(S){ PR.floor(S); PR.box(S, [-.05,.2,-.66], [.5,.4,.36]); },
    keys:[0,1].map(k=>({at:{hips:k?[0,.53,-.13]:[0,.87,-.08]}, spine:k?[18,14,10,6,-4,-6]:[6,4,2,0,0,-2], limbs:armsDown(k?14:4),
      ik:{"foot.L":stand(.12,.33,"L",8), "foot.R":{t:[-.12,.47,-.6], w:true, pole:[0,-1,.25], dir:[0,-.3,-.95], ref:[0,-.95,.3]}}})) };

  EX.pistol = { re:/pistol/i, en:"Box pistol squat", de:"Pistol Squat auf die Box", work:["quads","glutes"],
    mus:{en:"Quads and glutes, balance", de:"Oberschenkel vorne, Gesäß, Gleichgewicht"},
    cues:{en:["Stand on one leg, the other leg forward","Sit back slowly until you touch the box","Arms forward, stand up without bouncing"], de:["Auf einem Bein, das andere nach vorn","Langsam nach hinten setzen, bis die Box berührt","Arme nach vorn, ohne Schwung aufstehen"]},
    cam:{p:[3.6,1.3,1.6], l:[0,.68,-.05]}, props(S){ PR.floor(S); PR.box(S, [0,.21,-.36], [.42,.42,.38]); },
    keys:[0,1].map(k=>({at:{hips:k?[0,.53,-.24]:[0,.92,-.01]}, spine:k?[34,30,24,16,-6,-14]:[4,2,0,0,0,-2],
      limbs:{"thigh.L":leg(k?72:24,2,"L"),"shin.L":leg(k?72:16,2,"L"),"foot.L":[[0,-.2,.98],[0,.98,.2]], "upperarm.L":arm(k?84:30,6,"L"),"upperarm.R":arm(k?84:30,6,"R"),"forearm.L":arm(k?86:38,4,"L"),"forearm.R":arm(k?86:38,4,"R")},
      ik:{"foot.R":stand(-.09,.1,"R",4)}})) };

  // nordic: knees on the pad, heels held; thighs and trunk turn forward about the knee
  const nord = th => { const k = measure(), a = th*D2R, hj = [0, .10 + k.thigh*Math.cos(a), .0 + k.thigh*Math.sin(a)];
    return {at:{hipjoints:hj}, spine:[th,th,th+2,th+2,th-4,th-8],
      limbs: th > 20 ? {"upperarm.L":arm(78,14,"L"),"upperarm.R":arm(78,14,"R"),"forearm.L":arm(88,8,"L"),"forearm.R":arm(88,8,"R")} : {"upperarm.L":arm(18,4,"L"),"upperarm.R":arm(18,4,"R"),"forearm.L":arm(112,-30,"L"),"forearm.R":arm(112,-30,"R")},
      ik:{"foot.L":{t:[.1,.11,-.43], w:true, pole:[0,-1,.35], dir:[0,-.35,-.94], ref:[0,-.94,.35]}, "foot.R":{t:[-.1,.11,-.43], w:true, pole:[0,-1,.35], dir:[0,-.35,-.94], ref:[0,-.94,.35]}}}; };
  EX.nordic = { re:/nordic/i, en:"Nordic curl negatives", de:"Nordic Curl Negativ", work:["hamstrings","glutes"],
    mus:{en:"Hamstrings, glutes", de:"Beinbeuger, Gesäß"},
    cues:{en:["Kneel, heels held under something solid","Body straight from knee to head","Lower as slowly as you can, catch with the hands"], de:["Knien, Fersen fest unter etwas Stabilem","Körper gerade vom Knie bis zum Kopf","So langsam wie möglich ablassen, mit den Händen abfangen"]},
    cam:{p:[3.3,1.0,.7], l:[0,.5,.05]}, props(S){ PR.floor(S); PR.box(S, [0,.025,.0], [.5,.05,.3], 0x5a5249); PR.bar(S, .19, -.45, .6); PR.box(S, [.33,.1,-.45], [.04,.2,.04], 0x5a5249); PR.box(S, [-.33,.1,-.45], [.04,.2,.04], 0x5a5249); },
    lower:true, keys:[nord(0), nord(58)] };

  // copenhagen, knee version: lying on the left side, left forearm on the floor, right knee on the bench
  const SIDE = {x:[0,-1,0], y:[0,0,1]};
  EX.copenhagen = { re:/copenhagen/i, en:"Copenhagen plank, knee version", de:"Copenhagen Plank, Knie Variante", work:["adductors","obliques","abs"],
    mus:{en:"Inner thigh, side core", de:"Adduktoren, seitlicher Rumpf"},
    cues:{en:["Forearm under the shoulder, top knee on the bench","Lift the hips into one line","Bottom leg comes up to the bench, hold"], de:["Unterarm unter der Schulter, oberes Knie auf der Bank","Hüfte heben bis zur Linie","Unteres Bein zur Bank heben, halten"]},
    cam:{p:[-3.1,1.15,-.1], l:[0,.32,-.5]}, props(S){ PR.floor(S); PR.box(S, [.02,.24,-.98], [.48,.48,.34]); },
    keys:[0,1].map(k=>({frame:SIDE, at:{shoulders:[0, .5, 0]}, spine:[0,0,0,0,0,0], side:k?[0,0,0,0,0,0]:[-24,-18,-8,0,6,6], shrug:0, aim:{"thigh.R":{t:[0,.55,-.93], ref:[0,0,1]}},
      limbs:{"upperarm.R":arm(20,4,"R"),"forearm.R":arm(60,0,"R"),
             "thigh.R":leg(4,-2,"R"),"shin.R":leg(4,-2,"R"),"foot.R":[[0,-.9,.4],[0,.4,.9]],
             "thigh.L":leg(4, k?4:-12,"L"),"shin.L":leg(4,k?4:-6,"L"),"foot.L":[[0,-.9,.4],[0,.4,.9]]},
      ik:{"hand.L":{t:[-.27,.045,.02], w:true, pole:[.4,-1,0], dir:[-1,0,0], ref:[0,-1,0]}}})) };

  // broad jump: a sequence, not a back and forth
  const bj = (z, hy, sp, arms, kf, kfL, air) => ({at:{hips:[0, hy, z]}, spine:sp, limbs:{"upperarm.L":arm(arms,10,"L"),"upperarm.R":arm(arms,10,"R"),"forearm.L":arm(arms+14,6,"L"),"forearm.R":arm(arms+14,6,"R")},
    ik:{"foot.L":Object.assign(stand(.12, z+kf, "L", 6), air?{t:[.12, air, z+kf]}:{}), "foot.R":Object.assign(stand(-.12, z+kfL, "R", 6), air?{t:[-.12, air, z+kfL]}:{})}});
  EX.broad = { re:/broad jump/i, en:"Broad jumps", de:"Weitsprung aus dem Stand", work:["glutes","quads","hamstrings","calves"],
    mus:{en:"Glutes, quads, calves: power", de:"Gesäß, Oberschenkel, Waden: Explosivkraft"},
    cues:{en:["Swing the arms back and load the hips","Jump forward and up, arms drive through","Land soft with bent knees, stick it"], de:["Arme nach hinten, Hüfte laden","Nach vorn oben springen, Arme schwingen mit","Weich mit gebeugten Knien landen, stehen bleiben"]},
    cam:{p:[4.7,1.15,.95], l:[0,.7,.65]}, props(S){ PR.floor(S).scale.set(1.4,1.4,1.4); }, seq:true,
    keys:[ bj(0,.93,[2,2,0,0,0,0],6,0,0), bj(-.02,.62,[42,36,26,18,-12,-10],-40,.05,.05), bj(.3,.98,[40,34,26,18,-6,-8],150,-.18,-.18,0.072),
           bj(.75,1.14,[18,14,8,4,0,-4],100,.1,.1,.62), bj(1.3,.64,[38,32,22,14,-10,-10],75,.12,.12), bj(1.3,.92,[4,2,0,0,0,0],8,.0,.0) ],
    times:[0,.22,.38,.55,.74,1] };

  // curls: standing, both arms
  const curlPose = (fl, hammer) => { const fa = s => arm(fl, 2, s), pn = s => hammer ? [s==="L"?-1:1, 0, 0] : [0, Math.sin(fl*D2R), Math.cos(fl*D2R)];
    return {at:{hips:[0,.94,0]}, spine:[0,0,0,0,0,0], curl:{"fingers.L":85,"fingers.R":85},
      limbs:{"upperarm.L":arm(4,6,"L"),"upperarm.R":arm(4,6,"R"),"forearm.L":fa("L"),"forearm.R":fa("R"),"hand.L":[fa("L")[0], pn("L")],"hand.R":[fa("R")[0], pn("R")]},
      ik:{"foot.L":stand(.12,0,"L",6),"foot.R":stand(-.12,0,"R",6)}}; };
  EX.hammer = { re:/hammer curl/i, en:"Hammer curls", de:"Hammer Curls", work:["biceps","forearms"],
    mus:{en:"Biceps, forearm (brachioradialis)", de:"Bizeps, Unterarm (Oberarmspeichenmuskel)"},
    cues:{en:["Palms face each other","Elbows stay at the sides","Curl up, lower in two to three seconds"], de:["Handflächen zeigen zueinander","Ellbogen bleiben am Körper","Hochbeugen, in zwei bis drei Sekunden ablassen"]},
    cam:{p:[2.6,1.4,2.4], l:[0,1.05,0]}, props(S,F){ PR.floor(S); PR.dumbbell(F,"L","x"); PR.dumbbell(F,"R","x"); },
    keys:[curlPose(4,true), curlPose(138,true)] };
  EX.curl = { re:/db curls|dumbbell curl|^curls/i, en:"Dumbbell curls", de:"Bizeps Curls", work:["biceps","forearms"],
    mus:{en:"Biceps", de:"Bizeps"},
    cues:{en:["Palms face forward","Elbows stay at the sides","Squeeze on top, lower slowly"], de:["Handflächen zeigen nach vorn","Ellbogen bleiben am Körper","Oben anspannen, langsam ablassen"]},
    cam:{p:[2.6,1.4,2.4], l:[0,1.05,0]}, props(S,F){ PR.floor(S); PR.dumbbell(F,"L","x"); PR.dumbbell(F,"R","x"); },
    keys:[curlPose(4,false), curlPose(140,false)] };

  EX.ohtri = { re:/overhead triceps/i, en:"Overhead triceps extension", de:"Trizepsdrücken über Kopf", work:["triceps"],
    mus:{en:"Triceps, long head", de:"Trizeps, langer Kopf"},
    cues:{en:["Hold one dumbbell with both hands overhead","Elbows point up, lower behind the head","Stretch at the bottom, press up"], de:["Eine Kurzhantel mit beiden Händen über dem Kopf","Ellbogen zeigen nach oben, hinter den Kopf senken","Unten dehnen, hochdrücken"]},
    cam:{p:[2.8,1.55,1.5], l:[0,1.35,0]}, props(S,F){ PR.floor(S); F.db = PR.dumbbell(F,"L","x"); F.mesh.add(F.db); },
    after(F){ const a = boneW(F,"hand.L").add(boneW(F,"hand.R")).multiplyScalar(.5); const db = F.db; db.parent.updateMatrixWorld(true);
      const inv = new T.Matrix4().copy(db.parent.matrixWorld).invert(); db.position.copy(a.add(new T.Vector3(0,-.075,0)).applyMatrix4(inv)); db.quaternion.identity(); },
    keys:[0,1].map(k=>({at:{hips:[0,.94,0]}, spine:[-2,-2,-2,-2,4,6], shrug:k?16:22, curl:{"fingers.L":70,"fingers.R":70},
      ik:{"hand.L":{t:k?[.035,1.62,-.2]:[.035,1.92,.02], w:true, pole:[.35,1,.6], dir:k?[0,-.3,-.95]:[0,1,.05], ref:[-1,0,0]}, "hand.R":{t:k?[-.035,1.62,-.2]:[-.035,1.92,.02], w:true, pole:[-.35,1,.6], dir:k?[0,-.3,-.95]:[0,1,.05], ref:[1,0,0]},
          "foot.L":stand(.12,0,"L",6),"foot.R":stand(-.12,0,"R",6)}})) };

  EX.warmup = { re:/warm up/i, en:"Warm up + mobility", de:"Aufwärmen + Mobilität", work:["quads","glutes","delts"],
    mus:{en:"Whole body", de:"Ganzer Körper"},
    cues:{en:["Sink into a deep squat, chest up","Stand and reach both arms overhead","Breathe, five slow rounds"], de:["Tief in die Hocke, Brust aufrecht","Aufstehen und beide Arme nach oben strecken","Ruhig atmen, fünf langsame Runden"]},
    cam:{p:[2.9,1.3,1.9], l:[0,.85,0]}, props(S){ PR.floor(S); },
    keys:[0,1].map(k=>({at:{hips:k?[0,.95,0]:[0,.46,-.16]}, spine:k?[-4,-4,-4,-4,-6,-10]:[34,26,18,10,-10,-14], shrug:k?20:6,
      limbs:{"upperarm.L":arm(k?172:88,k?14:8,"L"),"upperarm.R":arm(k?172:88,k?14:8,"R"),"forearm.L":arm(k?176:92,8,"L"),"forearm.R":arm(k?176:92,8,"R")},
      ik:{"foot.L":stand(.16,.02,"L",16),"foot.R":stand(-.16,.02,"R",16)}})) };

  return EX;
  }
  const ex = () => EXC || (EXC = defs());
  // ---------- rendering ----------
  const ease = t => t<.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2;
  function poseAt(E, t){
    const keys = E.keys;
    if(!E.seq) return mix(keys[0], keys[1], t);
    const ts = E.times; let i = 0; while(i < ts.length-2 && t > ts[i+1]) i++;
    const u = (t - ts[i])/(ts[i+1]-ts[i]); return mix(keys[i], keys[i+1], Math.min(1, Math.max(0, u)));
  }
  // one cycle: 0..1 -> movement value; holds at both ends; sequences play straight through
  function cycle(E, ph){
    if(E.seq) return ph < .82 ? ease(ph/.82) : 1;
    const c = ph*3.2, up = E.lower ? 1.6 : 1.2;
    if(E.lower) return c < 1.6 ? ease(c/1.6)*1 : c < 2.0 ? 1 : c < 2.8 ? 1 - ease((c-2)/.8) : 0;
    return c < up ? ease(c/up) : c < 1.6 ? 1 : c < 2.8 ? 1 - ease((c-1.6)/1.2) : 0;
  }
  function make(el, id, opts){
    const E = ex()[id]; if(!E) return null; opts = opts || {};
    const w = opts.w || el.clientWidth || 320, h = opts.h || Math.round(w*.85);
    const {R,S,C} = F3.scene(el, w, h), F = F3.build();
    F.g.setAttribute("color", new T.BufferAttribute(F3.colours(E.work), 3)); S.add(F.mesh);
    E.props && E.props(S, F);
    C.position.set(...E.cam.p); C.lookAt(...E.cam.l);
    const base = V(E.cam.p).sub(V(E.cam.l));
    const draw = (t, sway) => { place(F, poseAt(E, t)); E.after && E.after(F); const q = new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0), (sway||0)); C.position.copy(V(E.cam.l).add(base.clone().applyQuaternion(q))); C.lookAt(...E.cam.l); R.render(S, C); };
    let raf = 0, t0 = 0, run = false;
    const loop = now => { if(!run) return; if(!t0) t0 = now; const per = E.seq ? 3600 : E.hold ? 5200 : 4000, ph = ((now - t0) % per)/per; draw(cycle(E, ph), Math.sin((now-t0)/per*2*Math.PI)*.18); raf = requestAnimationFrame(loop); };
    draw(0, 0);
    return { E, draw, play(){ if(run) return; run = true; t0 = 0; raf = requestAnimationFrame(loop); }, stop(){ run = false; cancelAnimationFrame(raf); },
      dispose(){ run = false; cancelAnimationFrame(raf); R.dispose(); R.forceContextLoss(); F.g.dispose(); R.domElement.remove(); } };
  }
  const find = name => { const X = ex(); return Object.keys(X).find(k => X[k].re.test(name || "")); };
  window.EX3 = { get EX(){ return ex(); }, make, find, place, poseAt, cycle, measure, resolve, mix, arm, leg };
})();
