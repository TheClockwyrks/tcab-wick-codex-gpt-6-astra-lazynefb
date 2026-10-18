"""One-time original pixel-art and audio production. Never called by the build.
All raster files are rendered by draw / draw-sheet from authored scanline shapes.
"""
import json, math, pathlib, subprocess, random
ROOT=pathlib.Path(__file__).resolve().parent.parent
TMP=pathlib.Path('/tmp/wick-production');TMP.mkdir(exist_ok=True)
def call(*args):
 p=subprocess.run([str(a) for a in args],capture_output=True,text=True,cwd=TMP)
 if p.returncode: raise RuntimeError(p.stderr)
 return p.stdout
class Art:
 def __init__(self,w,h): self.w=w;self.h=h;self.ops=[]
 def rect(self,x,y,w,h,c):
  if w>0 and h>0:self.ops.append(dict(op='fill_rect',x=round(x),y=round(y),width=max(1,round(w)),height=max(1,round(h)),color=c))
 def poly(self,points,c):
  for y in range(math.floor(min(p[1] for p in points)),math.ceil(max(p[1] for p in points))):
   xs=[]
   for i,(x1,y1) in enumerate(points):
    x2,y2=points[(i+1)%len(points)]
    if min(y1,y2)<=y+.5<max(y1,y2):xs.append(x1+(y+.5-y1)/(y2-y1)*(x2-x1))
   xs.sort()
   for i in range(0,len(xs)-1,2): self.rect(math.ceil(xs[i]),y,math.floor(xs[i+1])-math.ceil(xs[i])+1,1,c)
 def ellipse(self,x,y,rx,ry,c):
  self.poly([(x+rx*math.cos(i*math.pi/24),y+ry*math.sin(i*math.pi/24)) for i in range(48)],c)
 def line(self,x,y,xx,yy,c,width=1):
  n=max(1,math.ceil(math.hypot(xx-x,yy-y)))
  for i in range(n+1):self.rect(x+(xx-x)*i/n-width/2,y+(yy-y)*i/n-width/2,width,width,c)
 def ring(self,x,y,r,c,width=1):
  for i in range(120):
   a=i*math.pi/60;b=(i+1)*math.pi/60;self.line(x+r*math.cos(a),y+r*math.sin(a),x+r*math.cos(b),y+r*math.sin(b),c,width)
 def save(self,path,sheet=False):
  dest=ROOT/'assets'/path;dest.parent.mkdir(parents=True,exist_ok=True)
  log=TMP/'art.json';log.write_text(json.dumps(self.ops))
  call('draw-sheet' if sheet else 'draw','render','--actions',log,'--out',dest,'--width',self.w,'--height',self.h,'--no-layers')
ink='#101923';dark='#263a46';slate='#496474';silver='#91b4b7';white='#f8e8bc';gold='#d9a65c';rust='#936b49';fire='#f0bd6b';mint='#9cddc7'
def lamp(a,cx,cy,scale=1):
 def r(x,y,w,h,c):a.rect(cx+x*scale,cy+y*scale,w*scale,h*scale,c)
 r(-4,-5,8,11,ink);r(-3,-4,6,8,gold);r(-2,-3,4,6,white);r(-1,-2,2,3,'#fff8da');r(-5,-6,10,2,rust);r(-4,5,8,2,rust);r(-3,6,6,1,gold);r(-3,-4,1,8,rust);r(2,-4,1,8,rust);r(-2,-3,1,3,'#fff8da');r(0,1,2,2,'#f7d596');r(-2,-9,4,1,gold);r(-3,-8,1,3,gold);r(2,-8,1,3,gold)
def player(frame=None):
 a=Art(24,32);n=0 if frame is None else frame;bob=0 if frame is None else [0,0,-1,-1,0,1][n]
 a.ellipse(11,30,9,2,'#0a111977');a.rect(6+[0,1,2,0,-1,-2][n],24,4,[6,5,4,5,6,7][n],ink);a.rect(13-[0,1,2,0,-1,-2][n],24,4,[4,5,6,7,6,5][n],ink)
 a.poly([(7,12+bob),(14,12+bob),(18,26),(3,26)],ink);a.poly([(8,13+bob),(13,13+bob),(15,24),(5,24)],'#4b6564');a.line(8,15,6,23,silver);a.rect(11,15,2,10,'#2c4447');a.rect(5,24,11,2,rust)
 a.rect(8,7+bob,7,7,gold);a.rect(9,7+bob,6,5,white);a.rect(14,9+bob,2,2,ink);a.rect(5,5+bob,12,3,ink);a.rect(7,2+bob,8,5,ink);a.rect(7,4+bob,8,2,slate)
 a.line(13,16+bob,20,17+bob,gold,3);lamp(a,20,21+bob,.65);return a
player().save('sprites/lamplighter/idle.png')
for f in range(6):player(f).save(f'sprites/lamplighter/walk/{f}.png',True)
# Every enemy is hand-shaped in its own silhouette; frame poses articulate wings and feet.
sizes={'moth':20,'bat':20,'rat':24,'gnat':16,'beetle':28,'wisp':20,'spider':28,'crow':24,'shade':32,'hound':36,'mothwing':56,'owl':72,'dark':80}
for name,size in sizes.items():
 for f in range(4):
  a=Art(size,size);s=size/24;phase=[-1,0,1,0][f]
  def poly(p,c):a.poly([(x*s,y*s) for x,y in p],c)
  def ell(x,y,rx,ry,c):a.ellipse(x*s,y*s,rx*s,ry*s,c)
  def line(x,y,xx,yy,c,w=1):a.line(x*s,y*s,xx*s,yy*s,c,max(1,w*s))
  def rect(x,y,w,h,c):a.rect(x*s,y*s,w*s,h*s,c)
  if name in ['moth','mothwing','bat','gnat','owl','crow']:
   bird=name in ['owl','crow'];bat=name=='bat';body=gold if name in ['moth','mothwing'] else slate
   for sign in [-1,1]:
    pts=[(12,10),(12+sign*10,3+phase*2),(12+sign*9,14+phase),(12+sign*5,18),(12,14)]
    if bat:pts=[(12,12),(12+sign*11,4+phase),(12+sign*9,15),(12+sign*6,11),(12+sign*3,16)]
    if name=='gnat':pts=[(12,11),(12+sign*9,6+phase*2),(12+sign*7,13),(12,13)]
    poly(pts,ink);poly([(12+(x-12)*.8,y+1) for x,y in pts],body)
    line(12,12,12+sign*8,7+phase*2,silver if bird else '#f0d59a')
    if name=='mothwing':ell(12+sign*6,11+phase,2.5,3,ink);ell(12+sign*6,11+phase,1,1,gold)
    if bird:
     for j in range(3):line(12+sign*(4+j*2),11,12+sign*(5+j*2),16+phase,ink)
   ell(12,13,3 if not bird else 5,7,ink);ell(12,12,2 if not bird else 4,5,body)
   if name=='owl':ell(9,8,3,3,white);ell(15,8,3,3,white);ell(9,8,1,2,ink);ell(15,8,1,2,ink)
   else:rect(10,8,1,1,white);rect(13,8,1,1,white)
   if not bird:line(10,7,8,3,gold);line(14,7,16,3,gold)
   else:poly([(11,11),(14,11),(12,14)],gold)
  elif name in ['rat','hound']:
   poly([(4,11),(8,8),(17,9),(20,5),(22,11),(23,16),(16,18),(7,17)],ink)
   poly([(5,12),(9,9),(16,11),(20,7),(20,13),(22,15),(15,16),(7,15)],rust if name=='rat' else slate)
   for x in [6,10,16,19]:line(x,16,x+phase*(1 if x%2 else -1),21,ink,2)
   line(4,13,1,9+f,rust);rect(19,11,2,1,'#f3be7c');rect(21,14,2,1,white)
   if name=='hound':poly([(5,8),(10,4),(14,9)],silver);line(8,12,14,13,silver)
  elif name in ['beetle','spider']:
   for side in [-1,1]:
    for j in range(4):line(12+side*4,8+j*3,12+side*9,4+j*5+phase,slate,2);line(12+side*9,4+j*5+phase,12+side*11,7+j*4-phase,ink)
   ell(12,13,6,8,ink);ell(12,12,5,7,rust if name=='beetle' else slate);ell(11,10,3,4,gold if name=='beetle' else silver);line(12,7,12,19,ink);ell(12,5,3,3,ink);rect(10,4,1,1,fire);rect(13,4,1,1,fire)
  else:
   p=[(3,22),(5,13),(7,5),(12,1),(17,5),(19,13),(22,22),(17,20+phase),(14,23),(10,20),(6,23-phase)]
   poly(p,ink);poly([(x*.8+2.4,y*.9+1) for x,y in p],slate if name=='wisp' else dark)
   poly([(8,6),(12,3),(16,6),(17,13),(7,13)],ink)
   rect(8,8,2,1,mint if name=='wisp' else fire);rect(14,8,2,1,mint if name=='wisp' else fire)
   for j in range(3):line(8+j*4,14,6+j*5+phase,21,silver if name=='wisp' else slate)
   if name=='dark':
    for side in [-1,1]:line(12+side*4,6,12+side*8,1,gold);line(12+side*8,1,12+side*10,4,gold)
    ell(12,16,3,3,ink);line(11,16,13,16,fire)
  # A moving glint is part of each pose, distinct even at the same wing extent.
  rect(11+f%2,12+f//2,1,1,white)
  a.save(f'sprites/enemies/{name}/{f}.png',True)
# Basalt cobbles, offset rows: all border cells continue into the next tile.
a=Art(64,64);a.rect(0,0,64,64,'#111e27');rng=random.Random(37)
for row in range(4):
 for col in range(-1,5):
  x=col*16+(row%2)*8;y=row*16
  a.rect(x+1,y+1,14,14,'#15232c');a.line(x+2,y+2,x+13,y+2,'#1b2b34');a.line(x+2,y+3,x+2,y+12,'#192932');a.line(x+3,y+14,x+13,y+14,'#101e27')
  for j in range(5):a.rect(x+rng.randrange(3,13),y+rng.randrange(4,13),1,1,'#192931')
a.save('sprites/ground.png')
for tier,size in [('small',8),('medium',12),('large',16)]:
 a=Art(size,size);c=size/2;a.poly([(c,0),(size-1,c-1),(c,size-1),(0,c)],'#365b68');a.poly([(c,1),(size-2,c),(c,size-2),(2,c)],mint);a.poly([(c,1),(c,size-2),(2,c)],'#68a9a9');a.line(c,2,size-3,c,white);a.save(f'sprites/gems/{tier}.png')
def item(name):
 a=Art(24,24)
 base={'pyre':'taper','beacon':'ember','hail':'pin','chandelier':'lantern','corona':'halo','blaze':'oil-splash'}.get(name,name);evolved=base!=name;c=mint if evolved else gold
 if base=='wick':
  a.rect(4,5,16,3,rust);a.rect(4,18,16,3,rust);a.rect(6,8,12,10,gold)
  for j in range(5):a.line(7,8+j*2,16,9+j*2,white)
  a.line(17,16,21,21,gold)
 elif base=='tallow':
  a.rect(4,12,7,9,gold);a.rect(13,7,7,14,white);a.rect(14,10,2,5,gold);a.poly([(7,12),(5,8),(8,4),(10,9)],fire);a.poly([(16,7),(14,4),(17,0),(19,4)],fire)
 elif base=='tinder':
  a.poly([(3,8),(14,4),(21,10),(20,21),(7,22),(3,18)],rust);a.poly([(5,9),(14,6),(19,11),(9,15)],gold);a.line(9,16,9,20,white);a.line(5,16,16,2,white,2);a.ellipse(16,3,2,3,fire)
 elif base=='glass':
  a.poly([(11,1),(21,14),(16,22),(3,17)],slate);a.poly([(11,2),(12,14),(4,16)],mint);a.poly([(12,14),(20,14),(16,21)],silver);a.line(11,2,16,21,white)
 elif base=='lamp-oil':
  a.rect(5,10,13,11,rust);a.rect(6,11,11,8,gold);a.rect(9,6,6,5,slate);a.line(17,11,22,5,gold,3);a.line(4,11,2,16,rust,2);a.rect(9,13,4,4,white)
 elif base=='oil-splash':
  a.ellipse(11,19,10,3,slate);a.poly([(7,18),(9,9),(12,10),(15,18)],gold);a.rect(9,6,5,3,rust);a.rect(2,12,2,2,gold);a.rect(19,15,2,2,gold)
 elif base=='lantern':lamp(a,12,13)
 elif base in ['taper','wick']:
  a.poly([(8,20),(9,8),(13,7),(15,20)],rust);a.rect(10,8,3,11,white);a.poly([(11,8),(8,5),(12,0),(15,5),(13,8)],c);a.line(6,21,17,21,c)
 elif base in ['ember','tinder']:
  a.poly([(12,1),(18,10),(20,16),(16,21),(7,21),(3,16),(6,9),(8,13)],rust);a.poly([(12,5),(16,14),(14,19),(9,19),(7,15)],c);a.rect(11,13,2,5,white)
 elif base in ['pin','shard']:
  for i in range(3 if base=='pin' else 1):
   o=(i-1)*5 if base=='pin' else 0;a.poly([(17+o,2),(16+o,9),(5+o,21),(7+o,13)],slate);a.line(7+o,17,17+o,3,c)
 elif base in ['halo','flare','lure']:
  a.ring(12,12,8,c);a.ring(12,12,5,rust);a.line(12,1,12,5,white);a.line(12,19,12,23,white);a.line(1,12,5,12,white);a.line(19,12,23,12,white)
  if base=='flare':a.poly([(12,4),(14,10),(20,12),(14,14),(12,20),(10,14),(4,12),(10,10)],white)
  if base=='lure':a.ellipse(12,12,2,2,mint)
 elif base in ['oil','oil-splash','lamp-oil','draft']:
  a.rect(9,2,6,4,rust);a.poly([(9,6),(15,6),(19,13),(18,21),(6,21),(5,13)],slate);a.poly([(7,13),(17,13),(16,19),(8,19)],c);a.rect(8,8,2,4,white)
  if base=='draft':a.line(14,8,11,12,mint);a.line(11,12,15,14,mint)
 elif base=='spark':a.poly([(14,1),(5,13),(11,13),(8,23),(20,9),(13,9)],c);a.line(14,3,8,11,white)
 elif base=='sconce':a.poly([(5,4),(11,7),(17,4),(20,9),(14,13),(11,21),(7,18),(9,11),(3,9)],rust);a.line(5,6,11,9,c);a.line(11,9,18,6,c);a.line(11,9,10,18,white)
 elif base in ['glass','mirror']:
  a.ellipse(12,10,7,9,rust);a.ellipse(12,10,5,7,slate);a.line(9,13,14,5,mint);a.line(12,15,15,10,white);a.rect(10,18,4,5,gold)
 elif base=='brass':a.poly([(3,5),(12,1),(21,5),(19,16),(12,23),(5,16)],rust);a.poly([(6,7),(12,4),(18,7),(16,15),(12,19),(8,15)],gold);a.line(12,5,12,18,white)
 elif base=='bellows':a.poly([(3,9),(11,3),(19,11),(15,17),(8,20),(2,15)],rust);a.poly([(4,10),(11,6),(16,11),(13,15),(7,17)],gold);a.line(16,14,22,20,slate,3);a.line(7,10,12,14,ink)
 elif base=='soot':a.poly([(3,16),(7,10),(11,13),(15,7),(21,15),(19,21),(5,21)],slate);a.line(7,17,11,15,silver);a.ellipse(12,5,2,2,dark)
 elif base=='chest':
  a.rect(3,7,18,14,ink);a.rect(4,8,16,12,rust);a.rect(5,5,14,6,gold);a.rect(7,7,2,13,white);a.rect(16,7,2,13,gold);a.rect(4,12,16,2,ink);a.rect(11,11,3,5,gold)
 elif base=='bread':a.ellipse(12,13,10,7,rust);a.ellipse(11,11,9,6,gold);a.line(6,8,8,12,white,2);a.line(11,7,13,11,white,2);a.line(16,8,18,12,white,2)
 if evolved:
  a.line(2,3,2,7,mint);a.line(0,5,4,5,mint);a.line(21,17,21,23,white);a.line(18,20,23,20,white)
 return a
weapons=['taper','ember','pin','lantern','halo','oil-splash','spark','shard','sconce','flare','pyre','beacon','hail','chandelier','corona','blaze']
for name in weapons+['wick','oil','glass','brass','mirror','bellows','tallow','tinder','soot','lure','lamp-oil']:item(name).save(f'icons/{name}.png')
for name in ['chest','bread','draft']:item(name).save(f'sprites/pickups/{name}.png')
for name in weapons:
 base={'pyre':'taper','beacon':'ember','hail':'pin','chandelier':'lantern','corona':'halo','blaze':'oil-splash'}.get(name,name)
 w,h={'taper':(120,40),'ember':(16,16),'pin':(12,12),'lantern':(28,28),'halo':(160,160),'oil-splash':(100,100),'spark':(80,80),'shard':(16,16),'sconce':(24,24),'flare':(128,128)}[base]
 frames={'spark':4,'sconce':4,'flare':6}.get(base,1)
 for f in range(frames):
  a=Art(w,h);cx=w/2;cy=h/2;c=mint if base!=name else fire
  if base=='taper':
   a.poly([(0,cy),(w*.35,3),(w*.8,1),(w-1,cy),(w*.8,h-2),(w*.35,h-4),(w*.75,h*.65),(w*.85,cy),(w*.7,h*.25)],c)
   a.poly([(0,cy),(w*.6,8),(w*.9,cy),(w*.6,12)],white);a.line(w*.8,3,w-1,cy,white)
  elif base in ['halo','flare']:
   radius=cx-3 if base=='halo' else 8+(cx-12)*(f+1)/frames
   a.ring(cx,cy,radius,c,2);a.ring(cx,cy,radius-4,'#d9a65c44',2)
   for i in range(16):
    angle=i*math.pi/8;a.line(cx+(radius-8)*math.cos(angle),cy+(radius-8)*math.sin(angle),cx+radius*math.cos(angle),cy+radius*math.sin(angle),white if i%2 else c)
  elif base=='oil-splash':
   for radius in range(46,2,-3):
    points=[(cx+math.cos(i*math.pi/16)*(radius+3*math.sin(i*7)),cy+math.sin(i*math.pi/16)*(radius+3*math.sin(i*7))) for i in range(32)]
    a.poly(points,['#b3783e33','#dfb26744','#f1c57355'][radius%3])
   for i in range(13):
    angle=i*2.4;r=10+i*2.5;x=cx+math.cos(angle)*r;y=cy+math.sin(angle)*r;a.poly([(x-2,y+3),(x,y-5),(x+2,y),(x+1,y+3)],c)
  elif base=='spark':
   for i in range(6):
    angle=i*math.pi/3+f*.3;r=12+f*7;a.line(cx,cy,cx+math.cos(angle)*r,cy+math.sin(angle)*r,c,2)
   a.poly([(cx+3,0),(cx-9,cy),(cx+1,cy-4),(cx-5,h-1),(cx+12,cy-9),(cx+3,cy-6)],white)
  elif base=='lantern':
   if name=='chandelier':
    a.ring(cx,cy,13,'#9cddc7aa');a.line(2,18,26,18,gold,2);lamp(a,cx,cy,.8);lamp(a,5,12,.5);lamp(a,23,12,.5)
   else:lamp(a,cx,cy,1.3);a.ring(cx,cy,13,'#f8e8bc55')
  elif base=='sconce':
   for i in range(3):
    angle=f*math.pi/2+i*math.pi*2/3;a.line(cx,cy,cx+math.cos(angle)*10,cy+math.sin(angle)*10,c,3)
   a.ellipse(cx,cy,3,3,white)
  elif base=='pin':a.poly([(0,cy),(w-1,cy-3),(w-3,cy),(w-1,cy+3)],c);a.line(2,cy,w-2,cy,white)
  elif base=='shard':a.poly([(cx,0),(w-2,cy),(cx,h-1),(1,cy)],silver);a.poly([(cx,1),(cx,h-2),(2,cy)],white)
  else:
   a.poly([(0,cy),(cx-3,cy-4),(cx,1),(w-1,cy),(cx,h-2),(cx-3,cy+3)],c);a.ellipse(cx+2,cy,3,2,white)
  a.save(f'sprites/effects/{name}/{f}.png' if frames>1 else f'sprites/effects/{name}.png',frames>1)
for f in range(4):
 a=Art(24,24)
 for i in range(9):
  angle=i*2.4;r=2+f*2.5;a.ellipse(12+math.cos(angle)*r,12+math.sin(angle)*r,max(1,3-f*.5),max(1,3-f*.5),['#d9c994cc','#99b4ad99','#6b929077','#49647444'][f])
 a.save(f'sprites/puff/{f}.png',True)
# Sound design: short glass/wood transients and soft modal bells share the night palette.
for idx,name in enumerate(['hit','kill','gem','hurt','level-up','choose','chest','evolve','pickup','fallen','dawn','menu-move','menu-confirm','hum']):
 path=ROOT/'assets/audio'/f'{name}.wav';path.parent.mkdir(exist_ok=True)
 cfg=TMP/'audio.json';cfg.write_text(json.dumps(dict(sample_rate=22050,channels='mono',max_duration_ms=5000,seed=42,actions=str(TMP/'audio-ops.json'),preview=str(TMP/'audio.png'),wav=str(path))))
 cmd=['sfx-synth','--config',cfg];call(*cmd,'init')
 dur=2400 if name=='hum' else 1500 if name in ['fallen','dawn','evolve'] else 500 if name in ['level-up','chest'] else 160 if name in ['kill','hurt','pickup'] else 80
 freq={'hit':190,'kill':390,'gem':1050,'hurt':92,'level-up':523,'choose':660,'chest':260,'evolve':440,'pickup':780,'fallen':130,'dawn':523,'menu-move':440,'menu-confirm':550,'hum':110}[name]
 call(*cmd,'add-voice','--name','body','--wave','sine' if name!='hurt' else 'triangle','--freq',freq,'--dur',dur,'--gain',-24 if name=='hum' else -16)
 call(*cmd,'set-envelope','--voice','body','--env','swell' if name=='hum' else 'pluck')
 if name!='hum':
  call(*cmd,'set-pitch','--voice','body','--slide-to',freq*(.45 if name in ['fallen','hurt','hit'] else 1.5),'--over',dur)
  call(*cmd,'add-voice','--name','overtone','--wave','sine','--freq',freq*2.003,'--dur',dur*.75,'--gain',-26)
  call(*cmd,'set-envelope','--voice','overtone','--env','pluck')
 call(*cmd,'render')
# 32 seconds: an eight-bar D-minor nocturne, bell ostinato over moving soft bass.
path=ROOT/'assets/audio/music.wav';cfg=TMP/'music.json'
cfg.write_text(json.dumps(dict(sample_rate=22050,channels='stereo',max_duration_ms=36000,seed=42,actions=str(TMP/'music-ops.json'),preview=str(TMP/'music.png'),wav=str(path),mid=str(ROOT/'assets/audio/music.mid'))))
cmd=['music','--config',cfg];call(*cmd,'init');call(*cmd,'set-tempo','--bpm',60)
for name,wave,gain,env in [('bell','sine',-22,'pluck'),('felt','triangle',-28,'swell'),('bass','sine',-24,'swell')]:
 call(*cmd,'define-track','--name',name,'--instrument',wave);call(*cmd,'set-track-fx','--track',name,'--gain',gain,'--env',env)
for bar,root in enumerate([50,46,53,48,50,46,45,50]):
 call(*cmd,'add-note','--track','bass','--pitch',root-12,'--t',bar*4,'--dur',4,'--velocity',70)
 for interval in [0,7,12]:call(*cmd,'add-note','--track','felt','--pitch',root+interval,'--t',bar*4,'--dur',4,'--velocity',60)
 for beat,interval in enumerate([12,19,15,19]):call(*cmd,'add-note','--track','bell','--pitch',root+interval,'--t',bar*4+beat,'--dur',.8,'--velocity',70 if beat%2==0 else 50)
call(*cmd,'render')
print('Produced all art and sound.')
