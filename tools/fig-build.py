# Builds fig/body.json from the CC0 MakeHuman assets (base.obj, default.mhskel, default_weights.mhw and the targets, from github.com/makehumancommunity/makehuman, makehuman/data).
# Run: python3 fig-build.py 0.6 caucasian-male-young.target=1 male-young-averagemuscle-averageweight-idealproportions.target=0.7, then drop the "dom" key.
import json, numpy as np, re, sys
# 1 mesh
V=[];G=None;F=[]
for l in open('base.obj'):
    if l.startswith('v '): V.append([float(x) for x in l.split()[1:4]])
    elif l.startswith('g '): G=l.split()[1]
    elif l.startswith('f ') and G=='body': F.append([int(t.split('/')[0])-1 for t in l.split()[1:]])
V=np.array(V)
# 2 targets: athletic male
def target(fn, w):
    for l in open(fn):
        if l[0]=='#' or not l.strip(): continue
        p=l.split(); V[int(p[0])]+=w*np.array([float(x) for x in p[1:4]])
target('universal-male-young-averagemuscle-averageweight.target', 1.0)
target('universal-male-young-maxmuscle-minweight.target', float(sys.argv[1]) if len(sys.argv)>1 else 0.55)
for extra in sys.argv[2:]:
    fn,w=extra.split('='); target(fn,float(w))
# 3 skeleton
S=json.load(open('default.mhskel'))
def jpos(name): return V[S['joints'][name]].mean(0)
MAP={}
def m(src,dst): MAP[src]=dst
for b in S['bones']:
    side = '.L' if b.endswith('.L') else '.R' if b.endswith('.R') else ''
    n=b
    if re.match(r'finger[2-5]',b): n='fingers'+side
    elif re.match(r'(finger|metacarpal|wrist)',b): n='hand'+side
    elif b.startswith(('toe','foot')): n='foot'+side
    elif b.startswith('lowerleg'): n='shin'+side
    elif b.startswith('upperleg'): n='thigh'+side
    elif b.startswith('lowerarm'): n='forearm'+side
    elif b.startswith(('upperarm','shoulder01')): n='upperarm'+side
    elif b.startswith('clavicle'): n='clavicle'+side
    elif b.startswith('pelvis') or b=='root': n='hips'
    elif b.startswith('breast'): n='spine02'
    elif b in ('spine05','spine04'): n='spineA'
    elif b in ('spine03','spine02'): n='spineB'
    elif b=='spine01': n='spineC'
    elif b.startswith('neck'): n='neck'
    elif b in ('spine01','spine02','spine03'): n=b
    else: n='head'   # face, eyes, jaw, tongue, levator ...
    MAP[b]=n
MAP['spine02']='spineB'
BON=[ # name, parent, head joint bone, tail
 ('hips',None,'root','spine05'),
 ('spineA','hips','spine05','spine04'),
 ('spineB','spineA','spine03','spine02'),
 ('spineC','spineB','spine01','spine01'),
 ('neck','spineC','neck01','neck03'),
 ('head','neck','head','head'),
]
for s in ('.L','.R'):
    BON+= [('clavicle'+s,'spineC','clavicle'+s,'clavicle'+s),('upperarm'+s,'clavicle'+s,'shoulder01'+s,'upperarm02'+s),
           ('forearm'+s,'upperarm'+s,'lowerarm01'+s,'lowerarm02'+s),('hand'+s,'forearm'+s,'wrist'+s,'finger3-1'+s),('fingers'+s,'hand'+s,'finger3-1'+s,'finger3-3'+s),
           ('thigh'+s,'hips','upperleg01'+s,'upperleg02'+s),('shin'+s,'thigh'+s,'lowerleg01'+s,'lowerleg02'+s),('foot'+s,'shin'+s,'foot'+s,'toe3-1'+s)]
head={n:jpos(h+'____head').tolist() for n,p,h,t in BON}
tail={n:jpos(t+'____tail').tolist() for n,p,h,t in BON}
# fix: upperarm head should be shoulder joint (upperarm01 head), use that
for s in ('.L','.R'):
    head['upperarm'+s]=jpos('upperarm01'+s+'____head').tolist()
    head['thigh'+s]=jpos('upperleg01'+s+'____head').tolist()
    head['fingers'+s]=jpos('finger3-1'+s+'____head').tolist()
    tail['foot'+s]=jpos('toe3-1'+s+'____head').tolist()
for sd in ('.L','.R'):
    tail['upperarm'+sd]=head['forearm'+sd]; tail['forearm'+sd]=head['hand'+sd]; tail['thigh'+sd]=head['shin'+sd]; tail['shin'+sd]=head['foot'+sd]
names=[b[0] for b in BON]; idx={n:i for i,n in enumerate(names)}
# 4 weights
W=json.load(open('default_weights.mhw'))['weights']
used=sorted(set(i for f in F for i in f)); remap={v:i for i,v in enumerate(used)}
acc=[dict() for _ in used]
for b,lst in W.items():
    n=MAP.get(b,'head');
    if n not in idx: n={'spine02':'spineB'}.get(n,'head')
    for vi,w in lst:
        if vi in remap: d=acc[remap[vi]]; d[n]=d.get(n,0)+w
SI=[];SW=[]
for d in acc:
    it=sorted(d.items(),key=lambda x:-x[1])[:4]
    if not it: it=[('hips',1)]
    t=sum(w for _,w in it); it=[(n,w/t) for n,w in it]+[('hips',0)]*(4-len(it))
    SI+= [idx[n] for n,_ in it]; SW+= [round(w,3) for _,w in it]
P=V[used]
tri=[]
for f in F:
    a,b,c,d=[remap[i] for i in f]; tri+=[a,b,c,a,c,d]
dom=[names[SI[i*4]] for i in range(len(used))]
refs={}
for sd in ('.L','.R'):
    w=jpos('wrist'+sd+'____head'); f3=jpos('finger3-1'+sd+'____head'); f2=jpos('finger2-1'+sd+'____head'); f5=jpos('finger5-1'+sd+'____head')
    n=np.cross(f3-w, f2-f5); n=n/np.linalg.norm(n); refs['hand'+sd]=refs['fingers'+sd]=[round(x,4) for x in (n if sd=='.L' else -n)]
    print('palm',sd,refs['hand'+sd], 'dir', (f3-w)/np.linalg.norm(f3-w))
out={'pos':np.round(P,3).flatten().tolist(),'idx':tri,'si':SI,'sw':SW,'bones':[{'n':n,'p':p,'h':[round(x,3) for x in head[n]],'t':[round(x,3) for x in tail[n]],'r':refs.get(n)} for n,p,_,_ in BON],'dom':dom}
json.dump(out,open('model.json','w'),separators=(',',':'))
print(len(used),len(tri)//3,{n:[round(x,2) for x in head[n]] for n in names})
# 5 muscle regions on the rest mesh; seg = sub part for the contour lines
R=['none','pecs','abs','obliques','serratus','delts','biceps','triceps','forearms','traps','lats','lowerback','glutes','quads','hamstrings','adductors','calves','shins','neck']
reg=[];seg=[]
sh={'.L':np.array(head['upperarm.L']),'.R':np.array(head['upperarm.R'])}
kn={'.L':np.array(head['shin.L']),'.R':np.array(head['shin.R'])}
hp={'.L':np.array(head['thigh.L']),'.R':np.array(head['thigh.R'])}
el={'.L':np.array(head['forearm.L']),'.R':np.array(head['forearm.R'])}
an={'.L':np.array(head['foot.L']),'.R':np.array(head['foot.R'])}
for i,(x,y,z) in enumerate(P):
    d=dom[i]; s='.L' if x>0 else '.R'; ax=abs(x); r='none'; sub=0
    if d.startswith(('upperarm','clavicle','spineC')) and np.linalg.norm(P[i]-sh[s])<0.98 and ax>1.25: r='delts'
    elif d.startswith('upperarm'):
        # position along the arm and around it
        a=sh[s]; b=el[s]; t=np.dot(P[i]-a,b-a)/np.dot(b-a,b-a); c=a+(b-a)*t
        r='biceps' if z>c[2]+0.05 else 'triceps'
        if r=='triceps' and ax-c[0]*np.sign(x)*np.sign(x) >0 and t<0.55: sub=1   # lateral head
    elif d.startswith('forearm'):
        r='forearms'; sub=1 if z>0.3 else 0
    elif d.startswith(('hand','fingers','foot')) or d=='head': r='none'
    elif d=='neck' and y>6.5: r='neck' if z<0.3 else 'none'
    elif d.startswith('shin'):
        a=kn[s]; b=an[s]; t=(a[1]-y)/(a[1]-b[1]); cx=abs(a[0]+(b[0]-a[0])*t); cz=a[2]+(b[2]-a[2])*t
        if t>0.86: r='none'
        elif z<cz-0.05:
            r='calves'; sub=1 if ax>cx else 0
            if t>0.62: r='none'
        elif ax>cx+0.05: r='shins'
    elif d.startswith('thigh'):
        a=hp[s]; b=kn[s]; t=(a[1]-y)/(a[1]-b[1]); cx=abs(a[0]+(b[0]-a[0])*t); cz=a[2]+(b[2]-a[2])*t
        if y>-0.95 and z<cz-0.2: r='glutes'
        elif t>0.93: r='none'
        elif z>cz+0.15 or (ax>cx+0.35 and z>cz-0.3):
            r='quads'; dx=ax-cx
            sub = 2 if dx>0.28 else (0 if dx>-0.28 or t<0.55 else 1)   # lateralis, rectus, medialis
        elif ax<cx-0.3 and z>cz-0.35: r='adductors'
        else:
            r='hamstrings'; sub=1 if ax>cx else 0
    else:
        front = z>0.35
        if y<0.6 and z<0: r='glutes'
        elif y<0.9 and front: r='none'
        elif y<-0.2: r='none'
        elif front:
            if y>3.8+0.45*max(0,ax-1.1) and ax<2.0 and y<5.05: r='pecs'
            elif y>3.0 and ax>1.25 and y<4.3: r='serratus'
            elif ax<0.95 and y<3.95:
                r='abs'; sub=(0 if y>3.25 else 1 if y>2.65 else 2 if y>2.0 else 3)
            elif y<3.4: r='obliques'
            else: r='pecs' if y>3.6 else 'none'
        else:
            if y>2.6 and ax<0.22+(y-2.6)*0.8 and ax<1.75 and y<6.9: r='traps'
            elif y>1.7 and y<4.4 and ax>0.45: r='lats'
            elif ax<0.8 and y>0.6: r='lowerback'
            elif y>0.6: r='obliques'
    reg.append(R.index(r)); seg.append(0 if r=='none' else R.index(r)*8+sub*2+(1 if x>0 else 0))
out['reg']=reg; out['seg']=seg; out['regions']=R
json.dump(out,open('model.json','w'),separators=(',',':'))
from collections import Counter; print(Counter(R[r] for r in reg))
