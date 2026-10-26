/**
 * @OnlyCurrentDoc
 *
 * Aylıq qiymətləndirmə protokolu — server hissəsi (Google Apps Script).
 * Bu kod Google Cədvələ bağlı (Extensions → Apps Script) layihədə işləyir.
 * Məlumatlar həmin cədvəldə saxlanılır:
 *   Ayarlar, Fənlər, Şagirdlər, İstifadəçilər, Psixoloq qeydləri, «Qiymətlər YYYY-AA» (hər ay üçün ayrıca vərəq).
 */

var APP = {
  TITLE: "Aylıq Qiymətləndirmə Protokolu",
  TOKEN_DAYS: 30,
  NOTE_MAX: 600,
  MAX_LOGIN_FAILS: 8,
  CRITERIA: ["Akademik nailiyyətlər", "Dərsə hazırlıq", "Dərsdə iştirak", "Nizam-intizam", "Davamiyyət"],
  SHEETS: {
    HELP: "Təlimat",
    SETTINGS: "Ayarlar",
    SUBJECTS: "Fənlər",
    CLASSES: "Siniflər",
    STUDENTS: "Şagirdlər",
    USERS: "İstifadəçilər",
    NOTES: "Psixoloq qeydləri",
    GRADES_PREFIX: "Qiymətlər "
  }
};

var HEADERS = {
  SETTINGS: ["Parametr", "Dəyər"],
  SUBJECTS: ["Fənn"],
  CLASSES: ["Sinif", "Qrup", "Fənlər"],
  STUDENTS: ["ID", "Sinif", "Soyadı, adı"],
  USERS: ["Login", "Şifrə", "Ad, soyad", "Rol", "Fənlər", "Dərs dediyi siniflər", "Rəhbəri olduğu sinif", "Aktiv"],
  GRADES: ["Ay", "Sinif", "Şagird ID", "Şagird", "Fənn"].concat(APP.CRITERIA, ["Orta", "Müəllim", "Yenilənib"]),
  NOTES: ["Ay", "Sinif", "Şagird ID", "Şagird", "Qeyd", "Yazan", "Yenilənib"]
};

/* ============================ Cədvəl menyusu ============================ */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Qiymətləndirmə")
    .addItem("Sistemi qur (vərəqləri yarat)", "setup")
    .addItem("Şagird ID-lərini yarat", "menuEnsureIds")
    .addSeparator()
    .addItem("Bütün istifadəçiləri sistemdən çıxar", "resetSessions")
    .addToUi();
}

/** Şagirdlər vərəqində ad yazılanda ID avtomatik yaranır. */
function onEdit(e) {
  try {
    var sh = e && e.range && e.range.getSheet();
    if (!sh || sh.getName() !== APP.SHEETS.STUDENTS) return;
    var first = e.range.getRow(), count = e.range.getNumRows();
    if (first + count - 1 < 2) return;
    var start = Math.max(2, first);
    var rows = sh.getRange(start, 1, first + count - start, 3).getValues();
    var changed = false;
    for (var i = 0; i < rows.length; i++) {
      if (!String(rows[i][0]).trim() && String(rows[i][2]).trim()) { rows[i][0] = newStudentId_(); changed = true; }
    }
    if (changed) sh.getRange(start, 1, rows.length, 1).setValues(rows.map(function (r) { return [r[0]]; }));
  } catch (err) {
    // sadə trigger heç vaxt istifadəçinin işini dayandırmamalıdır
  }
}

function setup() {
  var ss = SpreadsheetApp.getActive();
  ensureHelp_(ss);
  ensureSheet_(ss, APP.SHEETS.SETTINGS, HEADERS.SETTINGS, [["Məktəbin adı", ""], ["Məktəb rəhbəri", ""]], [180, 420]);
  var subjects = ensureSheet_(ss, APP.SHEETS.SUBJECTS, HEADERS.SUBJECTS, [], [260]);
  subjects.getRange("A1").setNote("Hər sətirdə bir fənn yazın. Protokolda fənlər bu sıra ilə çıxır.");
  var classes = ensureSheet_(ss, APP.SHEETS.CLASSES, HEADERS.CLASSES, [], [90, 90, 560]);
  classes.getRange("A:B").setNumberFormat("@");
  classes.getRange("B1").setNote("Məs.: I qrup. Protokolun başlığında göstərilir (istəyə bağlı).");
  classes.getRange("C1").setNote("Bu sinifdə qiymətləndirilən fənlər, vergüllə. Adlar Fənlər vərəqindəki kimi yazılmalıdır. Boş qalsa, bütün fənlər.");
  var students = ensureSheet_(ss, APP.SHEETS.STUDENTS, HEADERS.STUDENTS, [], [120, 90, 320]);
  students.getRange("B:B").setNumberFormat("@");
  students.getRange("A1").setNote("ID avtomatik yaranır, dəyişməyin. Şagirdi silmək üçün sətri silin.");
  students.getRange("B1").setNote("Məs.: 9A");
  try { students.getRange("A:A").protect().setDescription("Şagird ID-ləri").setWarningOnly(true); } catch (e) { /* qorunma artıq var */ }

  var users = ensureSheet_(ss, APP.SHEETS.USERS, HEADERS.USERS, [], [140, 110, 200, 170, 220, 200, 150, 70]);
  users.getRange("A:B").setNumberFormat("@");
  users.getRange("D1").setNote("Rol: müəllim, psixoloq, sinif rəhbəri, admin. Bir neçəsi vergüllə yazıla bilər: müəllim, sinif rəhbəri");
  users.getRange("E1").setNote("Müəllimin fənləri, vergüllə: Riyaziyyat, Fizika. Bütün fənlər üçün: *");
  users.getRange("F1").setNote("Müəllimin dərs dediyi siniflər, vergüllə: 9A, 9B. Psixoloq üçün boş qalsa, bütün siniflər açıqdır. Hamısı üçün: *");
  users.getRange("G1").setNote("Sinif rəhbəri olduğu sinif: 9A. Bu sinfin protokollarını görür və PDF çıxarır.");
  users.getRange("H1").setNote("Bəli və ya Xeyr. Xeyr yazılsa, istifadəçi daxil ola bilmir.");
  users.getRange("H2:H").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(["Bəli", "Xeyr"], true).setAllowInvalid(true).build());

  var adminPin = "";
  if (users.getLastRow() < 2) {
    adminPin = String(100000 + Math.floor(Math.random() * 900000));
    users.getRange(2, 1, 1, HEADERS.USERS.length).setValues([["admin", adminPin, "Administrator", "admin", "*", "*", "", "Bəli"]]);
  }
  var notes = ensureSheet_(ss, APP.SHEETS.NOTES, HEADERS.NOTES, [], [80, 70, 110, 220, 480, 160, 140]);
  notes.getRange("A:B").setNumberFormat("@");
  notes.getRange("G:G").setNumberFormat("dd.mm.yyyy hh:mm");
  getSecret_();

  var msg = "Vərəqlər hazırdır. İndi Fənlər, Siniflər, Şagirdlər və İstifadəçilər vərəqlərini doldurun, sonra «Deploy → New deployment» ilə veb tətbiqi yayımlayın.";
  if (adminPin) msg += "\n\nSizin admin girişiniz:\nLogin: admin\nŞifrə: " + adminPin + "\n\n(İstifadəçilər vərəqində dəyişə bilərsiniz.)";
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert("Sistem quruldu", msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) { /* redaktordan işlədildikdə */ }
}

function menuEnsureIds() {
  var n = readStudents_().length;
  try { SpreadsheetApp.getUi().alert("Hazırdır: " + n + " şagirdin ID-si yoxlanıldı."); } catch (e) { Logger.log(n); }
}

function resetSessions() {
  PropertiesService.getScriptProperties().setProperty("TOKEN_SECRET", Utilities.getUuid() + Utilities.getUuid());
  try { SpreadsheetApp.getUi().alert("Hamı sistemdən çıxarıldı. Növbəti dəfə yenidən login və şifrə ilə daxil olacaqlar."); } catch (e) { /* redaktor */ }
}

/* ============================ Veb tətbiq ============================ */

function doGet(e) {
  if (e && e.parameter && e.parameter.ping) return json_({ ok: true, app: APP.TITLE });
  try {
    return HtmlService.createHtmlOutputFromFile("Index")
      .setTitle(APP.TITLE)
      .addMetaTag("viewport", "width=device-width, initial-scale=1, viewport-fit=cover");
  } catch (err) {
    // Index faylı əlavə edilməyib: səhifə GitHub Pages-dədir, burada sadə məlumat göstərilir.
    return HtmlService.createHtmlOutput(
      '<div style="font:16px/1.5 system-ui,sans-serif;padding:24px;max-width:560px">' +
      '<h2 style="margin:0 0 8px">Server işləyir</h2>' +
      '<p style="margin:0">Bu ünvan qiymətləndirmə sisteminin serveridir. Müəllimlər sistemə GitHub Pages səhifəsindən daxil olurlar.</p>' +
      "</div>"
    ).setTitle(APP.TITLE);
  }
}

/** GitHub Pages səhifəsi bu ünvana POST göndərir (Content-Type: text/plain). */
function doPost(e) {
  var req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (err) {
    return json_({ ok: false, error: "bad_request", message: "Sorğu oxunmadı." });
  }
  return json_(handle_(req));
}

/** Apps Script linkindən açılan səhifə google.script.run ilə bunu çağırır. */
function api(payload) {
  var req;
  try { req = JSON.parse(String(payload || "{}")); } catch (err) {
    return JSON.stringify({ ok: false, error: "bad_request", message: "Sorğu oxunmadı." });
  }
  return JSON.stringify(handle_(req));
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function handle_(req) {
  try {
    req = req && typeof req === "object" ? req : {};
    var action = String(req.action || "");
    if (action === "login") return login_(req);
    var user = auth_(req.token);
    if (!user) return { ok: false, error: "auth", message: "Giriş vaxtı bitib. Yenidən daxil olun." };
    switch (action) {
      case "bootstrap": return bootstrap_(user);
      case "grades": return getGrades_(user, req);
      case "saveGrades": return saveGrades_(user, req);
      case "notes": return getNotes_(user, req);
      case "saveNotes": return saveNotes_(user, req);
      case "report": return getReport_(user, req);
    }
    return { ok: false, error: "bad_request", message: "Naməlum əməliyyat." };
  } catch (err) {
    if (err && err.userMessage) return { ok: false, error: err.code || "forbidden", message: err.userMessage };
    console.error(err && err.stack ? err.stack : String(err));
    return { ok: false, error: "server", message: "Serverdə xəta baş verdi. Bir az sonra yenidən cəhd edin." };
  }
}

function fail_(code, message) {
  var e = new Error(message);
  e.code = code;
  e.userMessage = message;
  return e;
}

/* ============================ Giriş ============================ */

function login_(req) {
  var login = String(req.login || "").trim();
  var password = String(req.password || "").trim();
  if (!login || !password) return { ok: false, error: "bad_request", message: "Login və şifrəni yazın." };
  var cache = CacheService.getScriptCache();
  var failKey = "fail_" + Utilities.base64EncodeWebSafe(fold_(login), Utilities.Charset.UTF_8).slice(0, 200);
  var fails = Number(cache.get(failKey) || 0);
  if (fails >= APP.MAX_LOGIN_FAILS) {
    return { ok: false, error: "rate", message: "Çox sayda uğursuz cəhd oldu. 10 dəqiqə sonra yenidən yoxlayın." };
  }
  var user = findUser_(login);
  if (!user || !user.active || !user.password || user.password !== password) {
    cache.put(failKey, String(fails + 1), 600);
    return { ok: false, error: "auth_failed", message: "Login və ya şifrə yanlışdır." };
  }
  cache.remove(failKey);
  var boot = bootstrap_(user);
  boot.token = makeToken_(user);
  return boot;
}

function makeToken_(user) {
  var payload = { l: user.login, x: Date.now() + APP.TOKEN_DAYS * 86400000, p: pwTag_(user.password) };
  var body = Utilities.base64EncodeWebSafe(JSON.stringify(payload), Utilities.Charset.UTF_8);
  return body + "." + sign_(body);
}

function auth_(token) {
  if (!token || typeof token !== "string") return null;
  var parts = token.split(".");
  if (parts.length !== 2 || sign_(parts[0]) !== parts[1]) return null;
  var payload;
  try {
    payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0], Utilities.Charset.UTF_8)).getDataAsString("UTF-8"));
  } catch (e) {
    return null;
  }
  if (!payload || !payload.l || !(payload.x > Date.now())) return null;
  var user = findUser_(payload.l);
  if (!user || !user.active || !user.password || pwTag_(user.password) !== payload.p) return null;
  return user;
}

function sign_(body) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(body, getSecret_(), Utilities.Charset.UTF_8));
}

/** Şifrə dəyişəndə köhnə girişlər avtomatik etibarsız olur. */
function pwTag_(password) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + "|" + getSecret_(), Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(digest).slice(0, 16);
}

function getSecret_() {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty("TOKEN_SECRET");
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty("TOKEN_SECRET", secret);
  }
  return secret;
}

/* ============================ Oxuma ============================ */

function sheet_(name) {
  var sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw fail_("setup", "Sistem qurulmayıb: cədvəldə «Qiymətləndirmə → Sistemi qur» menyusunu işə salın («" + name + "» vərəqi yoxdur).");
  return sh;
}

function readUsers_() {
  var vals = sheet_(APP.SHEETS.USERS).getDataRange().getValues();
  var out = [];
  for (var i = 1; i < vals.length; i++) {
    var r = vals[i];
    var login = String(r[0] == null ? "" : r[0]).trim();
    if (!login) continue;
    out.push({
      login: login,
      password: String(r[1] == null ? "" : r[1]).trim(),
      name: String(r[2] || "").trim() || login,
      roles: parseRoles_(r[3]),
      subjects: parseList_(r[4]),
      classes: parseList_(r[5]),
      homeroom: parseList_(r[6]),
      active: !/^(xeyr|yox|no|false|0|deaktiv|passiv)$/.test(fold_(r[7]))
    });
  }
  return out;
}

function findUser_(login) {
  var key = fold_(login);
  var users = readUsers_();
  for (var i = 0; i < users.length; i++) if (fold_(users[i].login) === key) return users[i];
  return null;
}

function readSettings_() {
  var vals = sheet_(APP.SHEETS.SETTINGS).getDataRange().getValues();
  var s = { school: "", head: "" };
  vals.forEach(function (r) {
    var k = fold_(r[0]);
    var v = String(r[1] == null ? "" : r[1]).trim();
    if (k === "mektebin adi" || k === "mekteb adi") s.school = v;
    else if (k === "mekteb rehberi" || k === "direktor") s.head = v;
  });
  return s;
}

function readSubjects_() {
  var vals = sheet_(APP.SHEETS.SUBJECTS).getDataRange().getValues();
  var seen = {}, out = [];
  for (var i = 1; i < vals.length; i++) {
    var name = String(vals[i][0] == null ? "" : vals[i][0]).trim().replace(/\s+/g, " ");
    if (!name || seen[subjKey_(name)]) continue;
    seen[subjKey_(name)] = true;
    out.push(name);
  }
  return out;
}

/** Şagirdləri oxuyur; ID-si olmayan və ya təkrarlanan ID-li sətirlərə yeni ID verir. */
function readStudents_() {
  var sh = sheet_(APP.SHEETS.STUDENTS);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, 3).getValues();
  if (needsIds_(vals)) {
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      last = sh.getLastRow();
      vals = last >= 2 ? sh.getRange(2, 1, last - 1, 3).getValues() : [];
      if (needsIds_(vals)) {
        var seen = {};
        var ids = vals.map(function (r) {
          var id = String(r[0] == null ? "" : r[0]).trim();
          var named = String(r[2] == null ? "" : r[2]).trim();
          if (named && (!id || seen[id])) id = newStudentId_();
          if (id) seen[id] = true;
          return [id];
        });
        sh.getRange(2, 1, ids.length, 1).setValues(ids);
        vals = vals.map(function (r, i) { return [ids[i][0], r[1], r[2]]; });
      }
    } finally {
      lock.releaseLock();
    }
  }
  var out = [];
  vals.forEach(function (r) {
    var id = String(r[0] == null ? "" : r[0]).trim();
    var cls = String(r[1] == null ? "" : r[1]).trim().replace(/\s+/g, " ");
    var name = String(r[2] == null ? "" : r[2]).trim().replace(/\s+/g, " ");
    if (id && cls && name) out.push({ id: id, cls: cls, name: name });
  });
  return out;
}

function needsIds_(vals) {
  var seen = {};
  for (var i = 0; i < vals.length; i++) {
    var id = String(vals[i][0] == null ? "" : vals[i][0]).trim();
    var named = String(vals[i][2] == null ? "" : vals[i][2]).trim();
    if (named && (!id || seen[id])) return true;
    if (id) seen[id] = true;
  }
  return false;
}

function newStudentId_() {
  return "s" + Utilities.getUuid().replace(/-/g, "").slice(0, 10);
}

/** [{name, students:[{id,name}]}] — sinif adları rəqəm nəzərə alınaraq sıralanır (5A, 9B, 10A, 11A). */
function groupClasses_(students) {
  var map = {}, list = [];
  students.forEach(function (s) {
    var key = classKey_(s.cls);
    if (!map[key]) { map[key] = { name: s.cls, students: [] }; list.push(map[key]); }
    map[key].students.push({ id: s.id, name: s.name });
  });
  list.sort(function (a, b) {
    var na = parseInt(a.name, 10), nb = parseInt(b.name, 10);
    if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
    if (isNaN(na) !== isNaN(nb)) return isNaN(na) ? 1 : -1;
    return fold_(a.name) < fold_(b.name) ? -1 : fold_(a.name) > fold_(b.name) ? 1 : 0;
  });
  return list;
}

/** Siniflər vərəqi: hər sinfin qrupu və həmin sinifdə qiymətləndirilən fənlər (Fənlər vərəqindəki sıra ilə). */
function readClassInfo_(subjects) {
  var sh = SpreadsheetApp.getActive().getSheetByName(APP.SHEETS.CLASSES);
  var map = {};
  if (!sh) return map;
  readRows_(sh, HEADERS.CLASSES.length).forEach(function (r) {
    var key = classKey_(r[0]);
    if (!key) return;
    var wanted = parseList_(r[2]);
    var list = null;
    if (wanted.length && wanted[0] !== "*") {
      var keys = wanted.map(subjKey_);
      list = subjects.filter(function (s) { return keys.indexOf(subjKey_(s)) >= 0; });
    }
    map[key] = { group: String(r[1] == null ? "" : r[1]).trim(), subjects: list };
  });
  return map;
}

function ctx_(user) {
  var subjects = readSubjects_();
  var classes = groupClasses_(readStudents_());
  var info = readClassInfo_(subjects);
  classes.forEach(function (c) {
    var i = info[classKey_(c.name)];
    c.group = i ? i.group : "";
    c.subjects = i && i.subjects ? i.subjects : subjects.slice();
  });
  return { subjects: subjects, classes: classes, perm: permissions_(user, subjects, classes) };
}

/**
 * grade.byClass: hər sinif üçün bu istifadəçinin qiymət yaza biləcəyi fənlər
 * (müəllimin fənləri ilə sinfin fənlərinin kəsişməsi).
 */
function permissions_(user, subjects, classes) {
  var all = classes.map(function (c) { return c.name; });
  var p = { grade: { classes: [], subjects: [], byClass: {} }, notes: { classes: [] }, reports: { classes: [] } };
  var isAdmin = user.roles.indexOf("admin") >= 0;
  if (isAdmin || user.roles.indexOf("teacher") >= 0) {
    var tClasses = isAdmin ? all : pick_(user.classes, all, classKey_);
    var tKeys = (isAdmin ? subjects : pick_(user.subjects, subjects, subjKey_)).map(subjKey_);
    classes.forEach(function (c) {
      if (tClasses.indexOf(c.name) < 0) return;
      var list = c.subjects.filter(function (s) { return tKeys.indexOf(subjKey_(s)) >= 0; });
      if (!list.length) return;
      p.grade.classes.push(c.name);
      p.grade.byClass[c.name] = list;
    });
    p.grade.subjects = subjects.filter(function (s) {
      return p.grade.classes.some(function (n) { return p.grade.byClass[n].indexOf(s) >= 0; });
    });
  }
  if (isAdmin) {
    p.notes.classes = all.slice();
    p.reports.classes = all.slice();
    return p;
  }
  if (user.roles.indexOf("psych") >= 0) {
    p.notes.classes = user.classes.length ? pick_(user.classes, all, classKey_) : all.slice();
  }
  if (user.roles.indexOf("homeroom") >= 0) {
    p.reports.classes = pick_(user.homeroom, all, classKey_);
  }
  return p;
}

function pick_(wanted, universe, keyFn) {
  if (wanted.indexOf("*") >= 0) return universe.slice();
  var keys = wanted.map(keyFn);
  return universe.filter(function (x) { return keys.indexOf(keyFn(x)) >= 0; });
}

function bootstrap_(user) {
  var settings = readSettings_();
  var c = ctx_(user);
  var allowed = {};
  [c.perm.grade.classes, c.perm.notes.classes, c.perm.reports.classes].forEach(function (list) {
    list.forEach(function (name) { allowed[classKey_(name)] = true; });
  });
  return {
    ok: true,
    user: { login: user.login, name: user.name, roles: user.roles },
    school: settings.school,
    head: settings.head,
    subjects: c.subjects,
    classes: c.classes.filter(function (k) { return allowed[classKey_(k.name)]; }),
    perm: c.perm,
    sheetUrl: user.roles.indexOf("admin") >= 0 ? SpreadsheetApp.getActive().getUrl() : ""
  };
}

/* ============================ Qiymətlər ============================ */

function checkMonth_(m) {
  m = String(m || "");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) throw fail_("bad_request", "Ay düzgün seçilməyib.");
  return m;
}

function classIn_(allowed, classes, name) {
  var key = classKey_(name);
  if (!key || !allowed.some(function (a) { return classKey_(a) === key; })) throw fail_("forbidden", "Bu sinif üçün icazəniz yoxdur.");
  var cls = classes.filter(function (c) { return classKey_(c.name) === key; })[0];
  if (!cls) throw fail_("bad_request", "Sinif tapılmadı.");
  return cls;
}

function subjectIn_(allowed, name) {
  var key = subjKey_(name);
  var s = allowed.filter(function (a) { return subjKey_(a) === key; })[0];
  if (!key || !s) throw fail_("forbidden", "Bu fənn üçün icazəniz yoxdur.");
  return s;
}

function gradeSheet_(month, create) {
  var ss = SpreadsheetApp.getActive();
  var name = APP.SHEETS.GRADES_PREFIX + month;
  var sh = ss.getSheetByName(name);
  if (!sh && create) {
    sh = ss.insertSheet(name);
    setHeader_(sh, HEADERS.GRADES, [80, 70, 110, 220, 160, 90, 90, 90, 90, 90, 70, 180, 140]);
    sh.getRange("A:B").setNumberFormat("@");
    sh.getRange("K:K").setNumberFormat("0.00");
    sh.getRange("M:M").setNumberFormat("dd.mm.yyyy hh:mm");
  }
  return sh;
}

function readRows_(sh, width) {
  if (!sh) return [];
  var last = sh.getLastRow();
  return last >= 2 ? sh.getRange(2, 1, last - 1, width).getValues() : [];
}

function cleanMark_(v) {
  var n = Math.round(Number(v));
  return n >= 1 && n <= 5 ? n : 0;
}

function marksOf_(row) {
  return [row[5], row[6], row[7], row[8], row[9]].map(cleanMark_);
}

function timeOf_(v) {
  return v instanceof Date ? v.getTime() : (typeof v === "number" ? v : 0);
}

/** Cədvəl «2026-10» yazısını tarixə çevirmiş olsa belə, ayı eyni formada qaytarır. */
function monthOf_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), "yyyy-MM");
  return String(v == null ? "" : v).trim();
}

function getGrades_(user, req) {
  var month = checkMonth_(req.month);
  var c = ctx_(user);
  var cls = classIn_(c.perm.grade.classes, c.classes, req.cls);
  var subject = subjectIn_(c.perm.grade.byClass[cls.name] || [], req.subject);
  var ids = idSet_(cls);
  var sk = subjKey_(subject);
  var res = { ok: true, entries: {}, by: "", at: 0 };
  readRows_(gradeSheet_(month, false), HEADERS.GRADES.length).forEach(function (r) {
    var sid = String(r[2]);
    if (!ids[sid] || subjKey_(r[4]) !== sk) return;
    res.entries[sid] = marksOf_(r);
    var t = timeOf_(r[12]);
    if (t >= res.at) { res.at = t; res.by = String(r[11] || ""); }
  });
  return res;
}

function saveGrades_(user, req) {
  var month = checkMonth_(req.month);
  var c = ctx_(user);
  var cls = classIn_(c.perm.grade.classes, c.classes, req.cls);
  var subject = subjectIn_(c.perm.grade.byClass[cls.name] || [], req.subject);
  var byId = {};
  cls.students.forEach(function (s) { byId[s.id] = s; });
  var entries = req.entries && typeof req.entries === "object" ? req.entries : {};
  var updates = {}, count = 0;
  Object.keys(entries).forEach(function (sid) {
    if (!byId[sid] || !Array.isArray(entries[sid])) return;
    updates[sid] = [0, 1, 2, 3, 4].map(function (i) { return cleanMark_(entries[sid][i]); });
    count++;
  });
  var now = new Date();
  if (!count) return { ok: true, saved: 0, at: now.getTime() };

  var W = HEADERS.GRADES.length;
  var sk = subjKey_(subject);
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var sh = gradeSheet_(month, true);
    var vals = readRows_(sh, W);
    var rowOf = {};
    vals.forEach(function (r, i) { if (r[2] && subjKey_(r[4]) === sk) rowOf[String(r[2])] = i; });
    var changed = {}, appends = [];
    Object.keys(updates).forEach(function (sid) {
      var m = updates[sid];
      var avg = meanMarks_(m);
      var row = [month, cls.name, sid, byId[sid].name, subject,
        m[0] || "", m[1] || "", m[2] || "", m[3] || "", m[4] || "",
        avg == null ? "" : Math.round(avg * 100) / 100, user.name, now];
      if (Object.prototype.hasOwnProperty.call(rowOf, sid)) changed[rowOf[sid]] = row;
      else appends.push(row);
    });
    writeRuns_(sh, changed, W);
    if (appends.length) sh.getRange(sh.getLastRow() + 1, 1, appends.length, W).setValues(appends);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  return { ok: true, saved: count, at: now.getTime() };
}

/** Dəyişən sətirləri ardıcıl bloklar şəklində yazır (hər sətir üçün ayrıca çağırış etmədən). */
function writeRuns_(sh, changed, width) {
  var idx = Object.keys(changed).map(Number).sort(function (a, b) { return a - b; });
  var i = 0;
  while (i < idx.length) {
    var j = i;
    while (j + 1 < idx.length && idx[j + 1] === idx[j] + 1) j++;
    var block = idx.slice(i, j + 1).map(function (k) { return changed[k]; });
    sh.getRange(idx[i] + 2, 1, block.length, width).setValues(block);
    i = j + 1;
  }
}

function meanMarks_(m) {
  var s = 0, n = 0;
  m.forEach(function (v) { if (v >= 1 && v <= 5) { s += v; n++; } });
  return n ? s / n : null;
}

function idSet_(cls) {
  var ids = {};
  cls.students.forEach(function (s) { ids[s.id] = true; });
  return ids;
}

/* ============================ Psixoloq qeydləri ============================ */

function readNotes_(month, ids) {
  var res = { entries: {}, by: "", at: 0 };
  readRows_(sheet_(APP.SHEETS.NOTES), HEADERS.NOTES.length).forEach(function (r) {
    var sid = String(r[2]);
    if (monthOf_(r[0]) !== month || !ids[sid]) return;
    res.entries[sid] = String(r[4] == null ? "" : r[4]);
    var t = timeOf_(r[6]);
    if (t >= res.at) { res.at = t; res.by = String(r[5] || ""); }
  });
  return res;
}

function getNotes_(user, req) {
  var month = checkMonth_(req.month);
  var c = ctx_(user);
  var cls = classIn_(c.perm.notes.classes, c.classes, req.cls);
  var res = readNotes_(month, idSet_(cls));
  res.ok = true;
  return res;
}

function saveNotes_(user, req) {
  var month = checkMonth_(req.month);
  var c = ctx_(user);
  var cls = classIn_(c.perm.notes.classes, c.classes, req.cls);
  var byId = {};
  cls.students.forEach(function (s) { byId[s.id] = s; });
  var entries = req.entries && typeof req.entries === "object" ? req.entries : {};
  var updates = {}, count = 0;
  Object.keys(entries).forEach(function (sid) {
    if (!byId[sid]) return;
    updates[sid] = String(entries[sid] == null ? "" : entries[sid]).slice(0, APP.NOTE_MAX);
    count++;
  });
  var now = new Date();
  if (!count) return { ok: true, saved: 0, at: now.getTime() };

  var W = HEADERS.NOTES.length;
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var sh = sheet_(APP.SHEETS.NOTES);
    var vals = readRows_(sh, W);
    var rowOf = {};
    vals.forEach(function (r, i) { if (monthOf_(r[0]) === month && r[2]) rowOf[String(r[2])] = i; });
    var changed = {}, appends = [];
    Object.keys(updates).forEach(function (sid) {
      var row = [month, cls.name, sid, byId[sid].name, updates[sid], user.name, now];
      if (Object.prototype.hasOwnProperty.call(rowOf, sid)) changed[rowOf[sid]] = row;
      else if (updates[sid].trim()) appends.push(row);
    });
    writeRuns_(sh, changed, W);
    if (appends.length) sh.getRange(sh.getLastRow() + 1, 1, appends.length, W).setValues(appends);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  return { ok: true, saved: count, at: now.getTime() };
}

/* ============================ Protokol ============================ */

function getReport_(user, req) {
  var month = checkMonth_(req.month);
  var c = ctx_(user);
  var cls = classIn_(c.perm.reports.classes, c.classes, req.cls);
  var ids = idSet_(cls);
  var bySubjectKey = {};
  var grades = {}, by = {}, at = {};
  cls.subjects.forEach(function (s) { bySubjectKey[subjKey_(s)] = s; grades[s] = {}; });
  readRows_(gradeSheet_(month, false), HEADERS.GRADES.length).forEach(function (r) {
    var sid = String(r[2]);
    var subject = bySubjectKey[subjKey_(r[4])];
    if (!ids[sid] || !subject) return;
    grades[subject][sid] = marksOf_(r);
    var t = timeOf_(r[12]);
    if (!(subject in at) || t >= at[subject]) { at[subject] = t; by[subject] = String(r[11] || ""); }
  });
  return { ok: true, subjects: cls.subjects, group: cls.group, grades: grades, by: by, notes: readNotes_(month, ids).entries };
}

/* ============================ Köməkçilər ============================ */

/** Müqayisə üçün: kiçik hərf, Azərbaycan hərfləri latın qarşılığına (ə→e, ı→i, ş→s ...). */
function fold_(s) {
  return String(s == null ? "" : s).toLowerCase()
    .replace(/̇/g, "")
    .replace(/ı/g, "i").replace(/ə/g, "e").replace(/ö/g, "o").replace(/ü/g, "u")
    .replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g")
    .replace(/\s+/g, " ").trim();
}

function classKey_(s) { return fold_(s).replace(/[\s\-–.\/]/g, ""); }
function subjKey_(s) { return fold_(s); }

function parseList_(v) {
  var items = String(v == null ? "" : v).split(/[,;\n]+/).map(function (x) { return x.trim(); }).filter(Boolean);
  for (var i = 0; i < items.length; i++) {
    var f = fold_(items[i]);
    if (items[i] === "*" || f === "hamisi" || f === "butun" || f === "hamısı") return ["*"];
  }
  return items;
}

function parseRoles_(v) {
  var out = [];
  parseList_(v).forEach(function (item) {
    var f = fold_(item);
    var role = "";
    if (f.indexOf("admin") >= 0 || f.indexOf("direktor") >= 0 || (f.indexOf("rehber") >= 0 && f.indexOf("sinif") < 0)) role = "admin";
    else if (f.indexOf("sinif") >= 0) role = "homeroom";
    else if (f.indexOf("psix") >= 0 || f.indexOf("psik") >= 0) role = "psych";
    else if (f.indexOf("muel") >= 0 || f.indexOf("teacher") >= 0) role = "teacher";
    if (role && out.indexOf(role) < 0) out.push(role);
  });
  return out;
}

function setHeader_(sh, headers, widths) {
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#eef0f4");
  sh.setFrozenRows(1);
  (widths || []).forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
}

function ensureSheet_(ss, name, headers, rows, widths) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    setHeader_(sh, headers, widths);
    if (rows.length) sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
  } else if (!String(sh.getRange(1, 1).getValue()).trim()) {
    setHeader_(sh, headers, widths);
  }
  return sh;
}

function ensureHelp_(ss) {
  if (ss.getSheetByName(APP.SHEETS.HELP)) return;
  var sh = ss.insertSheet(APP.SHEETS.HELP, 0);
  var lines = [
    ["Aylıq qiymətləndirmə protokolu — qısa təlimat"],
    [""],
    ["1. Ayarlar: məktəbin adını və məktəb rəhbərinin adını yazın (protokolda çap olunur)."],
    ["2. Fənlər: hər sətirdə bir fənn. Protokolda fənlər bu sıra ilə çıxır."],
    ["3. Siniflər: hər sinfin qrupunu (məs. I qrup) və həmin sinifdə qiymətləndirilən fənləri vergüllə yazın. Fənlər boş qalsa, bütün fənlər."],
    ["4. Şagirdlər: Sinif (məs. 10 a 1) və Soyadı, adı. ID sütunu avtomatik dolur, dəyişməyin."],
    ["5. İstifadəçilər: hər müəllimə login və şifrə verin."],
    ["   Rol: müəllim — öz fənləri və sinifləri üzrə qiymət yazır."],
    ["   Rol: psixoloq — psixoloq qeydlərini yazır (Dərs dediyi siniflər boşdursa, bütün siniflər)."],
    ["   Rol: sinif rəhbəri — «Rəhbəri olduğu sinif» sütunundakı sinfin protokollarını PDF kimi çıxarır."],
    ["   Rol: admin — hər şeyi görür və edir. Bir neçə rol vergüllə yazıla bilər."],
    ["   Fənlər və siniflər vergüllə yazılır; hamısı üçün * yazın. Aktiv = Xeyr olsa, giriş bağlanır."],
    ["6. Qiymətlər hər ay üçün «Qiymətlər 2026-10» kimi ayrıca vərəqdə avtomatik yaranır."],
    ["7. Fənnin adını dəyişsəniz, köhnə adla yazılmış qiymətlər protokolda görünməz — adı aylıq vərəqlərdə də dəyişin."],
    ["8. Şifrəni dəyişmək həmin istifadəçini bütün cihazlardan çıxarır. Hamını çıxarmaq üçün: menyu → Bütün istifadəçiləri sistemdən çıxar."]
  ];
  sh.getRange(1, 1, lines.length, 1).setValues(lines);
  sh.getRange("A1").setFontWeight("bold").setFontSize(13);
  sh.setColumnWidth(1, 760);
}
