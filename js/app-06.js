/* Oti Hybrid Coach, GitHub version. Generated from the claude.ai artifact v67 by tools/build_from_v67.py.
   db, mcp and sample are provided by api.js (Google Apps Script backend).
   The code is split into several classic scripts that share one global scope; load them in order. */
const DE_PREFIX = [["Up to date. Newest file: ","Aktuell. Neueste Datei: "],["Import failed: ","Import fehlgeschlagen: "],["Health file couldn't be read: ","Gesundheitsdatei konnte nicht gelesen werden: "],["All day: ","Ganztägig: "],["Wake early for ","Früh aufstehen für "]];


/* ================= Rule of Life + music habits (app/habits doc; daily ticks in log.days.<date>.hab) ================= */
// Stable ids, never index based. No streaks for spiritual practices: the page shows "x of y this week" and a 4 week dot grid.
const HABITS_VERSION = 1;
const DEFAULT_HABITS = {
  version: HABITS_VERSION,
  start: "2026-09-29",                                 // tracking starts here; nothing before counts
  evening: {time:"22:45", latest:"23:15", days:[0,1,2,3,4]},           // Sun to Thu; Fri (youth) and Sat excluded
  sabbath: {dow:0, start:"13:00", hours:12},            // Sunday after church, 12 hours
  music: {songPerWeek:2, songMinMin:60, reelsPerWeek:2, filmPerWeek:1, goal:{count:3, stage:4, by:"2026-12-20"}},
  musicPlan: {weekly:[{id:"w-sat-song", dow:6, time:"09:00", kind:"song", min:120, skipIld:true}], dates:{}},
  songs: [],
  focus: {text:"", startBpm:null, targetBpm:null, from:null},
  prompts: {},   // prompt id -> array of done dates
  fruit: {}      // Monday date of the week -> {irr:1..5, note}
};
let habits = structuredClone(DEFAULT_HABITS), lifeSeg = "spirit";
try{ const s = sessionStorage.getItem("ohc-lifeseg"); if(s) lifeSeg = s; }catch(e){}
const L = (en, de) => LANG==="de" ? de : en;
const STAGES = [["Idea","Idee"],["Written","Geschrieben"],["Raw demo","Rohdemo"],["Drum demo","Drum Demo"],["Electric guitar demo","E Gitarren Demo"],["Produced","Produziert"],["Released","Veröffentlicht"]];
function mergeHabits(h){
  const x = {...structuredClone(DEFAULT_HABITS), ...JSON.parse(JSON.stringify(h))};
  for(const g of ["evening","sabbath","music","musicPlan","focus"]) x[g] = {...DEFAULT_HABITS[g], ...(x[g]||{})};
  x.music.goal = {...DEFAULT_HABITS.music.goal, ...(x.music.goal||{})};
  x.noFast = Array.isArray(x.noFast) ? x.noFast : []; x.songs = Array.isArray(x.songs) ? x.songs : []; x.prompts = x.prompts||{}; x.fruit = x.fruit||{}; x.musicPlan.dates = x.musicPlan.dates||{};
  return x;
}
const hab = k => { const D = logData.days[k] = logData.days[k]||{}; D.hab = D.hab||{}; return D.hab; };
const habOf = k => logData.days[k]?.hab || {};
const started = k => k >= (habits.start||"0000");
const isEveningDay = d => habits.evening.days.includes(d.getDay()) && started(dateKey(d));
const weekDays = mon => [...Array(7)].map((_,i)=>addDays(mon,i));
const fmtDate = (k, opt) => fromKey(k).toLocaleDateString(LANG==="de"?"de-DE":"en-GB", opt||{day:"numeric",month:"short"});
const uid = () => Math.random().toString(36).slice(2,9);
async function saveHabits(){ await saveDoc("habits", habits); }
async function saveLogH(){ await saveDoc("log", logData); }

/* ---------- music plan ---------- */
function musicPlanned(date){
  const k = dateKey(date), out = [];
  for(const w of habits.musicPlan.weekly||[]){ if(w.dow!==date.getDay()) continue; if(w.skipIld && isILD(date)) continue; if((habits.musicPlan.skip||[]).includes(k+"|"+w.id)) continue; out.push({...w, weekly:true}); }
  for(const p of habits.musicPlan.dates[k]||[]) out.push(p);
  return out.sort((a,b)=>a.time<b.time?-1:1);
}
const KIND = {song:["Song pipeline","Song Pipeline"], reels:["Drum reels","Drum Reels"]};
function musicWeek(mon){
  let song=0, songMin=0, reels=0, reelsMin=0, film=0, stageMoves=0;
  for(const d of weekDays(mon)){ if(!started(dateKey(d))) continue; for(const s of habOf(dateKey(d)).mu||[]){
    if(s.kind==="song"){ if(s.min>=habits.music.songMinMin) song++; songMin+=s.min||0; if(s.stage) stageMoves++; }
    else { reels++; reelsMin+=s.min||0; if(s.filmed) film++; } } }
  return {song, songMin, reels, reelsMin, film, stageMoves};
}

/* ---------- spiritual counts ---------- */
function eveningWeek(mon){ const ds = weekDays(mon).filter(isEveningDay); const today = dateKey(new Date());
  return {n: ds.filter(d=>habOf(dateKey(d)).ev).length, of: ds.length, sofar: ds.filter(d=>dateKey(d)<=today).length}; }
function dotsHtml(){
  const mon0 = mondayOf(new Date()), today = dateKey(new Date());
  let h = `<div class="pw-dh">${[1,2,3,4,5,6,0].map(i=>`<span>${L(SHORT[i],["So","Mo","Di","Mi","Do","Fr","Sa"][i])}</span>`).join("")}</div>`;
  for(let w=3; w>=0; w--){ const mon = addDays(mon0,-7*w);
    h += `<div class="pw-dots">${weekDays(mon).map(d=>{ const k = dateKey(d); if(!isEveningDay(d)) return `<span class="off" title="${k}"></span>`;
      return `<span class="${habOf(k).ev?"on":""} ${k===today?"today":""}" title="${k}"></span>`; }).join("")}</div>`; }
  return `<div style="display:grid;gap:5px">${h}</div>`;
}
function promptDone(id, period){ // period: "month" | "season" | "year"
  const now = new Date(), list = habits.prompts[id]||[];
  const same = k => { const d = fromKey(k); if(period==="year") return d.getFullYear()===now.getFullYear();
    if(period==="season") return d.getFullYear()===now.getFullYear() && Math.floor(d.getMonth()/3)===Math.floor(now.getMonth()/3);
    return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth(); };
  return {done: list.some(same), last: list.slice().sort().pop()};
}

/* ---------- content ---------- */
const V = {
  mt11:{ref:["Matthew 11:28 to 30","Mt 11,28 bis 30"], bs:"Mt11,28-30", en:"Come to me, all you who labor and are heavily burdened, and I will give you rest. Take my yoke upon you, and learn from me, for I am gentle and humble in heart; and you will find rest for your souls. For my yoke is easy, and my burden is light.", de:"Kommet her zu mir alle, die ihr mühselig und beladen seid; ich will euch erquicken. Nehmet auf euch mein Joch und lernet von mir; denn ich bin sanftmütig und von Herzen demütig; so werdet ihr Ruhe finden für eure Seelen. Denn mein Joch ist sanft, und meine Last ist leicht."},
  ps46:{ref:["Psalm 46:10","Psalm 46,11"], bs:"Ps46,11", en:"Be still, and know that I am God.", de:"Seid stille und erkennet, daß ich GOTT bin."},
  is30:{ref:["Isaiah 30:15","Jesaja 30,15"], bs:"Jes30,15", en:"You will be saved in returning and rest. Your strength will be in quietness and in confidence.", de:"Wenn ihr umkehrtet und stillebliebet, so würde euch geholfen; durch Stillesein und Hoffen würdet ihr stark sein."},
  jas1:{ref:["James 1:19 to 20","Jakobus 1,19 bis 20"], bs:"Jak1,19-20", en:"Let every man be swift to hear, slow to speak, and slow to anger; for the anger of man doesn't produce the righteousness of God.", de:"Ein jeglicher Mensch sei schnell, zu hören, langsam aber, zu reden, und langsam zum Zorn. Denn des Menschen Zorn tut nicht, was vor Gott recht ist."},
  eph4:{ref:["Ephesians 4:31 to 32","Epheser 4,31 bis 32"], bs:"Eph4,31-32", en:"Let all bitterness, wrath, anger, outcry, and slander, be put away from you, with all malice. And be kind to one another, tender hearted, forgiving each other, just as God also in Christ forgave you.", de:"Alle Bitterkeit und Grimm und Zorn und Geschrei und Lästerung sei ferne von euch samt aller Bosheit. Seid aber untereinander freundlich, herzlich und vergebet einer dem andern, gleichwie Gott euch auch vergeben hat in Christo."},
  gal5:{ref:["Galatians 5:22 to 23","Galater 5,22 bis 23"], bs:"Gal5,22-23", en:"But the fruit of the Spirit is love, joy, peace, patience, kindness, goodness, faith, gentleness, and self-control. Against such things there is no law.", de:"Die Frucht aber des Geistes ist Liebe, Freude, Friede, Geduld, Freundlichkeit, Gütigkeit, Glaube, Sanftmut, Keuschheit. Wider solche ist das Gesetz nicht."},
  php2:{ref:["Philippians 2:3 to 4","Philipper 2,3 bis 4"], bs:"Phil2,3-4", en:"Doing nothing through rivalry or through conceit, but in humility, each counting others better than himself; each of you not just looking to his own things, but each of you also to the things of others.", de:"Nichts tut durch Zank oder eitle Ehre; sondern durch Demut achte einer den andern höher denn sich selbst, und ein jeglicher sehe nicht auf das Seine, sondern auch auf das, was des andern ist."},
  mt6a:{ref:["Matthew 6:3 to 4","Mt 6,3 bis 4"], bs:"Mt6,3-4", en:"When you do merciful deeds, don't let your left hand know what your right hand does, so that your merciful deeds may be in secret, then your Father who sees in secret will reward you openly.", de:"Wenn du aber Almosen gibst, so laß deine linke Hand nicht wissen, was die rechte tut, auf daß dein Almosen verborgen sei; und dein Vater, der in das Verborgene sieht, wird dir's vergelten öffentlich."},
  mt6b:{ref:["Matthew 6:17 to 18","Mt 6,17 bis 18"], bs:"Mt6,17-18", en:"When you fast, anoint your head, and wash your face; so that you are not seen by men to be fasting, but by your Father who is in secret, and your Father, who sees in secret, will reward you.", de:"Wenn du aber fastest, so salbe dein Haupt und wasche dein Angesicht, auf daß du nicht scheinest vor den Leuten mit deinem Fasten, sondern vor deinem Vater, welcher verborgen ist; und dein Vater, der in das Verborgene sieht, wird dir's vergelten öffentlich."},
  ps4:{ref:["Psalm 4:8","Psalm 4,9"], bs:"Ps4,9", en:"In peace I will both lay myself down and sleep, for you, Yahweh alone, make me live in safety.", de:"Ich liege und schlafe ganz mit Frieden; denn allein du, HERR, hilfst mir, daß ich sicher wohne."},
  ps139:{ref:["Psalm 139:23 to 24","Psalm 139,23 bis 24"], bs:"Ps139,23-24", en:"Search me, God, and know my heart. Try me, and know my thoughts. See if there is any wicked way in me, and lead me in the everlasting way.", de:"Erforsche mich, Gott, und erfahre mein Herz; prüfe mich und erfahre, wie ich's meine. Und siehe, ob ich auf bösem Wege bin, und leite mich auf ewigem Wege."},
  pe5:{ref:["1 Peter 5:7","1. Petrus 5,7"], bs:"1Petr5,7", en:"Casting all your worries on him, because he cares for you.", de:"Alle Sorge werfet auf ihn; denn er sorgt für euch."},
  mk2:{ref:["Mark 2:27","Markus 2,27"], bs:"Mk2,27", en:"The Sabbath was made for man, not man for the Sabbath.", de:"Der Sabbat ist um des Menschen willen gemacht, und nicht der Mensch um des Sabbat willen."},
  pr27:{ref:["Proverbs 27:17","Sprüche 27,17"], bs:"Spr27,17", en:"Iron sharpens iron; so a man sharpens his friend's countenance.", de:"Ein Messer wetzt das andere und ein Mann den andern."}
};
const verse = (id, c) => { const v = V[id]; return `<div class="pw-verse" ${c?`style="--c:var(${c})"`:""}><q>${esc(L(v.en,v.de))}</q><span class="ref">${esc(L(v.ref[0],v.ref[1]))} · <a href="https://www.bibleserver.com/${L("ESV","LUT")}/${v.bs}" target="_blank" rel="noopener">${L("read in context","im Zusammenhang lesen")}</a></span></div>`; };
const LECTIO = {web:"https://lectio365.com/", app:"https://apps.apple.com/de/app/lectio-365-daily-bible-prayer/id1483974820"};
const PRAYERS = [
  {id:"evening", t:["The Evening Rhythm, guided","Der Abendrhythmus, geführt"], s:["About 10 minutes, Sunday to Thursday","Etwa 10 Minuten, Sonntag bis Donnerstag"], body:()=>`
    <p><b>${L("1. Phone away.","1. Handy weg.")}</b> ${L("It charges outside the bedroom. If you need it for Lectio, open the app, then put it face down and on Do Not Disturb.","Es lädt außerhalb vom Schlafzimmer. Wenn du es für Lectio brauchst: App öffnen, dann umdrehen und Nicht stören an.")}</p>
    <p><b>${L("2. Arrive.","2. Ankommen.")}</b> ${L("Three slow breaths. Breathe in:","Drei langsame Atemzüge. Einatmen:")} <em>${L("Jesus,","Jesus,")}</em> ${L("breathe out:","ausatmen:")} <em>${L("teach me Your unhurried way.","lehre mich Dein unhastiges Tempo.")}</em></p>
    <p><b>${L("3. Lectio 365 Evening.","3. Lectio 365 am Abend.")}</b> ${L("Let the app lead you through it.","Lass dich von der App führen.")}</p>
    <p><b>${L("4. Review the day with God.","4. Den Tag mit Gott anschauen.")}</b> ${L("Gift: where did I receive love today? Say thank you. Weight: what is heavy? Name it and hand it over. Mirror: where was I selfish or sharp today? Say it plainly, receive forgiveness, and if someone was hurt, decide on one small repair for tomorrow.","Geschenk: Wo habe ich heute Liebe empfangen? Danke sagen. Last: Was ist schwer? Benennen und abgeben. Spiegel: Wo war ich heute selbstbezogen oder scharf? Ehrlich aussprechen, Vergebung annehmen, und wenn jemand verletzt wurde, eine kleine Wiedergutmachung für morgen festlegen.")}</p>
    ${verse("ps139","--pw-prayer")}
    <p><b>${L("5. Close.","5. Abschluss.")}</b> <em>${L("Father, into Your hands I put this day, what went well and what did not. Keep watch over the people I love. I lie down in Your peace.","Vater, in Deine Hände lege ich diesen Tag, das Gelungene und das Misslungene. Wache über die Menschen, die ich liebe. Ich lege mich in Deinen Frieden.")}</em></p>
    ${verse("ps4","--pw-prayer")}`},
  {id:"breath", t:["Breath prayer for hurried moments","Atemgebet, wenn es eng wird"], s:["When you feel hurried or irritated inside","Wenn du innerlich gehetzt oder gereizt bist"], body:()=>`
    <p>${L("Breathe in for four, out for six. Pray the first half on the in breath, the second half on the out breath. Five rounds are enough.","Vier Takte ein, sechs Takte aus. Die erste Hälfte beim Einatmen beten, die zweite beim Ausatmen. Fünf Runden reichen.")}</p>
    <div class="pw-breath"><div class="pw-orb" id="pwOrb"></div><div class="pw-orb-t" id="pwOrbT">${L("Jesus, teach me Your unhurried way.","Jesus, lehre mich Dein unhastiges Tempo.")}</div>
    <button type="button" class="pw-link solid" id="pwBreath">${L("Start 5 breaths","5 Atemzüge starten")}</button></div>
    ${verse("mt11","--pw-prayer")}`},
  {id:"irritated", t:["When irritation rises","Wenn Gereiztheit hochkommt"], s:["Before you answer","Bevor du antwortest"], body:()=>`
    <p>${L("Stop before you speak. Take one breath and pray:","Halt an, bevor du redest. Ein Atemzug, dann:")}</p>
    <p><em>${L("Lord, I notice I want to be right, fast and first. Slow me down. Let me listen before I answer, and let this person feel Your patience through me, not my pressure.","Herr, ich merke, dass ich recht haben will, schnell und zuerst. Mach mich langsam. Lass mich zuhören, bevor ich antworte, und lass diesen Menschen durch mich Deine Geduld spüren, nicht meinen Druck.")}</em></p>
    <p>${L("Then ask yourself: am I hungry, tired or hurried? Irritation often points there first.","Dann frag dich: Bin ich hungrig, müde oder gehetzt? Gereiztheit zeigt oft zuerst dorthin.")}</p>
    ${verse("jas1","--pw-comm")}${verse("eph4","--pw-comm")}`},
  {id:"sabbath", t:["Opening the Sabbath","Den Sabbat beginnen"], s:["Sunday 13:00, after church","Sonntag 13:00, nach dem Gottesdienst"], body:()=>`
    <p>${L("Four movements: stop, rest, delight, worship. No planning, no email, no content. Football, a walk, a long meal and naps all count.","Vier Bewegungen: aufhören, ruhen, genießen, anbeten. Kein Planen, keine Mails, kein Content. Fußball, Spaziergang, langes Essen und Mittagsschlaf zählen alle.")}</p>
    <p><em>${L("Lord of the Sabbath, the work is not finished and it does not have to be. I stop because You are God and I am not. Teach me to rest, to enjoy what You have given, and to be fully here with the people closest to me.","Herr des Sabbats, die Arbeit ist nicht fertig und muss es auch nicht sein. Ich höre auf, weil Du Gott bist und ich nicht. Lehre mich zu ruhen, zu genießen, was Du gegeben hast, und ganz da zu sein bei den Menschen, die mir am nächsten sind.")}</em></p>
    ${verse("mk2","--pw-sol")}${verse("ps46","--pw-sol")}`},
  {id:"fast", t:["Prayer for the fast","Gebet beim Fasten"], s:["Thursday, whenever hunger comes","Donnerstag, immer wenn der Hunger kommt"], body:()=>`
    <p>${L("Let every hunger pang be a bell that calls you to pray, briefly, wherever you are.","Lass jedes Hungergefühl eine Glocke sein, die dich kurz ins Gebet ruft, egal wo du bist.")}</p>
    <p><em>${L("Jesus, You are the bread of life. My body wants more; teach my heart to want You more. Break my need to be comfortable, first and in control.","Jesus, Du bist das Brot des Lebens. Mein Körper will mehr; lehre mein Herz, Dich mehr zu wollen. Brich meinen Drang, bequem, zuerst und in Kontrolle zu sein.")}</em></p>
    ${verse("mt6b","--pw-fast")}`},
  {id:"service", t:["Before a hidden act of service","Vor einem verborgenen Dienst"], s:["Once a month, for someone who frustrates you","Einmal im Monat, für jemanden, der dich frustriert"], body:()=>`
    <p><em>${L("Father, You see in secret. I choose to serve this person without being seen or thanked. Soften my heart toward them while my hands do the work.","Vater, Du siehst ins Verborgene. Ich will diesem Menschen dienen, ohne gesehen oder bedankt zu werden. Mach mein Herz weich für ihn, während meine Hände die Arbeit tun.")}</em></p>
    ${verse("mt6a","--pw-serv")}${verse("php2","--pw-serv")}`},
  {id:"compline", t:["Night prayer after Augustine","Nachtgebet nach Augustinus"], s:["Traditional, for the last moment before sleep","Traditionell, für den letzten Moment vor dem Schlaf"], body:()=>`
    <p><em>${L("Keep watch, dear Lord, with those who work, or watch, or weep this night, and give Your angels charge over those who sleep. Tend the sick, give rest to the weary, bless the dying, soothe the suffering, pity the afflicted, shield the joyous; and all for Your love's sake. Amen.","Wache, lieber Herr, mit denen, die in dieser Nacht arbeiten, wachen oder weinen, und befiehl Deinen Engeln, über die Schlafenden zu wachen. Pflege die Kranken, gib den Müden Ruhe, segne die Sterbenden, tröste die Leidenden, erbarme Dich der Bedrängten, beschütze die Fröhlichen; und alles um Deiner Liebe willen. Amen.")}</em></p>`}
];

/* ---------- the Rule (PTW grid, one row per practice) ---------- */
function ruleRows(){
  const P = (id, per) => { const r = promptDone(id, per); return r; };
  const perLbl = {month:["this month","diesen Monat"], season:["this season","diese Saison"], year:["this year","dieses Jahr"]};
  const promptBtn = (id, per) => { const r = P(id, per); return `<div class="pa"><span>${r.last?L("Last: ","Zuletzt: ")+fmtDate(r.last):L("Not done yet","Noch offen")}</span><button type="button" data-prompt="${id}" data-per="${per}" aria-pressed="${r.done}">${r.done?L("Done ","Erledigt ")+L(perLbl[per][0],perLbl[per][1]):L("Mark done","Als erledigt markieren")}</button></div>`; };
  const tracked = `<span class="pw-tag">${L("Current Focus","Aktueller Fokus")}</span><span class="pw-tag ghost">${L("tracked","getrackt")}</span>`;
  const focus = `<span class="pw-tag">${L("Current Focus","Aktueller Fokus")}</span>`;
  const cad = (en,de) => `<span class="pw-tag cadence">${L(en,de)}</span>`;
  return [
    {cls:"r-prayer", h:["Prayer","Gebet"], d:["We become a community of <b>communion with God</b> in a culture of <b>distraction and escapism</b> through the practice of <b>prayer</b>.","Wir werden eine Gemeinschaft der <b>Gemeinschaft mit Gott</b> in einer Kultur der <b>Ablenkung und Flucht</b> durch die Praxis des <b>Gebets</b>."], items:[
      {c:cad("Daily, Sun to Thu","Täglich, So bis Do"), tag:tracked, t:["Evening Rhythm: phone away at 22:45 (counts until 23:15), Lectio 365 Evening, review of the day (one gift, one weight, one mirror).","Abendrhythmus: Handy weg um 22:45 (zählt bis 23:15), Lectio 365 Abend, Tagesrückblick (ein Geschenk, eine Last, ein Spiegel)."]},
      {c:cad("In the moment","Im Moment"), tag:focus, t:["When you feel hurried inside, pause for a few slow breaths and pray: “Jesus, teach me Your unhurried way.”","Wenn du dich innerlich gehetzt fühlst: ein paar langsame Atemzüge und beten: „Jesus, lehre mich Dein unhastiges Tempo.“"], extra:`<div class="pa"><span>${L("Not tracked on purpose","Bewusst nicht getrackt")}</span><button type="button" data-open-prayer="breath">${L("Breathe now","Jetzt atmen")}</button></div>`},
      {c:cad("Weekly, Sunday night","Wöchentlich, Sonntagabend"), tag:focus, t:["Journal 10 to 15 minutes: cares, worries, questions to God. Close the journal as an act of release. Then rate your week below.","10 bis 15 Minuten Journal: Sorgen, Fragen, Anliegen an Gott. Das Journal schließen als Akt des Loslassens. Danach unten die Woche bewerten."]}
    ]},
    {cls:"r-fast", h:["Fasting","Fasten"], d:["We become a community of <b>holiness</b> in a culture of <b>indulgence and immorality</b> through the practice of <b>fasting</b>.","Wir werden eine Gemeinschaft der <b>Heiligkeit</b> in einer Kultur des <b>Überflusses</b> durch die Praxis des <b>Fastens</b>."], items:[
      {c:cad("Weekly, Thursday","Wöchentlich, Donnerstag"), tag:tracked, t:["Fast from Wednesday dinner to Thursday dinner: water, tea, coffee. Let hunger turn into prayer.","Fasten von Mittwochabend bis Donnerstagabend: Wasser, Tee, Kaffee. Hunger wird zum Gebet."]}
    ]},
    {cls:"r-sol", h:["Sabbath and solitude","Sabbat und Stille"], d:["We become a community of <b>peace and quiet</b> in a culture of <b>anxiety and noise</b> through <b>Sabbath and solitude</b>.","Wir werden eine Gemeinschaft von <b>Frieden und Stille</b> in einer Kultur von <b>Angst und Lärm</b> durch <b>Sabbat und Stille</b>."], items:[
      {c:cad("Weekly, Sunday","Wöchentlich, Sonntag"), tag:tracked, t:[`Sabbath: Sunday ${habits.sabbath.start} for ${habits.sabbath.hours} hours. Stop, rest, delight, worship, and be fully present with the people closest to you.`,`Sabbat: Sonntag ab ${habits.sabbath.start} für ${habits.sabbath.hours} Stunden. Aufhören, ruhen, genießen, anbeten und ganz da sein bei den Menschen, die dir am nächsten sind.`]},
      {c:cad("Daily","Täglich"), tag:focus, t:["Phone away 30 minutes before bed; use that space for quiet, Scripture or prayer. Part of the Evening Rhythm.","Handy 30 Minuten vor dem Schlafen weg; die Zeit für Stille, Bibel oder Gebet nutzen. Teil des Abendrhythmus."]}
    ]},
    {cls:"r-comm", h:["Community","Gemeinschaft"], d:["We become a community of <b>love and depth</b> in a culture of <b>individualism and superficiality</b> through the practice of <b>community</b>.","Wir werden eine Gemeinschaft von <b>Liebe und Tiefe</b> in einer Kultur von <b>Individualismus und Oberflächlichkeit</b> durch <b>Gemeinschaft</b>."], items:[
      {c:cad("Monthly","Monatlich"), tag:focus, t:["Invite a trusted friend or family member to gently name where they see selfishness or irritability in you, and pray together for fresh grace.","Lade eine vertraute Person ein, dir ehrlich zu sagen, wo sie Selbstbezogenheit oder Gereiztheit bei dir sieht, und betet zusammen um neue Gnade."], extra:promptBtn("feedback","month")}
    ]},
    {cls:"r-serv", h:["Service","Dienst"], d:["We become a community of <b>justice, mercy and reconciliation</b> in a culture of <b>injustice and division</b> through the practice of <b>service</b>.","Wir werden eine Gemeinschaft von <b>Gerechtigkeit, Barmherzigkeit und Versöhnung</b> in einer Kultur der <b>Spaltung</b> durch <b>Dienst</b>."], items:[
      {c:cad("Monthly","Monatlich"), tag:focus, t:["A hidden act of service for someone who frustrates you, without mentioning it to anyone.","Ein verborgener Dienst für jemanden, der dich frustriert, ohne es jemandem zu erzählen."], extra:promptBtn("service","month")}
    ]},
    {cls:"r-other", h:["Other practices","Weitere Praktiken"], d:["Your custom Rule of Life activities","Deine eigenen Rule of Life Praktiken"], items:[
      {c:cad("Seasonally","Saisonal"), tag:focus, t:["Review your calendar, commitments and spiritual rhythms with God: what needs to be laid down so you can live at a more relational pace?","Kalender, Verpflichtungen und geistliche Rhythmen mit Gott durchgehen: Was muss ich ablegen, um in einem beziehungsreicheren Tempo zu leben?"], extra:promptBtn("review","season")},
      {c:cad("Annually","Jährlich"), tag:focus, t:["Choose one activity (eating, walking, driving) to do more slowly and attentively, resisting the pull to rush.","Eine Tätigkeit wählen (Essen, Gehen, Autofahren), die du langsamer und aufmerksamer tust, gegen den Sog der Eile."], extra:promptBtn("slow","year")}
    ]}
  ];
}

/* ---------- spirit view ---------- */
function spiritHtml(){
  const now = new Date(), k = dateKey(now), H = habOf(k), mon = mondayOf(now), ew = eveningWeek(mon), dow = now.getDay();
  const fruitKey = dateKey(mon), F = habits.fruit[fruitKey]||{};
  let h = `<div style="display:grid;gap:12px"><h2 style="font-size:40px;line-height:1.05;letter-spacing:-.02em;font-weight:500">Rule of Life</h2>
    <div class="row" style="gap:8px"><a class="pw-link solid" href="https://www.practicingtheway.org/reflection" target="_blank" rel="noopener">${L("Spiritual Health Reflection","Spiritual Health Reflection")}</a><a class="pw-link" href="https://www.practicingtheway.org/ruleoflifebuilder" target="_blank" rel="noopener">Rule of Life Builder</a></div>
    <p class="pw-sub" style="font-size:12.5px">${L("Retake the reflection every quarter: next on Monday 14 December, 08:00.","Die Reflexion jedes Quartal wiederholen: als Nächstes Montag, 14. Dezember, 08:00.")}</p></div>`;
  h += `<div class="pw-goalrow"><div class="pw-goal"><div class="g">${L("Becoming less selfish and irritable.","Weniger selbstbezogen und gereizt werden.")}</div>
    <div class="i">${L("I am someone who ends the day with God and lives at an unhurried pace.","Ich bin jemand, der den Tag mit Gott beendet und in einem unhastigen Tempo lebt.")}</div></div>
    <div class="pw-trio">${[["Daily","Täglich","Evening Rhythm","Abendrhythmus"],["Weekly","Wöchentlich","Thursday fast","Fasten am Donnerstag"],["Weekly","Wöchentlich","Sabbath, 12 hours","Sabbat, 12 Stunden"]].map(x=>`<div class="pw-mini"><span class="pw-freq">${L(x[0],x[1])}</span><span>${L(x[2],x[3])}</span></div>`).join("")}</div></div>`;
  // today
  const items = [];
  if(isEveningDay(now)) items.push(`<button type="button" class="pw-tick" data-hab="ev" aria-pressed="${!!H.ev}"><span class="t">${L("Evening Rhythm","Abendrhythmus")}<small>${L("Phone away","Handy weg um")} ${habits.evening.time}${habits.evening.latest?L(`, counts until ${habits.evening.latest}`,`, zählt bis ${habits.evening.latest}`):""}${dow===0?L(" · tonight: journal and rate your week"," · heute: Journal und Woche bewerten"):""}</small></span><span class="box">${CHECK_SVG}</span></button>`);
  if(fastSkip(now) && started(k)) items.push(`<p class="pw-sub"><b>${L("No fast today","Heute kein Fasten")}</b> · ${esc(fastSkip(now))}</p>`);
  if(isFast(now) && started(k)) items.push(`<button type="button" class="pw-tick" data-hab="fast" aria-pressed="${!!H.fast}"><span class="t">${L("Thursday fast","Fasten am Donnerstag")}<small>${L("Until dinner. Tick it once you broke the fast at dinner.","Bis zum Abendessen. Abhaken, wenn du beim Abendessen das Fasten gebrochen hast.")}</small></span><span class="box">${CHECK_SVG}</span></button>`);
  if(dow===habits.sabbath.dow && started(k)) items.push(`<button type="button" class="pw-tick" data-hab="sab" aria-pressed="${!!H.sab}"><span class="t">${L("Sabbath","Sabbat")}<small>${L("From","Ab")} ${habits.sabbath.start}, ${habits.sabbath.hours} ${L("hours","Stunden")}. ${L("Tick it tonight if you kept it.","Heute Abend abhaken, wenn du ihn gehalten hast.")}</small></span><span class="box">${CHECK_SVG}</span></button>`);
  if(!started(k)){ items.length = 0; items.push(`<p class="pw-sub">${L(`Your Rule starts on ${fmtDate(habits.start,{weekday:"long",day:"numeric",month:"long"})}. Tonight there is nothing to tick: read through the prayers below and go to bed.`,`Deine Rule startet am ${fmtDate(habits.start,{weekday:"long",day:"numeric",month:"long"})}. Heute gibt es nichts abzuhaken: lies die Gebete unten und geh ins Bett.`)}</p>`); }
  if(!items.length) items.push(`<p class="pw-sub">${dow===5?L("Friday is youth night. No Evening Rhythm to track tonight. Go to bed when you get home.","Freitag ist Jugendabend. Heute kein Abendrhythmus zum Tracken. Geh ins Bett, wenn du heimkommst."):L("Saturday is free from tracking. Pray as you like.","Samstag ist frei vom Tracken. Bete, wie es dir gut tut.")}</p>`);
  h += `<div class="pw-card pw-tonight"><div class="spread" style="align-items:baseline"><h3>${L("Today","Heute")}</h3><span class="pw-sub" style="font-size:13px">${now.toLocaleDateString(L("en-GB","de-DE"),{weekday:"long",day:"numeric",month:"long"})}</span></div>
    ${items.join("")}
    ${isEveningDay(now)?`<div class="row" style="gap:8px"><a class="pw-link solid" href="${LECTIO.app}" target="_blank" rel="noopener">Lectio 365 ${L("app","App")}</a><a class="pw-link" href="${LECTIO.web}" target="_blank" rel="noopener">lectio365.com</a><button type="button" class="pw-link" data-open-prayer="evening">${L("Guide me","Führ mich")}</button></div>`:""}</div>`;
  // this week, no streaks
  h += `<div class="pw-card"><div class="spread"><h3>${L("This week","Diese Woche")}</h3><span class="pw-sub" style="font-size:13px">${L("no streaks, just honesty","keine Serien, nur Ehrlichkeit")}</span></div>
    <div class="grid3" style="gap:8px">${[
      [L("Evening Rhythm","Abendrhythmus"), `${ew.n} / ${ew.of}`],
      [L("Fast","Fasten"), weekDays(mon).some(d=>isFast(d)&&habOf(dateKey(d)).fast)?L("kept","gehalten"):"–"],
      [L("Sabbath","Sabbat"), weekDays(mon).some(d=>d.getDay()===habits.sabbath.dow&&habOf(dateKey(d)).sab)?L("kept","gehalten"):"–"]
    ].map(x=>`<div style="display:grid;gap:2px"><span style="font-size:22px;font-weight:500">${x[1]}</span><span class="pw-sub" style="font-size:12.5px">${x[0]}</span></div>`).join("")}</div>
    <div class="pw-sub" style="font-size:12.5px">${L("Evening Rhythm, last 4 weeks. Dashed days are free (Friday, Saturday).","Abendrhythmus, letzte 4 Wochen. Gestrichelte Tage sind frei (Freitag, Samstag).")}</div>${dotsHtml()}</div>`;
  // fruit
  const weeks = [...Array(8)].map((_,i)=>dateKey(addDays(mon,-7*(7-i))));
  h += `<div class="pw-card"><h3>${L("The fruit","Die Frucht")}</h3>
    <p class="pw-sub">${L("Sunday night: how irritable was I this week? 1 is calm and patient, 5 is short fused all week. This measures change, not effort.","Sonntagabend: Wie gereizt war ich diese Woche? 1 ist ruhig und geduldig, 5 ist die ganze Woche kurz angebunden. Das misst Veränderung, nicht Anstrengung.")}</p>
    <div class="pw-scale" role="group" aria-label="${L("Irritability this week","Gereiztheit diese Woche")}">${[1,2,3,4,5].map(n=>`<button type="button" data-irr="${n}" aria-pressed="${F.irr===n}">${n}</button>`).join("")}</div>
    <label class="f" for="pwNote" style="color:var(--pw-muted)">${L("Where did hurry or self win this week? (optional)","Wo haben Eile oder Ego diese Woche gewonnen? (optional)")}<textarea id="pwNote">${esc(F.note||"")}</textarea></label>
    <button type="button" class="pw-link" id="pwNoteSave" style="justify-self:start">${L("Save note","Notiz speichern")}</button>
    ${weeks.some(w=>habits.fruit[w]?.irr)?`<div class="pw-bars" aria-label="${L("Last 8 weeks","Letzte 8 Wochen")}">${weeks.map(w=>{ const v = habits.fruit[w]?.irr; return `<div><i style="height:${v?v*10:2}px;${v?"":"opacity:.25"}"></i><span>${fmtDate(w,{day:"numeric",month:"numeric"})}</span></div>`; }).join("")}</div>`:""}
    ${verse("gal5","--pw-goal")}</div>`;
  // rule
  h += `<div style="display:grid;gap:4px;margin-top:6px"><span class="pw-eye">${L("Your Rule","Deine Rule")}</span><h2>${L("Practices","Praktiken")}</h2></div><div class="pw-rule">`;
  for(const r of ruleRows()) h += `<div class="pw-row ${r.cls}"><div class="rh">${L(r.h[0],r.h[1])}</div><div class="rd">${L(r.d[0],r.d[1])}</div>${r.items.map(it=>`<div class="pw-prac"><div class="ph">${it.c}${it.tag}</div><div>${esc(L(it.t[0],it.t[1]))}</div>${it.extra||""}</div>`).join("")}</div>`;
  h += `</div>`;
  // prayers
  h += `<div style="display:grid;gap:4px;margin-top:6px"><span class="pw-eye">${L("Guided prayers","Geführte Gebete")}</span><h2>${L("Pray","Beten")}</h2></div><div style="display:grid;gap:8px">`;
  for(const p of PRAYERS) h += `<details class="pw-acc" id="pr-${p.id}"><summary><span>${L(p.t[0],p.t[1])}<small>${L(p.s[0],p.s[1])}</small></span></summary><div class="body">${p.body()}</div></details>`;
  h += `</div>`;
  // verses
  h += `<div style="display:grid;gap:4px;margin-top:6px"><span class="pw-eye">${L("Scripture for this season","Bibelworte für diese Zeit")}</span><h2>${L("Verses","Verse")}</h2></div>`;
  const groups = [[["Unhurried","Unhastig"],["mt11","ps46","is30"],"--pw-sol"],[["Slow to anger","Langsam zum Zorn"],["jas1","eph4","pr27"],"--pw-comm"],[["Less self","Weniger Ich"],["php2","mt6a"],"--pw-serv"],[["Lying down in peace","In Frieden liegen"],["ps139","pe5","ps4"],"--pw-prayer"]];
  h += `<div style="display:grid;gap:8px">${groups.map(g=>`<details class="pw-acc"><summary><span>${L(g[0][0],g[0][1])}<small>${g[1].map(id=>L(V[id].ref[0],V[id].ref[1])).join(" · ")}</small></span></summary><div class="body">${g[1].map(id=>verse(id,g[2])).join("")}</div></details>`).join("")}</div>`;
  h += `<p class="pw-sub" style="font-size:12px">${L("Verse text: World English Bible (public domain). Links open the ESV.","Bibeltext: Luther 1912 (gemeinfrei). Links öffnen die Lutherbibel 2017.")} <a href="https://www.practicingtheway.org/" target="_blank" rel="noopener" style="color:inherit">Practicing the Way</a></p>`;
  return h;
}

/* ---------- music view ---------- */
function musicHtml(){
  const now = new Date(), mon = mondayOf(now), W = musicWeek(mon), M = habits.music, G = M.goal;
  const atGoal = habits.songs.filter(s=>s.stage>=G.stage).length;
  let h = `<div style="padding:4px 2px 0"><div class="eyebrow">${L("Music · lead and maintenance","Musik · Fokus und Erhalt")}</div><h2>${L("One lead project","Ein Fokusprojekt")}</h2></div>`;
  h += `<div class="rings-grid">
    <div class="pcard">${ring(W.song/M.songPerWeek, "var(--sport)", 104, 10, `${W.song}/${M.songPerWeek}`, "", 24)}<div class="t">${L("Song sessions","Song Sessions")}</div><div class="s">${L("lead · 60 min or more","Fokus · ab 60 min")}</div></div>
    <div class="pcard">${ring(W.reels/M.reelsPerWeek, "var(--run)", 104, 10, `${W.reels}/${M.reelsPerWeek}`, "", 24)}<div class="t">${L("Reel practice","Reel Übung")}</div><div class="s">${L("maintenance · filmed","Erhalt · gefilmt")} ${W.film}/${M.filmPerWeek}</div></div></div>`;
  // planned
  const days = weekDays(mon).filter(d=>dateKey(d)>=dateKey(now)).concat(weekDays(addDays(mon,7)));
  const planned = days.flatMap(d=>musicPlanned(d).map(p=>({...p, date:dateKey(d)}))).slice(0,6);
  h += `<div class="card"><div class="spread"><h3>${L("Planned","Geplant")}</h3><button type="button" class="ghost" id="muPlanAdd" style="padding:7px 12px;min-height:36px">${L("Plan a session","Session planen")}</button></div>
    <p class="small muted">${L("Only planned sessions show up in your morning briefing. Saturday 09:00 is your standing song session (skipped on ILD days).","Nur geplante Sessions kommen ins Morgenbriefing. Samstag 09:00 ist deine feste Song Session (entfällt an ILD Tagen).")}</p>
    <div class="list">${planned.length?planned.map(p=>`<div class="lrow" style="grid-template-columns:1fr auto"><span class="t">${fmtDate(p.date,{weekday:"short",day:"numeric",month:"short"})} · ${p.time}</span><span class="m">${L(KIND[p.kind][0],KIND[p.kind][1])} · ${p.min} min${p.weekly?L(" · weekly"," · wöchentlich"):""}</span><button type="button" class="ghost" data-unplan="${p.date}|${p.id}" style="grid-row:1/3;grid-column:2;padding:6px 10px;min-height:34px">${p.weekly?L("Skip","Aussetzen"):L("Remove","Entfernen")}</button></div>`).join(""):`<p class="small muted">${L("Nothing planned yet.","Noch nichts geplant.")}</p>`}</div>
    <button type="button" class="primary" id="muLog">${L("Log a music session","Musik Session eintragen")}</button></div>`;
  // songs
  h += `<div class="card"><div class="spread"><h3>${L("Song pipeline","Song Pipeline")}</h3><span class="mono small">${atGoal}/${G.count} ${L("at","bei")} ${L(STAGES[G.stage][0],STAGES[G.stage][1])}</span></div>
    <p class="small muted">${L(`Goal: ${G.count} songs at ${STAGES[G.stage][0]} by ${fmtDate(G.by)}. Progress means a song moved a stage, not hours spent.`,`Ziel: ${G.count} Songs bei ${STAGES[G.stage][1]} bis ${fmtDate(G.by)}. Fortschritt heißt, ein Song ist eine Stufe weiter, nicht Stunden.`)}</p>
    <div class="bar"><i style="width:${clamp(atGoal/G.count*100,0,100)}%;background:var(--sport)"></i></div>
    <div class="list">${habits.songs.length? habits.songs.map(s=>`<div class="song"><div class="top"><b>${esc(s.title)}</b><button type="button" class="ghost" data-song-del="${s.id}" style="padding:4px 10px;min-height:30px;font-size:12px">${L("Remove","Entfernen")}</button></div>
      <div class="stages" role="group" aria-label="${L("Stage","Stufe")}">${STAGES.map((st,i)=>`<button type="button" data-song="${s.id}" data-stage="${i}" aria-pressed="${s.stage===i}">${L(st[0],st[1])}</button>`).join("")}</div></div>`).join("")
      : `<p class="small muted">${L("No songs yet. Add the songs you want to finish this season.","Noch keine Songs. Trag die Songs ein, die du diese Saison fertig machen willst.")}</p>`}</div>
    <div class="row" style="flex-wrap:nowrap"><input id="songNew" placeholder="${L("Song title","Songtitel")}" style="flex:1"><button type="button" id="songAdd">${L("Add","Hinzufügen")}</button></div></div>`;
  // reels focus
  const F = habits.focus, best = Object.keys(logData.days).filter(k=>!F.from||k>=F.from).flatMap(k=>(logData.days[k].hab?.mu||[]).filter(s=>s.kind==="reels"&&s.bpm).map(s=>s.bpm));
  h += `<div class="card"><h3>${L("Reels focus","Reels Fokus")}</h3>
    <p class="small muted">${L("One groove or skill per 4 weeks. Practice first, film second. Filming only counts after a practice block.","Ein Groove oder Skill pro 4 Wochen. Erst üben, dann filmen. Filmen zählt erst nach einem Übungsblock.")}</p>
    <div class="grid3"><label class="f" for="fcText" style="grid-column:1/-1">${L("Focus","Fokus")}<input id="fcText" value="${esc(F.text||"")}" placeholder="${L("e.g. linear fill in 6/8","z. B. Linear Fill in 6/8")}"></label>
    <label class="f" for="fcStart">${L("Start BPM","Start BPM")}<input id="fcStart" type="number" inputmode="numeric" value="${F.startBpm??""}"></label>
    <label class="f" for="fcTarget">${L("Target BPM","Ziel BPM")}<input id="fcTarget" type="number" inputmode="numeric" value="${F.targetBpm??""}"></label>
    <div class="stat"><b>${best.length?Math.max(...best):"–"}</b><span>${L("best clean BPM","bestes sauberes BPM")}</span></div></div>
    ${F.from?`<p class="small muted">${L("Since","Seit")} ${fmtDate(F.from)} · ${L("new focus due","neuer Fokus fällig")} ${fmtDate(dateKey(addDays(fromKey(F.from),28)))}</p>`:""}
    <button type="button" id="fcSave">${L("Save focus","Fokus speichern")}</button></div>`;
  // recent
  const recent = Object.keys(logData.days).sort().reverse().flatMap(k=>(logData.days[k].hab?.mu||[]).map(s=>({...s,k}))).slice(0,8);
  if(recent.length) h += `<div class="card"><h3>${L("Recent","Zuletzt")}</h3><div class="list">${recent.map(s=>`<div class="lrow" style="grid-template-columns:1fr auto"><span class="t">${L(KIND[s.kind][0],KIND[s.kind][1])} · ${s.min} min</span><span class="m">${fmtDate(s.k,{weekday:"short",day:"numeric",month:"short"})}${s.song?" · "+esc(habits.songs.find(x=>x.id===s.song)?.title||""):""}${s.stage?L(" · stage up"," · Stufe weiter"):""}${s.bpm?` · ${s.bpm} BPM`:""}${s.filmed?L(" · filmed"," · gefilmt"):""}</span><button type="button" class="ghost" data-mu-del="${s.k}|${s.id}" style="grid-row:1/3;grid-column:2;padding:6px 10px;min-height:34px">${L("Delete","Löschen")}</button></div>`).join("")}</div></div>`;
  return h;
}

/* ---------- sheets ---------- */
function openMusicLog(kind0){
  let kind = kind0||"song", min = 60, filmed = false;
  const body = () => `<div class="seg" role="group" aria-label="Kind"><button type="button" data-k="song" aria-pressed="${kind==="song"}">${L("Song pipeline","Song Pipeline")}</button><button type="button" data-k="reels" aria-pressed="${kind==="reels"}">${L("Drum reels","Drum Reels")}</button></div>
    <div class="f" style="font-size:12.5px;color:var(--muted)">${L("Minutes","Minuten")}<div class="qbtns">${[25,30,45,60,90,120].map(m=>`<button type="button" data-m="${m}" aria-pressed="${min===m}">${m}</button>`).join("")}</div></div>
    ${kind==="song"?`<label class="f" for="mlSong">${L("Song","Song")}<select id="mlSong"><option value="">${L("None or new idea","Keiner oder neue Idee")}</option>${habits.songs.map(s=>`<option value="${s.id}">${esc(s.title)} · ${L(STAGES[s.stage][0],STAGES[s.stage][1])}</option>`).join("")}</select></label>
      <label class="row" for="mlStage" style="gap:10px;font-size:14px"><input type="checkbox" id="mlStage" style="min-height:0;width:22px;height:22px"> ${L("The song moved up one stage","Der Song ist eine Stufe weiter")}</label>`
    :`<label class="f" for="mlBpm">${L("Clean BPM today (optional)","Sauberes BPM heute (optional)")}<input id="mlBpm" type="number" inputmode="numeric"></label>
      <label class="row" for="mlFilm" style="gap:10px;font-size:14px"><input type="checkbox" id="mlFilm" ${filmed?"checked":""} style="min-height:0;width:22px;height:22px"> ${L("Filmed a reel","Reel gefilmt")}</label>`}
    <button type="button" class="primary" id="mlSave">${L("Save session","Session speichern")}</button>`;
  const bind = el => {
    el.querySelectorAll("[data-k]").forEach(b=>b.onclick = ()=>{ kind = b.dataset.k; el.innerHTML = body(); bind(el); });
    el.querySelectorAll("[data-m]").forEach(b=>b.onclick = ()=>{ min = Number(b.dataset.m); el.querySelectorAll("[data-m]").forEach(x=>x.setAttribute("aria-pressed", String(x===b))); });
    el.querySelector("#mlSave").onclick = async ()=>{
      const k = dateKey(new Date()), H = hab(k); H.mu = H.mu||[];
      const s = {id:uid(), kind, min};
      if(kind==="song"){ s.song = el.querySelector("#mlSong").value||null; s.stage = el.querySelector("#mlStage").checked;
        if(s.stage && s.song){ const so = habits.songs.find(x=>x.id===s.song); if(so && so.stage<STAGES.length-1){ so.stage++; so.updated = k; await saveHabits(); } } }
      else { s.bpm = Number(el.querySelector("#mlBpm").value)||null; s.filmed = el.querySelector("#mlFilm").checked; }
      H.mu.push(s); closeSheet(); render(); await saveLogH(); };
  };
  openSheet(L("Log music","Musik eintragen"), body(), bind);
}
