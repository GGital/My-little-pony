# Builds the diagram HTML files in this folder (drawn with the diagram-design skill conventions).
# Run: python3 docs/diagrams/build.py   then export PNGs with the skill's scripts/export_png.py <file.html> <file.png> 2
import pathlib, html
OUT = pathlib.Path(__file__).resolve().parent  
PAPER='#f5f5f5'; INK='#2d3142'; MUTED='#4f5d75'; SOFT='#5a6580'; ACC='#bf4520'; LINK='#2e5aa8'
MONO="'Geist Mono', monospace"; SANS="'Geist', sans-serif"; SERIF="'Instrument Serif', serif"
def esc(s): return html.escape(s, quote=True)
def W(t): return len(t)  # chars

def label(cx, y_top, text, color=SOFT, anchor='middle', fs=8):
    """mask rect top at y_top, height 12; width from 0.62em mono budget"""
    w = int(len(text)*fs*0.62)+8; w += (-w) % 4
    x = cx - w/2 if anchor=='middle' else cx
    tx = cx if anchor=='middle' else cx + 4
    ta = 'middle' if anchor=='middle' else 'start'
    return (f'<rect x="{x:g}" y="{y_top}" width="{w}" height="12" rx="2" fill="{PAPER}"/>'
            f'<text x="{tx:g}" y="{y_top+9}" fill="{color}" font-size="{fs}" font-family="{MONO}" text-anchor="{ta}" letter-spacing="0.06em">{esc(text)}</text>')

def hline(x1, y, x2, kind='muted'):
    stroke={'muted':MUTED,'link':LINK,'accent':ACC,'ret':MUTED}[kind]
    mk={'muted':'arrow','link':'arrow-link','accent':'arrow-accent','ret':'arrow'}[kind]
    dash=' stroke-dasharray="5,4"' if kind=='ret' else ''
    sw='1.4' if kind=='accent' else '1.2'
    return f'<line x1="{x1}" y1="{y}" x2="{x2}" y2="{y}" stroke="{stroke}" stroke-width="{sw}"{dash} marker-end="url(#{mk})"/>'

def path(d, kind='muted', dash=False):
    stroke={'muted':MUTED,'link':LINK,'accent':ACC}[kind]
    mk={'muted':'arrow','link':'arrow-link','accent':'arrow-accent'}[kind]
    sw='1.4' if kind=='accent' else '1.2'
    da=' stroke-dasharray="5,4"' if dash else ''
    return f'<path d="{d}" fill="none" stroke="{stroke}" stroke-width="{sw}"{da} marker-end="url(#{mk})"/>'

TREAT = {
 'focal':('rgba(191,69,32,0.08)',ACC,''),
 'backend':('#ffffff',INK,''),
 'store':('rgba(45,49,66,0.05)',MUTED,''),
 'input':('rgba(79,93,117,0.10)',SOFT,''),
 'optional':('rgba(45,49,66,0.02)','rgba(45,49,66,0.40)',' stroke-dasharray="4,3"'),
 'terminal':('rgba(45,49,66,0.04)',MUTED,''),
 'reject':('rgba(45,49,66,0.04)',MUTED,' stroke-dasharray="3,3" stroke-width="1.5"'),
}
def node(x,y,w,h,name,sub=None,kind='backend',tag=None,rx=6,ring=False,fs=12):
    fill,stroke,dash=TREAT[kind]
    cx=x+w/2
    s=f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{PAPER}"/>'
    s+=f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="1"{dash}/>'
    if tag:
        tw=int(len(tag)*7*0.62)+10; tw+=(-tw)%4
        tcol = ACC if kind=='focal' else MUTED
        s+=f'<rect x="{x+8}" y="{y+8}" width="{tw}" height="12" rx="2" fill="none" stroke="{tcol}" stroke-opacity="0.45" stroke-width="0.8"/>'
        s+=f'<text x="{x+8+tw/2:g}" y="{y+17}" fill="{tcol}" font-size="7" font-family="{MONO}" text-anchor="middle" letter-spacing="0.08em">{esc(tag)}</text>'
    if ring:
        rc = ACC if kind=='focal' else MUTED
        s+=f'<circle cx="{x+w-16}" cy="{y+16}" r="7" fill="none" stroke="{rc}"/><circle cx="{x+w-16}" cy="{y+16}" r="4" fill="{rc}"/>'
    cy=y+h/2
    ny = cy+(4 if sub is None else 0) + (6 if tag else 0)
    s+=f'<text x="{cx:g}" y="{ny:g}" fill="{INK}" font-size="{fs}" font-weight="600" font-family="{SANS}" text-anchor="middle">{esc(name)}</text>'
    if sub:
        s+=f'<text x="{cx:g}" y="{ny+15:g}" fill="{MUTED}" font-size="8.5" font-family="{MONO}" text-anchor="middle">{esc(sub)}</text>'
    return s

def diamond(cx,cy,hw,hh,name):
    pts=f"{cx},{cy-hh} {cx+hw},{cy} {cx},{cy+hh} {cx-hw},{cy}"
    return (f'<polygon points="{pts}" fill="{PAPER}"/><polygon points="{pts}" fill="#ffffff" stroke="{INK}" stroke-width="1"/>'
            f'<text x="{cx}" y="{cy+4}" fill="{INK}" font-size="11" font-weight="600" font-family="{SANS}" text-anchor="middle">{esc(name)}</text>')

def legend(y, items, vw):
    s=f'<line x1="32" y1="{y-8}" x2="{vw-32}" y2="{y-8}" stroke="rgba(45,49,66,0.10)" stroke-width="0.8"/>'
    s+=f'<text x="32" y="{y+8}" fill="{MUTED}" font-size="8" font-family="{MONO}" letter-spacing="0.18em">LEGEND</text>'
    x=112
    for kind,text in items:
        if kind=='focal': s+=f'<rect x="{x}" y="{y}" width="14" height="10" rx="2" fill="rgba(191,69,32,0.08)" stroke="{ACC}"/>'
        elif kind=='reject': s+=f'<rect x="{x}" y="{y}" width="14" height="10" rx="2" fill="rgba(45,49,66,0.04)" stroke="{MUTED}" stroke-dasharray="3,3"/>'
        elif kind=='terminal': s+=f'<rect x="{x}" y="{y}" width="14" height="10" rx="2" fill="rgba(45,49,66,0.04)" stroke="{MUTED}"/>'
        elif kind=='optional': s+=f'<rect x="{x}" y="{y}" width="14" height="10" rx="2" fill="none" stroke="rgba(45,49,66,0.40)" stroke-dasharray="4,3"/>'
        elif kind=='decision': s+=f'<polygon points="{x+7},{y-1} {x+14},{y+5} {x+7},{y+11} {x},{y+5}" fill="#fff" stroke="{INK}"/>'
        elif kind=='backend': s+=f'<rect x="{x}" y="{y}" width="14" height="10" rx="2" fill="#fff" stroke="{INK}"/>'
        elif kind=='store': s+=f'<rect x="{x}" y="{y}" width="14" height="10" rx="2" fill="rgba(45,49,66,0.05)" stroke="{MUTED}"/>'
        else:
            s+={'link':hline(x,y+5,x+28,'link'),'ret':hline(x,y+5,x+28,'ret'),'accent':hline(x,y+5,x+28,'accent'),'muted':hline(x,y+5,x+28,'muted')}[kind]
            x+=14
        s+=f'<text x="{x+20}" y="{y+8}" fill="{MUTED}" font-size="8.5" font-family="{SANS}">{esc(text)}</text>'
        x+= 20 + int(len(text)*8.5*0.6) + 36
    return s

DEFS=f'''<defs>
<marker id="arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="{MUTED}"/></marker>
<marker id="arrow-accent" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="{ACC}"/></marker>
<marker id="arrow-link" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="{LINK}"/></marker>
</defs>'''

def page(slug, eyebrow, h1, title, desc, vw, vh, body):
    svg=(f'<svg viewBox="0 0 {vw} {vh}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="{slug}-title {slug}-desc">'
         f'<title id="{slug}-title">{esc(title)}</title><desc id="{slug}-desc">{esc(desc)}</desc>{DEFS}'
         f'<rect width="100%" height="100%" fill="{PAPER}"/>{body}</svg>')
    doc=f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc(h1)} · {esc(eyebrow.split(' · ')[0])}</title>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:'Geist',system-ui,sans-serif;background:{PAPER};color:{INK};min-height:100vh;display:flex;align-items:center;justify-content:center;padding:3rem 2rem}}
.frame{{max-width:1100px;width:100%}}
.eyebrow{{font-family:'Geist Mono',ui-monospace,monospace;font-size:.66rem;font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:{MUTED};margin-bottom:.5rem}}
h1{{font-family:'Instrument Serif',serif;font-size:clamp(1.5rem,2.4vw + .75rem,2rem);font-weight:400;letter-spacing:-.02em;line-height:1.15;margin-bottom:1.5rem}}
.diagram-container{{overflow-x:auto}}
svg{{width:100%;min-width:{vw}px;display:block}}
@media print{{.diagram-container{{overflow:visible}}}}
</style>
</head>
<body>
<div class="frame">
<p class="eyebrow">{esc(eyebrow)}</p>
<h1>{esc(h1)}</h1>
<div class="diagram-container">
{svg}
</div>
</div>
</body>
</html>
'''
    (OUT/f'{slug}.html').write_text(doc)

# ---------------- shared sequence helpers
def lifeline(x, top, bot): return f'<line x1="{x}" y1="{top}" x2="{x}" y2="{bot}" stroke="rgba(45,49,66,0.22)" stroke-width="1" stroke-dasharray="3,3"/>'
def act(x, y1, y2): return f'<rect x="{x-4}" y="{y1}" width="8" height="{y2-y1}" fill="rgba(45,49,66,0.06)" stroke="{MUTED}" stroke-width="0.8"/>'
def phase(y, text): return f'<text x="24" y="{y}" fill="{MUTED}" font-size="7.5" font-family="{MONO}" letter-spacing="0.14em">{esc(text)}</text>'
def sep(y, vw): return f'<line x1="24" y1="{y}" x2="{vw-24}" y2="{y}" stroke="rgba(45,49,66,0.08)" stroke-width="0.8"/>'

# ================= 1. Sequence: register with last-seat race
vw,vh=960,620
A,B,API,DB=136,316,580,836
b=[]
for x in (A,B,API,DB): b.append(lifeline(x,112,520))
b+= [act(API,144,488), act(DB,268,344), act(DB,412,456)]
msgs=[]
# m1 A -> API
msgs.append(hline(A,152,API-4,'link')+label((A+B)/2,134,'POST REGISTER',LINK))
msgs.append(hline(B,184,API-4,'link')+label((B+API)/2,166,'POST REGISTER',LINK))
# self check
msgs.append(path(f'M{API+4} 212 H{API+36} Q{API+44} 212 {API+44} 220 V228 Q{API+44} 236 {API+36} 236 H{API+6}','muted')
            + label(API+52,218,'SESSION + ROLE',SOFT,'start'))
msgs.append(hline(API+4,276,DB-4,'muted')+label((API+DB)/2,258,'A · LOCK EVENT'))
msgs.append(hline(DB-4,308,API+6,'ret')+label((API+DB)/2,290,'23 / 24 ACTIVE'))
msgs.append(hline(API+4,340,DB-4,'muted')+label((API+DB)/2,322,'INSERT · COMMIT'))
msgs.append(hline(API-4,372,A+4,'accent')+label((A+B)/2,354,'201 CREATED',ACC))
msgs.append(hline(API+4,420,DB-4,'muted')+label((API+DB)/2,402,'B · LOCK EVENT'))
msgs.append(hline(DB-4,452,API+6,'ret')+label((API+DB)/2,434,'24 / 24 ACTIVE'))
msgs.append(hline(API-4,484,B+4,'ret')+label((B+API)/2,466,'409 EVENT_FULL'))
b+=msgs
# callout
b.append(f'<text x="{B+24}" y="408" fill="{MUTED}" font-size="14" font-style="italic" font-family="{SERIF}">B waits on the same row lock</text>')
b.append(f'<text x="{B+24}" y="426" fill="{MUTED}" font-size="14" font-style="italic" font-family="{SERIF}">until A commits — no overbooking.</text>')
# actors
b.append(node(A-72,56,144,56,'Player A','browser · UI','input','PLAYER'))
b.append(node(B-72,56,144,56,'Player B','browser · UI','input','PLAYER'))
b.append(node(API-72,56,144,56,'Event API','/api/events/:id/…','focal','API'))
b.append(node(DB-72,56,144,56,'PostgreSQL','events · registrations','store','DB'))
b.append(legend(560,[('link','HTTP call'),('ret','Return'),('muted','Database call'),('accent','Headline success'),('focal','Rule enforced here')],vw))
page('seq-register','Sequence · TCG Event Hub · FR-15, BR-05–BR-07','Two players, one last seat',
     'Registering for the last seat',
     'Two players request the last seat of an event at the same moment; the API locks the event row, so Player A gets 201 Created and Player B, after waiting for the lock, gets 409 Event full.',
     vw,vh,''.join(b))

# ================= 2. Sequence: sign in / me / sign out / reuse
vw,vh=960,660
BR,AP,ST=184,500,816
b=[lifeline(x,112,600) for x in (BR,AP,ST)]
b+=[act(AP,148,268),act(AP,308,380),act(AP,420,492),act(AP,532,564)]
for y,t in ((144,'SIGN IN'),(304,'WHO AM I'),(416,'SIGN OUT'),(528,'OLD COOKIE')): b.append(phase(y,t))
for y in (288,400,512): b.append(sep(y,vw))
b.append(hline(BR,152,AP-4,'link')+label((BR+AP)/2,134,'POST /LOGIN',LINK))
b.append(path(f'M{AP+4} 180 H{AP+36} Q{AP+44} 180 {AP+44} 188 V196 Q{AP+44} 204 {AP+36} 204 H{AP+6}','muted')+label(AP+52,186,'VERIFY BCRYPT',SOFT,'start'))
b.append(hline(AP+4,236,ST-4,'muted')+label((AP+ST)/2,218,'CREATE SESSION'))
b.append(hline(AP-4,264,BR+4,'accent')+label((BR+AP)/2,246,'200 SET-COOKIE',ACC))
b.append(hline(BR,316,AP-4,'link')+label((BR+AP)/2,298,'GET /ME',LINK))
b.append(hline(AP+4,344,ST-4,'muted')+label((AP+ST)/2,326,'FIND SESSION'))
b.append(hline(AP-4,376,BR+4,'ret')+label((BR+AP)/2,358,'200 · USER'))
b.append(hline(BR,428,AP-4,'link')+label((BR+AP)/2,410,'POST /LOGOUT',LINK))
b.append(hline(AP+4,456,ST-4,'muted')+label((AP+ST)/2,438,'DELETE SESSION'))
b.append(hline(AP-4,488,BR+4,'ret')+label((BR+AP)/2,470,'204 · CLEAR'))
b.append(hline(BR,540,AP-4,'link')+label((BR+AP)/2,522,'GET /ME · OLD',LINK))
b.append(hline(AP-4,564,BR+4,'ret')+label((BR+AP)/2,546,'401 · NO DATA'))
b.append(f'<text x="{AP+24}" y="552" fill="{MUTED}" font-size="14" font-style="italic" font-family="{SERIF}">Session row is gone, so the old</text>')
b.append(f'<text x="{AP+24}" y="570" fill="{MUTED}" font-size="14" font-style="italic" font-family="{SERIF}">cookie opens nothing.</text>')
b.append(node(BR-72,56,144,56,'Browser','HttpOnly cookie','input','UI'))
b.append(node(AP-72,56,144,56,'Auth API','/api/auth/*','focal','API'))
b.append(node(ST-72,56,144,56,'Session store','PostgreSQL · 8 h','store','DB'))
b.append(legend(612,[('link','HTTP call'),('ret','Return'),('muted','Database call'),('accent','Session issued'),('focal','Checks every request')],vw))
page('seq-auth','Sequence · TCG Event Hub · FR-01–FR-04, NFR-04','Sign in, who am I, sign out',
     'Session lifecycle: sign in to sign out',
     'A browser signs in and receives an HttpOnly session cookie, reads the current user, signs out so the server deletes the session, and a request with the old cookie is rejected with 401.',
     vw,vh,''.join(b))

# ================= 3. Activity (swimlane): registration
vw,vh=1000,580
b=[]
lanes=[(64,'PLAYER'),(184,'WEB UI'),(288,'API'),(392,'DATABASE'),(496,None)]
for i,(y,_) in enumerate(lanes):
    strong = i in (0,len(lanes)-1)
    b.append(f'<line x1="32" y1="{y}" x2="{vw-32}" y2="{y}" stroke="rgba(45,49,66,{0.22 if strong else 0.10})" stroke-width="1"/>')
b.append(f'<line x1="152" y1="64" x2="152" y2="496" stroke="rgba(45,49,66,0.22)" stroke-width="1"/>')
for (y,t),(y2,_) in zip(lanes,lanes[1:]):
    b.append(f'<text x="48" y="{(y+y2)/2+3:g}" fill="{MUTED}" font-size="9" font-family="{MONO}" letter-spacing="0.18em">{t}</text>')
# arrows first
b.append(path('M244 164 V228 Q244 236 252 236 H324'))                                   # P1 -> U1
b.append(path('M380 204 V148 Q380 140 388 140 H460')+label(388,166,'NO',SOFT,'start'))  # U1 no -> P2
b.append(path('M524 116 V108 Q524 100 516 100 H252 Q244 100 244 108 V116',dash=True)+label(384,82,'BACK TO EVENT'))
b.append(path('M380 268 V332 Q380 340 388 340 H460')+label(388,300,'YES',SOFT,'start'))
b.append(hline(588,340,628)+label(608,322,'OK'))
b.append(path('M548 316 V244 Q548 236 556 236 H620')+label(556,262,'401 / 403',SOFT,'start'))
b.append(f'<line x1="684" y1="312" x2="684" y2="260" stroke="{MUTED}" stroke-width="1.2" marker-end="url(#arrow)"/>'+label(692,290,'CLOSED',SOFT,'start'))
b.append(f'<line x1="684" y1="368" x2="684" y2="420" stroke="{MUTED}" stroke-width="1.2" marker-end="url(#arrow)"/>'+label(692,382,'OPEN',SOFT,'start'))
b.append(path('M748 432 H772 Q780 432 780 424 V252 Q780 244 772 244 H748')+label(788,300,'FULL / DUP',SOFT,'start'))
b.append(hline(748,456,812)+label(780,438,'SEAT FREE'))
b.append(f'<line x1="876" y1="420" x2="876" y2="260" stroke="{ACC}" stroke-width="1.4" marker-end="url(#arrow-accent)"/>'+label(884,330,'201 CREATED',ACC,'start'))
# nodes
b.append(node(180,116,128,48,'Open event','click Register'))
b.append(node(460,116,128,48,'Sign in','/login?returnTo'))
b.append(diamond(380,236,56,32,'Signed in?'))
b.append(node(620,212,128,48,'Show reason','alert · nothing saved','reject'))
b.append(node(812,212,128,48,'Show Registered','✓ seats updated','focal'))
b.append(node(460,316,128,48,'Check role','session · PLAYER'))
b.append(diamond(684,340,56,28,'Event open?'))
b.append(node(620,420,128,48,'Seat check','row lock · count · dup','store'))
b.append(node(812,420,128,48,'Save registration','REGISTERED · commit','store'))
b.append(legend(528,[('backend','Action'),('decision','Decision'),('store','In one DB transaction'),('reject','Rejected, no change'),('accent','Success path')],vw))
page('activity-register','Activity · TCG Event Hub · FR-15, FR-16, FR-26','Registering for an event',
     'Registration activity across player, UI, API and database',
     'A player opens an event and clicks Register; a signed-out player signs in and returns; the API checks the role, whether the event is open, and seats and duplicates under a row lock, then saves the registration or shows the rejection reason.',
     vw,vh,''.join(b)) 

# ================= 4. State: Registration
vw,vh=860,520
b=[]
b.append(hline(62,208,120,'accent')+label(91,190,'REGISTER',ACC))
b.append(hline(280,196,480)+label(380,178,'CHECK IN'))
b.append(hline(480,220,280)+label(380,226,'UNDO'))
b.append(path('M248 240 V272 Q248 280 256 280 H392 Q400 280 400 288 V328 Q400 336 408 336 H480')+label(408,300,'EVENT ENDS',SOFT,'start'))
b.append(f'<line x1="200" y1="240" x2="200" y2="336" stroke="{MUTED}" stroke-width="1.2" marker-end="url(#arrow)"/>'+label(150,282,'CANCEL'))
b.append(f'<line x1="200" y1="176" x2="200" y2="112" stroke="{MUTED}" stroke-width="1.2" marker-end="url(#arrow)"/>'+label(150,138,'CANCEL EVENT'))
b.append(hline(640,208,736)+label(688,190,'EVENT ENDS'))
b.append(f'<circle cx="56" cy="208" r="6" fill="{INK}"/>')
b.append(f'<circle cx="748" cy="208" r="10" fill="none" stroke="{INK}"/><circle cx="748" cy="208" r="6" fill="{INK}"/>')
b.append(f'<text x="764" y="211" fill="{MUTED}" font-size="8.5" font-family="{MONO}">attended</text>')
b.append(node(120,176,160,64,'Registered','holds a seat · S1','focal',rx=8))
b.append(node(480,176,160,64,'Checked in','holds a seat · S3',rx=8))
b.append(node(480,304,160,64,'No-show','reported after end · S3','optional',rx=8,ring=True))
b.append(node(120,336,160,64,'Cancelled','by player · S2','terminal',rx=8,ring=True))
b.append(node(120,48,160,64,'Event cancelled','by organizer · S2','terminal',rx=8,ring=True))
# guards note
b.append(f'<text x="480" y="416" fill="{MUTED}" font-size="14" font-style="italic" font-family="{SERIF}">Register needs a free seat and no other</text>')
b.append(f'<text x="480" y="434" fill="{MUTED}" font-size="14" font-style="italic" font-family="{SERIF}">active registration. Check-in and undo only</text>')
b.append(f'<text x="480" y="452" fill="{MUTED}" font-size="14" font-style="italic" font-family="{SERIF}">inside the window (BR-05, BR-06, BR-18).</text>')
b.append(legend(480,[('focal','Sprint 1 state'),('backend','Active state'),('terminal','Terminal'),('optional','Derived in reports')],vw))
page('state-registration','State machine · TCG Event Hub · BR-05–BR-12, BR-18–BR-20','Life of a registration',
     'Registration state machine',
     'A registration starts as Registered and can become Checked in (with undo), Cancelled by the player, Event cancelled by the organizer, or reported as a No-show when the event ends without check-in.',
     vw,vh,''.join(b))

# ================= 5. State: Event (lifecycle phase map)
vw,vh=1000,448
b=['<g transform="translate(0,-112)">']
b.append(f'<rect x="24" y="376" width="952" height="112" rx="8" fill="rgba(45,49,66,0.035)" stroke="rgba(45,49,66,0.12)"/>')
b.append(f'<text x="40" y="188" fill="{MUTED}" font-size="8" font-family="{MONO}" letter-spacing="0.14em">PRIMARY PHASES</text>')
b.append(f'<text x="40" y="396" fill="{MUTED}" font-size="8" font-family="{MONO}" letter-spacing="0.14em">TERMINAL OUTCOME</text>')
b.append(hline(66,236,112)+label(89,218,'CREATE'))
b.append(path('M56 242 V292 Q56 300 64 300 H376 Q384 300 384 292 V276','accent')+label(220,282,'CREATE+PUBLISH',ACC))
b.append(hline(264,236,336)+label(300,218,'PUBLISH'))
b.append(path('M392 200 V180 Q392 172 400 172 H424 Q432 172 432 180 V200',dash=True)+label(412,154,'EDIT'))
b.append(hline(488,236,560)+label(524,218,'START'))
b.append(hline(712,236,784)+label(748,218,'END TIME'))
b.append(f'<line x1="448" y1="276" x2="448" y2="400" stroke="{MUTED}" stroke-width="1.2" marker-end="url(#arrow)"/>'+label(456,330,'CANCEL',SOFT,'start'))
b.append(f'<circle cx="56" cy="236" r="6" fill="{INK}"/>')
b.append(node(112,200,152,72,'Draft','hidden · S2',rx=8,tag='S2'))
b.append(node(336,200,152,72,'Published','visible · registrable','focal',rx=8,tag='S1'))
b.append(node(560,200,152,72,'In progress','check-in open · S3','optional',rx=8,tag='TIME'))
b.append(node(784,200,152,72,'Ended','attendance report · S3','optional',rx=8,tag='TIME',ring=True))
b.append(node(372,400,152,72,'Cancelled','all regs cancelled · S2','terminal',rx=8,ring=True,tag='S2'))
b.append(f'<text x="560" y="424" fill="{MUTED}" font-size="14" font-style="italic" font-family="{SERIF}">Cancel and edit only before the start time.</text>')
b.append(f'<text x="560" y="442" fill="{MUTED}" font-size="14" font-style="italic" font-family="{SERIF}">"In progress" and "Ended" come from the clock,</text>')
b.append(f'<text x="560" y="460" fill="{MUTED}" font-size="14" font-style="italic" font-family="{SERIF}">not a stored status (NFR-11).</text>')
b.append(legend(520,[('focal','Sprint 1 state'),('backend','Stored status'),('optional','Derived from time'),('terminal','Terminal'),('accent','Sprint 1 path')],vw)+'</g>')
page('state-event','State machine · TCG Event Hub · FR-06, FR-08–FR-10, BR-15','Life of an event',
     'Event lifecycle',
     'An event is created as Draft or straight to Published, can be edited or cancelled before it starts, then moves by the clock to In progress and Ended; Cancelled is the terminal outcome.',
     vw,vh,''.join(b))
print('ok')
