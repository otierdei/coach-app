/**
 * Coach App backend (Google Apps Script web app).
 * Lives in Oti's own Google account. Reads and writes the JSON files in the Drive folder "Coach Data",
 * lists Google Calendar events and reads the health files in the Drive folder "Oti Health" (read only).
 *
 * One time setup:
 *   1. Paste this file into a new Apps Script project (script.new), save.
 *   2. Run the function "setup" once and allow access. The log shows your secret key.
 *   3. Deploy > New deployment > Web app: Execute as "Me", Who has access "Anyone". Copy the /exec URL.
 *   4. In the Coach App: gear icon > Backend: paste URL and key > Connect.
 *
 * Every request: POST, body JSON {key, action, ...}. Wrong key = {error:"bad key"}.
 * Doc files: <name>.json with {version, updatedAt, data}. A write must send baseVersion = the version it read;
 * if the file changed in between, nothing is written and the answer is {ok:false, conflict:true, current}.
 * Scheduled Claude tasks cannot overwrite a Drive file (the Drive connector only creates files), so they
 * drop small change files into "Coach Data/inbox": <doc>--<yyyyMMdd-HHmmss>--<who>.json with
 * {doc, baseVersion, by, mode:"merge"|"set", data}. This script applies them in name order (every minute by trigger,
 * and before every read), bumps the version and moves the change file to "Coach Data/processed".
 * mode "merge": objects are merged key by key, arrays and values replace, {"__delete__":true} removes a key.
 * mode "set": replaces the whole doc (briefing, monthly).
 * mode "patch": like merge, but a top level array of objects with "id" (e.g. tasks) is changed item by item:
 *   each patch item is merged into the item with the same id, unknown ids are appended, {"id":..,"__delete__":true} removes one.
 * This script never changes or deletes anything in "Oti Health".
 */
var DATA_FOLDER = 'Coach Data';
var HEALTH_FOLDER = 'Oti Health';
var DOCS = ['profile', 'log', 'health', 'schedule', 'briefing', 'habits', 'tasks', 'monthly'];
var TZ = 'Europe/Berlin';

function setup() {
  var p = PropertiesService.getScriptProperties();
  var key = p.getProperty('KEY');
  if (!key) {
    key = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
    p.setProperty('KEY', key);
  }
  var folder = dataFolder_();
  var health = healthFolder_();
  // touch the services once so the consent screen asks for all of them now
  CalendarApp.getAllCalendars();
  subFolder_('inbox'); subFolder_('processed');
  // apply change files from the scheduled tasks every minute, even when the app is closed
  var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'applyInbox'; });
  if (!has) ScriptApp.newTrigger('applyInbox').timeBased().everyMinutes(1).create();
  Logger.log('Coach Data folder: ' + folder.getId());
  Logger.log('Oti Health folder: ' + (health ? health.getId() : 'NOT FOUND'));
  Logger.log('SECRET KEY (paste into the app): ' + key);
  Logger.log('Next: Deploy > New deployment > Web app, Execute as Me, Access Anyone.');
  return key;
}

/** Run this only if the key ever leaked: the old key stops working at once. */
function newKey() {
  PropertiesService.getScriptProperties().deleteProperty('KEY');
  return setup();
}

function doGet(e) {
  return json_({ok: true, app: 'Coach backend', hint: 'Use POST.'});
}

function doPost(e) {
  var req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json_({error: 'bad json'}); }
  var key = PropertiesService.getScriptProperties().getProperty('KEY');
  if (!key || req.key !== key) return json_({error: 'bad key', code: 'needs_reauth'});
  try {
    switch (req.action) {
      case 'ping': return json_({ok: true, user: Session.getEffectiveUser().getEmail(), docs: listDocs_()});
      case 'readAll': applyInbox(); return json_({ok: true, docs: readAll_()});
      case 'read': applyInbox(); return json_({ok: true, doc: readDoc_(req.doc)});
      case 'write': return json_(writeDoc_(req.doc, req.data, req.baseVersion));
      case 'calendars': return json_({ok: true, calendars: calendars_()});
      case 'events': return json_({ok: true, events: events_(req.calendarId, req.startTime, req.endTime)});
      case 'driveSearch': return json_({ok: true, files: driveSearch_(req.query, req.pageSize)});
      case 'driveDownload': return json_({ok: true, content: driveDownload_(req.fileId)});
      default: return json_({error: 'unknown action'});
    }
  } catch (err) {
    return json_({error: String(err && err.message || err), code: 'server_unavailable'});
  }
}

/* ---------------- docs ---------------- */
function dataFolder_() {
  var p = PropertiesService.getScriptProperties();
  var id = p.getProperty('DATA_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var it = DriveApp.getFoldersByName(DATA_FOLDER);
  var f = it.hasNext() ? it.next() : DriveApp.createFolder(DATA_FOLDER);
  p.setProperty('DATA_FOLDER_ID', f.getId());
  return f;
}
function checkDoc_(name) {
  if (DOCS.indexOf(name) < 0) throw new Error('unknown doc ' + name);
}
function docFile_(name) {
  var it = dataFolder_().getFilesByName(name + '.json');
  return it.hasNext() ? it.next() : null;
}
function listDocs_() {
  return DOCS.filter(function (n) { return !!docFile_(n); });
}
function parseFile_(file) {
  var rec = JSON.parse(file.getBlob().getDataAsString('UTF-8'));
  if (typeof rec.version !== 'number') rec = {version: 1, updatedAt: null, data: rec};
  return rec;
}
function readDoc_(name) {
  checkDoc_(name);
  var f = docFile_(name);
  if (!f) return null;
  var rec = parseFile_(f);
  return {version: rec.version, updatedAt: rec.updatedAt, data: rec.data};
}
function readAll_() {
  var out = {};
  DOCS.forEach(function (n) { var r = readDoc_(n); if (r) out[n] = r; });
  return out;
}
function writeDoc_(name, data, baseVersion) {
  checkDoc_(name);
  if (data === undefined || data === null || typeof data !== 'object') throw new Error('data must be an object');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var f = docFile_(name);
    var cur = f ? parseFile_(f) : {version: 0, data: null};
    var base = (baseVersion === undefined || baseVersion === null) ? cur.version : Number(baseVersion);
    if (base !== cur.version) {
      return {ok: false, conflict: true, current: {version: cur.version, updatedAt: cur.updatedAt, data: cur.data}};
    }
    var rec = {version: cur.version + 1, updatedAt: new Date().toISOString(), by: 'app', data: data};
    var body = JSON.stringify(rec);
    if (f) f.setContent(body); else dataFolder_().createFile(name + '.json', body, 'application/json');
    return {ok: true, version: rec.version, updatedAt: rec.updatedAt};
  } finally {
    lock.releaseLock();
  }
}

/* ---------------- change files from scheduled tasks ---------------- */
function subFolder_(name) {
  var parent = dataFolder_(), it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function isObj_(x) { return x && typeof x === 'object' && !Array.isArray(x); }
function mergeDeep_(base, patch) {
  if (!isObj_(base) || !isObj_(patch)) return patch;
  var out = JSON.parse(JSON.stringify(base));
  Object.keys(patch).forEach(function (k) {
    var v = patch[k];
    if (isObj_(v) && v.__delete__ === true) { delete out[k]; return; }
    out[k] = (isObj_(v) && isObj_(out[k])) ? mergeDeep_(out[k], v) : v;
  });
  return out;
}
function patchById_(base, patch) {
  var out = JSON.parse(JSON.stringify(base || {}));
  Object.keys(patch).forEach(function (k) {
    var v = patch[k];
    var byId = Array.isArray(v) && Array.isArray(out[k]) && v.every(function (x) { return isObj_(x) && x.id != null; });
    if (!byId) { out[k] = (isObj_(v) && isObj_(out[k])) ? mergeDeep_(out[k], v) : v; return; }
    v.forEach(function (item) {
      var i = -1;
      for (var j = 0; j < out[k].length; j++) if (isObj_(out[k][j]) && out[k][j].id === item.id) { i = j; break; }
      if (item.__delete__ === true) { if (i >= 0) out[k].splice(i, 1); return; }
      if (i >= 0) out[k][i] = mergeDeep_(out[k][i], item); else out[k].push(item);
    });
  });
  return out;
}
function applyInbox() {
  var inbox = subFolder_('inbox'), files = [], it = inbox.getFiles();
  while (it.hasNext()) files.push(it.next());
  if (!files.length) return 0;
  files.sort(function (a, b) { return a.getName() < b.getName() ? -1 : 1; });
  var done = subFolder_('processed'), n = 0, briefingPush = null;
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    files.forEach(function (f) {
      var ch;
      try { ch = JSON.parse(f.getBlob().getDataAsString('UTF-8')); } catch (e) { f.setName('BAD ' + f.getName()); f.moveTo(done); return; }
      var name = ch.doc || f.getName().split('--')[0];
      if (DOCS.indexOf(name) < 0 || !isObj_(ch.data)) { f.setName('BAD ' + f.getName()); f.moveTo(done); return; }
      var df = docFile_(name), cur = df ? parseFile_(df) : {version: 0, data: {}};
      var data = ch.mode === 'set' ? ch.data : ch.mode === 'patch' ? patchById_(cur.data || {}, ch.data) : mergeDeep_(cur.data || {}, ch.data);
      var rec = {version: cur.version + 1, updatedAt: new Date().toISOString(), by: ch.by || 'task', data: data};
      var body = JSON.stringify(rec);
      if (df) df.setContent(body); else dataFolder_().createFile(name + '.json', body, 'application/json');
      f.setDescription('applied as version ' + rec.version + (ch.baseVersion != null && ch.baseVersion !== cur.version ? ' (written against ' + ch.baseVersion + ', merged)' : ''));
      f.moveTo(done);
      n++;
      if (name === 'briefing') briefingPush = data;
    });
  } finally { lock.releaseLock(); }
  if (briefingPush) pushBriefing_(briefingPush);
  return n;
}

/* ---------------- push through the coach push worker (worker/ in the repo, Cloudflare) ----------------
   Sends one push per new briefing (date + time). The worker checks the same secret key. */
var PUSH_URL = 'https://coach-push.othniel-erdei.workers.dev';
function pushBriefing_(data) {
  var p = PropertiesService.getScriptProperties();
  try {
    var tag = String(data.date || '') + ' ' + String(data.time || '');
    if (p.getProperty('LAST_BRIEF_PUSH') === tag) return;
    var lines = (data.lines || []).map(function (l) { return String(l).replace(/\s*\[(Certain|Likely|Guessing)\]/g, ''); });
    var pick = lines.filter(function (l) { return /^(RECOVERY|SESSION|HEADS UP)/.test(l); });
    var body = (pick.length ? pick : lines.slice(0, 3)).join('\n').slice(0, 500);
    var res = pushSend_(data.title || 'Morning briefing', body, 'briefing', 'apps-script briefing');
    p.setProperty('LAST_BRIEF_PUSH', tag);
    p.setProperty('LAST_PUSH_RESULT', new Date().toISOString() + ' ' + res);
  } catch (e) {
    p.setProperty('LAST_PUSH_RESULT', new Date().toISOString() + ' error ' + e);
  }
}
function pushSend_(title, body, tag, by) {
  var r = UrlFetchApp.fetch(PUSH_URL + '/push', {
    method: 'post', contentType: 'text/plain', muteHttpExceptions: true,
    payload: JSON.stringify({key: PropertiesService.getScriptProperties().getProperty('KEY'), title: title, body: body, tag: tag, url: './', by: by})
  });
  return r.getResponseCode() + ' ' + r.getContentText().slice(0, 300);
}
/** Run once by hand after pasting this version: asks for the new permission (external requests) and sends a test push. */
function testPush() {
  var res = pushSend_('Coach test', 'Push from Apps Script works.', 'test', 'apps-script test');
  Logger.log(res);
  return res;
}

/* ---------------- calendar (same shape as the Google Calendar connector) ---------------- */
function calendars_() {
  return CalendarApp.getAllCalendars().map(function (c) {
    return {id: c.getId(), summary: c.getName(), primary: c.getId() === CalendarApp.getDefaultCalendar().getId()};
  });
}
function events_(calendarId, startTime, endTime) {
  var cal = (!calendarId || calendarId === 'primary') ? CalendarApp.getDefaultCalendar() : CalendarApp.getCalendarById(calendarId);
  if (!cal) throw new Error('calendar not found: ' + calendarId);
  var evs = cal.getEvents(new Date(startTime), new Date(endTime));
  return evs.map(function (ev) {
    var o = {id: ev.getId(), summary: ev.getTitle(), description: ev.getDescription(), status: 'confirmed', location: ev.getLocation()};
    if (ev.isAllDayEvent()) {
      o.start = {date: Utilities.formatDate(ev.getAllDayStartDate(), TZ, 'yyyy-MM-dd')};
      o.end = {date: Utilities.formatDate(ev.getAllDayEndDate(), TZ, 'yyyy-MM-dd')};
    } else {
      o.start = {dateTime: ev.getStartTime().toISOString()};
      o.end = {dateTime: ev.getEndTime().toISOString()};
    }
    return o;
  });
}

/* ---------------- health files in Drive (read only) ---------------- */
function healthFolder_() {
  var it = DriveApp.getFoldersByName(HEALTH_FOLDER);
  return it.hasNext() ? it.next() : null;
}
// The app sends Drive v3 style queries (title, modifiedTime, parentId). DriveApp.searchFiles speaks v2.
function toV2_(q) {
  return String(q || '')
    .replace(/modifiedTime/g, 'modifiedDate')
    .replace(/parentId\s*=\s*'([^']+)'/g, "'$1' in parents") + ' and trashed = false';
}
function driveSearch_(query, pageSize) {
  var it = DriveApp.searchFiles(toV2_(query));
  var out = [], max = Math.min(Number(pageSize) || 25, 50);
  var isFolderQuery = /application\/vnd\.google-apps\.folder/.test(query);
  while (it.hasNext() && out.length < max) {
    var f = it.next();
    var parents = f.getParents(), parentId = parents.hasNext() ? parents.next().getId() : null;
    out.push({id: f.getId(), title: f.getName(), mimeType: f.getMimeType(), modifiedTime: f.getLastUpdated().toISOString(), parentId: parentId});
  }
  if (isFolderQuery) {
    var fit = DriveApp.searchFolders(toV2_(query).replace(/ and mimeType = 'application\/vnd\.google-apps\.folder'/, ''));
    while (fit.hasNext() && out.length < max) {
      var fo = fit.next();
      if (!out.some(function (x) { return x.id === fo.getId(); })) out.push({id: fo.getId(), title: fo.getName(), mimeType: 'application/vnd.google-apps.folder', modifiedTime: fo.getLastUpdated().toISOString(), parentId: null});
    }
  }
  return out;
}
function driveDownload_(fileId) {
  var f = DriveApp.getFileById(fileId);
  var hf = healthFolder_(), allowed = /^health/i.test(f.getName());
  if (!allowed && hf) { var ps = f.getParents(); while (ps.hasNext()) if (ps.next().getId() === hf.getId()) allowed = true; }
  if (!allowed) throw new Error('only health files can be downloaded');
  return Utilities.base64Encode(f.getBlob().getBytes());
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
