/***********************************************
 * Evergreen + Google eSignature + Simpro (Apps Script)
 * - 템플릿 복사/치환 → HR 수동 eSignature
 * - 완료 판정: _ToSign Google Docs 수 === _Signed PDF 수 === eSig-Complete 라벨 수(직원별)
 * - 완료 시 Simpro 등록
 * - Gmail Watch 5일 주기 자동 갱신 + 증분 히스토리 처리 + 만료 복구
 ***********************************************/

/* ========================= 설정/상수 ========================= */

// 폼 응답 탭 이름
const SHEET_NAME = 'Google';

// Evergreen 루트 폴더 ID / 디렉터리 이름
const EVERGREEN_ROOT_FOLDER_ID = '1FP_pzHPBX1M-Jm7captuNeMgWwPFpS2w';
const SOURCE_TEMPLATES_DIRNAME = '_SourceTemplates';
const EMPLOYEES_DIRNAME = 'Employees';

// HR 계정(라벨은 이 계정 편지함에서 감시)
const HR_EMAIL = 'bomul10258034@gmail.com';

const STATUS = {
  PENDING: 'Pending',
  PREPARED: 'Prepared',
  SIGNING: 'Signing',     // _Signed에 PDF 1개 이상 생기면
  COMPLETE: 'Complete',   // targetDocs == _Signed PDFs == eSig 라벨 수
  REGISTERED: 'Registered',
  ERROR: 'Error',
};

// === 폼 헤더 순서에 맞춘 컬럼(1부터) ===
// A:Timestamp(무시)
const COL = {
  NAME: 2, STREET: 3, SUBURB: 4, STATE: 5, POSTCODE: 6, COUNTRY: 7,
  PHONE: 8, EMAIL: 9, DOB: 10, POSITION: 11, DEPARTMENT: 12,
  STARTDATE: 13, PROBATION_END: 14,
  BANK_BSB: 15, BANK_ACC_NO: 16, BANK_ACC_NAME: 17,
  TFN: 18, ELEC_LIC: 19, DRIVER_LIC: 20,
  STATUS: 21, EMP_FOLDER_ID: 22, ERROR: 23
};

// Simpro (스크립트 속성에서 주입)
const props = PropertiesService.getScriptProperties();
const SIMPRO = {
  BASE: (props.getProperty('SIMPRO_BASE') || '').replace(/\/+$/,''),
  TOKEN: (props.getProperty('SIMPRO_API_TOKEN') || '').trim(),
  COMPANY_ID: String((props.getProperty('SIMPRO_COMPANY_ID') || '').trim()),
  DEFAULT_COMPANY_ID: parseInt((props.getProperty('SIMPRO_DEFAULT_COMPANY_ID') || '0').trim(), 10)
};

/* ============= 직원별 eSig-Complete 라벨 카운트 및 타깃 문서 수 ============= */
// 키는 empFolderId 사용

function _empKeyFromRow_(row){ return String(row[COL.EMP_FOLDER_ID - 1] || '').trim(); }

function _incEmpEsig_(empKey){
  if (!empKey) return;
  const p = PropertiesService.getScriptProperties();
  const key = 'ESIG_EMP__' + empKey;
  const n = parseInt(p.getProperty(key) || '0', 10) || 0;
  p.setProperty(key, String(n + 1));
}
function _getEmpEsig_(empKey){
  if (!empKey) return 0;
  const key = 'ESIG_EMP__' + empKey;
  return parseInt(PropertiesService.getScriptProperties().getProperty(key) || '0', 10) || 0;
}
function _clearEmpEsig_(empKey){
  if (!empKey) return;
  PropertiesService.getScriptProperties().deleteProperty('ESIG_EMP__' + empKey);
}

function _setEmpTargetDocs_(empKey, n){
  if (!empKey) return;
  PropertiesService.getScriptProperties().setProperty('ESIG_TARGET__' + empKey, String(n));
}
function _getEmpTargetDocs_(empKey){
  if (!empKey) return 0;
  return parseInt(PropertiesService.getScriptProperties().getProperty('ESIG_TARGET__' + empKey) || '0', 10) || 0;
}

/* ========================= 트리거 진입점 ========================= */

// 스프레드시트 “양식 제출” 트리거에 연결
function onFormSubmit(e) {
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
    const rowIdx = e && e.range ? e.range.getRow() : null;
    if (!rowIdx || rowIdx === 1) return;

    const row = sh.getRange(rowIdx, 1, 1, sh.getLastColumn()).getValues()[0];
    if (!rowIsReady_(row)) return;

    const empFolderId = ensureEmployeeFolders_(String(row[COL.NAME - 1] || ''), rowIdx);
    prepareToSignDocsForRow_(rowIdx, empFolderId); // 타깃 문서 수 설정 + 직원별 카운터 초기화 포함

    sh.getRange(rowIdx, COL.STATUS).setValue(STATUS.PREPARED);
    sh.getRange(rowIdx, COL.ERROR).setValue('');
  } catch (err) {
    const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
    const rowIdx = e && e.range ? e.range.getRow() : null;
    if (rowIdx) {
      sh.getRange(rowIdx, COL.STATUS).setValue(STATUS.ERROR);
      sh.getRange(rowIdx, COL.ERROR).setValue(String(err && err.message ? err.message : err));
    }
  }
}

// 수동/주기 실행용(옵션): Pending/Error만 다시 준비
function processPendingRows() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const rowIdx = i + 1;
    const status = String(rows[i][COL.STATUS - 1] || '').trim();
    if (status && status !== STATUS.PENDING && status !== STATUS.ERROR) continue;
    if (!rowIsReady_(rows[i])) continue;

    try {
      const empFolderId = ensureEmployeeFolders_(String(rows[i][COL.NAME - 1] || ''), rowIdx);
      prepareToSignDocsForRow_(rowIdx, empFolderId);
      sh.getRange(rowIdx, COL.STATUS).setValue(STATUS.PREPARED);
      sh.getRange(rowIdx, COL.ERROR).setValue('');
    } catch (err) {
      sh.getRange(rowIdx, COL.STATUS).setValue(STATUS.ERROR);
      sh.getRange(rowIdx, COL.ERROR).setValue(String(err && err.message ? err.message : err));
    }
  }
}

/* ========================= 스캔/진행 ========================= */

function countDocs_(folder){
  let n=0, it=folder.getFiles();
  while(it.hasNext()){
    const f=it.next();
    if (f.getMimeType() === MimeType.GOOGLE_DOCS) n++;
  }
  return n;
}
function countPdfs_(folder){
  let n=0, it=folder.getFiles();
  while(it.hasNext()){
    const f=it.next();
    if (f.getMimeType() === MimeType.PDF) n++;
  }
  return n;
}

function moveSignedDocs_(toSign, signed){
  const signedBases = new Set();
  const itSigned = signed.getFiles();
  while(itSigned.hasNext()){
    const f = itSigned.next();
    if (f.getMimeType() === MimeType.PDF) {
      signedBases.add(f.getName().replace(/\.[^.]+$/,''));
    }
  }
  const it = toSign.getFiles();
  while(it.hasNext()){
    const f = it.next();
    const mime = f.getMimeType();
    const base = f.getName().replace(/\.[^.]+$/,'');
    // _ToSign 안의 PDF만 이동
    if (mime === MimeType.PDF && !signedBases.has(base)) {
      f.moveTo(signed);
      signedBases.add(base);
    }
  }
}

function scanAndCompleteByRow_(rowIdx) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const row = sh.getRange(rowIdx, 1, 1, sh.getLastColumn()).getValues()[0];
  const status = String(row[COL.STATUS - 1] || '').trim();
  const empFolderId = String(row[COL.EMP_FOLDER_ID - 1] || '').trim();
  if (!empFolderId) return 'no emp folder';

  const empRoot = DriveApp.getFolderById(empFolderId);
  const toSign  = getOrCreateChildFolder_(empRoot, '_ToSign');
  const signed  = getOrCreateChildFolder_(empRoot, '_Signed');

  // _ToSign 안의 PDF를 _Signed로 이동(중복 방지)
  moveSignedDocs_(toSign, signed);

  const targetDocs = _getEmpTargetDocs_(empFolderId);
  const pdfsCount  = countPdfs_(signed);          // 완료 PDF 개수
  const labelCount = _getEmpEsig_(empFolderId);    // 직원별 라벨 카운트

  // SIGNING: PDF 1개 이상이면
  if (pdfsCount > 0 && status === STATUS.PREPARED) {
    sh.getRange(rowIdx, COL.STATUS).setValue(STATUS.SIGNING);
  }

  // COMPLETE/REGISTERED: 세 숫자가 모두 동일할 때
  if (targetDocs > 0 && pdfsCount === targetDocs && labelCount === targetDocs && status !== STATUS.REGISTERED) {
    sh.getRange(rowIdx, COL.STATUS).setValue(STATUS.COMPLETE);
    const reg = registerEmployeeInSimproFromRow_(row);
    if (reg.ok) {
      sh.getRange(rowIdx, COL.STATUS).setValue(STATUS.REGISTERED);
      sh.getRange(rowIdx, COL.ERROR).setValue('');
      return 'registered';
    } else {
      sh.getRange(rowIdx, COL.STATUS).setValue(STATUS.ERROR);
      sh.getRange(rowIdx, COL.ERROR).setValue('Simpro: ' + reg.error);
      return 'simpro error';
    }
  }
  return 'scanned';
}

function scanAndCompleteAll() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const rows = sh.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    const rowIdx = i + 1;
    const status = String(rows[i][COL.STATUS - 1] || '').trim();
    if (![STATUS.PREPARED, STATUS.SIGNING, STATUS.COMPLETE].includes(status)) continue;

    const empFolderId = String(rows[i][COL.EMP_FOLDER_ID - 1] || '').trim();
    if (!empFolderId) continue;

    try {
      const empRoot = DriveApp.getFolderById(empFolderId);
      const toSign  = getOrCreateChildFolder_(empRoot, '_ToSign');
      const signed  = getOrCreateChildFolder_(empRoot, '_Signed');

      moveSignedDocs_(toSign, signed);

      const targetDocs = _getEmpTargetDocs_(empFolderId);
      const pdfsCount  = countPdfs_(signed);
      const labelCount = _getEmpEsig_(empFolderId);

      if (pdfsCount > 0 && status === STATUS.PREPARED) {
        sh.getRange(rowIdx, COL.STATUS).setValue(STATUS.SIGNING);
      }

      if (targetDocs > 0 && pdfsCount === targetDocs && labelCount === targetDocs && status !== STATUS.REGISTERED) {
        sh.getRange(rowIdx, COL.STATUS).setValue(STATUS.COMPLETE);
        const reg = registerEmployeeInSimproFromRow_(rows[i]);
        if (reg.ok) {
          sh.getRange(rowIdx, COL.STATUS).setValue(STATUS.REGISTERED);
          sh.getRange(rowIdx, COL.ERROR).setValue('');
        } else {
          sh.getRange(rowIdx, COL.STATUS).setValue(STATUS.ERROR);
          sh.getRange(rowIdx, COL.ERROR).setValue('Simpro: ' + reg.error);
        }
      }
    } catch (err) {
      sh.getRange(rowIdx, COL.STATUS).setValue(STATUS.ERROR);
      sh.getRange(rowIdx, COL.ERROR).setValue(String(err && err.message ? err.message : err));
    }
  }
}

/* ========================= 준비 단계 ========================= */

function rowIsReady_(rowArr) {
  // 필수: Name, Email, Position, Department, StartDate
  const must = [COL.NAME, COL.EMAIL, COL.POSITION, COL.DEPARTMENT, COL.STARTDATE];
  return must.every(c => String(rowArr[c - 1] || '').toString().trim() !== '');
}

function ensureEmployeeFolders_(empName, rowIdx) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const evergreenRoot = DriveApp.getFolderById(EVERGREEN_ROOT_FOLDER_ID);
  const employeesRoot = getOrCreateChildFolder_(evergreenRoot, EMPLOYEES_DIRNAME);
  const empRoot = getOrCreateChildFolder_(employeesRoot, sanitizeName_(empName));
  getOrCreateChildFolder_(empRoot, '_ToSign');
  getOrCreateChildFolder_(empRoot, '_Signed');
  sh.getRange(rowIdx, COL.EMP_FOLDER_ID).setValue(empRoot.getId());
  return empRoot.getId();
}

function fileExists_(folder, name){
  const it = folder.getFilesByName(name);
  return it.hasNext();
}

function prepareToSignDocsForRow_(rowIdx, empFolderId) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const row = sh.getRange(rowIdx, 1, 1, sh.getLastColumn()).getValues()[0];

  const placeholders = buildPlaceholderMap_(row);
  const evergreenRoot = DriveApp.getFolderById(EVERGREEN_ROOT_FOLDER_ID);
  const source = getOrCreateChildFolder_(evergreenRoot, SOURCE_TEMPLATES_DIRNAME);

  const empRoot = DriveApp.getFolderById(empFolderId);
  const toSign = getOrCreateChildFolder_(empRoot, '_ToSign');

  const files = source.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    const targetName = prefixFileName_(f.getName(), row[COL.NAME - 1]); // "[이름] ..."
    if (fileExists_(toSign, targetName)) continue;

    const copied = f.makeCopy(targetName, toSign);

    if (copied.getMimeType() === MimeType.GOOGLE_DOCS) {
      const doc = DocumentApp.openById(copied.getId());
      replacePlaceholdersInDoc_(doc, placeholders);
      doc.saveAndClose();
    }
  }

  // 타깃 DOC 수 기록 + 직원별 라벨 카운터 초기화
  const targetDocs = countDocs_(toSign);
  _setEmpTargetDocs_(String(empFolderId), targetDocs);
  _clearEmpEsig_(String(empFolderId));
}

/* ========================= Gmail Watch / Webhook ========================= */
// 고급 Gmail API 필요 (Services → Gmail API ON)

/**
 * 최초 1회 설치: 라벨 찾고 Watch 등록, labelId/historyId 저장
 */
function installGmailWatch() {
  const PROJECT_ID = 'steady-syntax-460808-c0';
  const TOPIC = `projects/${PROJECT_ID}/topics/esignature-complete`;

  const labels = Gmail.Users.Labels.list('me').labels || [];
  const label = labels.find(l => l.name === 'eSig-Complete');
  if (!label) throw new Error('Gmail label "eSig-Complete" not found');

  // 기존 구독 정리(옵션)
  try { Gmail.Users.stop('me'); } catch(_) {}

  // watch 등록
  const res = Gmail.Users.watch({
    topicName: TOPIC,
    labelIds: [label.id],
    labelFilterAction: 'include'
  }, 'me');

  const p = PropertiesService.getScriptProperties();
  if (res.historyId) p.setProperty('GMAIL_HISTORY_ID', String(res.historyId));
  p.setProperty('GMAIL_LABEL_ESIG_COMPLETE_ID', label.id);
  p.setProperty('WATCH_LAST_RENEWED_AT', new Date().toISOString());
}

/**
 * 5일마다 자동 갱신 트리거 설치(1회)
 */
function installRenewTriggerOnce(){
  const fn = 'renewGmailWatch';
  const exists = ScriptApp.getProjectTriggers()
    .some(t => t.getHandlerFunction() === fn);
  if (!exists){
    ScriptApp.newTrigger(fn)
      .timeBased()
      .everyDays(5)
      .atHour(3)
      .create();
  }
}

/**
 * 5일마다 watch 재등록
 */
function renewGmailWatch(){
  const p = PropertiesService.getScriptProperties();
  try { Gmail.Users.stop('me'); } catch(_) {}
  installGmailWatch();
  p.setProperty('WATCH_LAST_RENEWED_AT', new Date().toISOString());
}

/**
 * Gmail Pub/Sub 수신 엔드포인트
 * - 증분 히스토리로 새로 추가된 eSig-Complete 라벨 메일만 집계
 * - 제목의 [SanitizedName]로 직원 매핑 → 해당 직원 카운터 +1
 * - 처리 후 historyId 갱신 → 전체 스캔 및 완료 판정
 */
function doPost(e) {
  try {
    const p = PropertiesService.getScriptProperties();
    const labelId = p.getProperty('GMAIL_LABEL_ESIG_COMPLETE_ID');
    if (!labelId) return ContentService.createTextOutput('missing label id');

    // Pub/Sub 바디 디코드
    let body = {};
    try {
      const raw = e?.postData?.contents || '';
      body = raw ? JSON.parse(raw) : {};
      if (body?.message?.data) {
        const decoded = Utilities.newBlob(Utilities.base64Decode(body.message.data)).getDataAsString('utf-8');
        const inner = JSON.parse(decoded);
        // Gmail push 형식: {"emailAddress":"...","historyId":"..."}
        body = Object.assign({}, body, inner);
      }
    } catch (_) {}

    const startHistoryId = p.getProperty('GMAIL_HISTORY_ID') || String(body.historyId || '');
    if (!startHistoryId) return ContentService.createTextOutput('no start history');

    let pageToken = null, maxHistoryId = startHistoryId;
    const empKeyByName = _buildEmpKeyIndexByName_(); // "sanitized name" → empFolderId

    do {
      const res = Gmail.Users.History.list('me', {
        startHistoryId: startHistoryId,
        pageToken: pageToken,
        labelId: labelId
      });

      (res.history || []).forEach(h => {
        if (h.id && (String(h.id) > String(maxHistoryId))) maxHistoryId = String(h.id);
        (h.messagesAdded || []).forEach(ma => {
          const m = ma.message;
          if (!m || !(m.labelIds || []).includes(labelId)) return;

          // 제목으로 직원 매핑
          const msg = Gmail.Users.Messages.get('me', m.id, { format: 'metadata', metadataHeaders: ['Subject'] });
          const subject = (msg.payload?.headers || []).find(hh => hh.name === 'Subject')?.value || '';

          let empKey = _matchEmpKeyBySubject_(subject, empKeyByName); // [Name] 매칭
          if (empKey) _incEmpEsig_(empKey);
        });
      });

      pageToken = res.nextPageToken || null;
    } while (pageToken);

    if (maxHistoryId) p.setProperty('GMAIL_HISTORY_ID', String(maxHistoryId));
    scanAndCompleteAll(); // 변경분 반영
    return ContentService.createTextOutput('ok');
  } catch (err) {
    // 히스토리 만료 복구 경로
    if (recoverIfHistoryTooOld_(err)) {
      scanAndCompleteAll();
      return ContentService.createTextOutput('recovered');
    }
    return ContentService.createTextOutput('error: ' + (err && err.message ? err.message : err));
  }
}

/**
 * 히스토리 만료(HistoryId too old) 복구
 * - 최근 라벨된 메시지 스냅샷 스캔(간단 버전: 제목만 확인하여 집계)
 * - watch 재설치 및 historyId 갱신
 */
function recoverIfHistoryTooOld_(err){
  const msg = String(err && err.message || err || '');
  if (!/HistoryId.*too.*old/i.test(msg)) return false;

  const p = PropertiesService.getScriptProperties();
  const labelId = p.getProperty('GMAIL_LABEL_ESIG_COMPLETE_ID');
  if (labelId){
    const empKeyByName = _buildEmpKeyIndexByName_();
    let pageToken = null, scanned = 0;
    do {
      const res = Gmail.Users.Messages.list('me', {
        labelIds: [labelId],
        maxResults: 100,
        pageToken
      });
      (res.messages || []).forEach(m => {
        try {
          const msg = Gmail.Users.Messages.get('me', m.id, { format: 'metadata', metadataHeaders: ['Subject'] });
          const subject = (msg.payload?.headers || []).find(hh => hh.name === 'Subject')?.value || '';
          const empKey = _matchEmpKeyBySubject_(subject, empKeyByName);
          if (empKey) _incEmpEsig_(empKey);
        } catch(_){}
      });
      scanned += (res.messages || []).length;
      pageToken = res.nextPageToken || null;
      if (scanned >= 500) break; // 과도 방지
    } while(pageToken);
  }

  try { Gmail.Users.stop('me'); } catch(_) {}
  installGmailWatch();
  return true;
}

/* ========================= Simpro ========================= */

function registerEmployeeInSimproFromRow_(row) {
  if (!SIMPRO.BASE || !SIMPRO.TOKEN) return { ok: false, error: 'SIMPRO_BASE or SIMPRO_API_TOKEN missing' };
  if (!SIMPRO.COMPANY_ID) return { ok: false, error: 'SIMPRO_COMPANY_ID missing' };
  if (!SIMPRO.DEFAULT_COMPANY_ID) return { ok: false, error: 'SIMPRO_DEFAULT_COMPANY_ID missing/invalid' };

  const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const name = String(row[COL.NAME - 1] || '').trim();
  const email = String(row[COL.EMAIL - 1] || '').trim();
  const position = String(row[COL.POSITION - 1] || '').trim();
  const startDate = row[COL.STARTDATE - 1]
    ? Utilities.formatDate(new Date(row[COL.STARTDATE - 1]), Session.getScriptTimeZone(), 'yyyy-MM-dd')
    : todayStr;
  const username = buildUsernameFromName_(name);
  const password = 'Evergreen1234!';

  const payload = {
    Name: name,
    Position: position,
    DateOfHire: startDate,
    PrimaryContact: { Email: email },
    AccountSetup: { Username: username, Password: password },
    DefaultCompany: SIMPRO.DEFAULT_COMPANY_ID
  };

  const url = `${SIMPRO.BASE}/api/v1.0/companies/${encodeURIComponent(SIMPRO.COMPANY_ID)}/employees/`;
  const resp = UrlFetchApp.fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SIMPRO.TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  return resp.getResponseCode() === 201
    ? { ok: true }
    : { ok: false, error: `HTTP_${resp.getResponseCode()}: ${resp.getContentText()}` };
}

/* ========================= 유틸 ========================= */

function getOrCreateChildFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function countFiles_(folder) {
  let n = 0; const it = folder.getFiles();
  while (it.hasNext()) { it.next(); n++; }
  return n;
}
function sanitizeName_(s) {
  s = String(s || '').trim();
  if (!s) s = 'employee-' + Date.now();
  return s.replace(/[\\/:*?"<>|#\[\]@]/g, '_');
}
function prefixFileName_(name, empName) {
  return `[${sanitizeName_(empName)}] ${name}`;
}
function escapeRegex_(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function buildPlaceholderMap_(row) {
  const fmtDate = v => v ? Utilities.formatDate(new Date(v), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '';
  return {
    Name: String(row[COL.NAME - 1] || ''),
    StreetAddress: String(row[COL.STREET - 1] || ''),
    Suburb: String(row[COL.SUBURB - 1] || ''),
    State: String(row[COL.STATE - 1] || ''),
    Postcode: String(row[COL.POSTCODE - 1] || ''),
    Country: String(row[COL.COUNTRY - 1] || ''),
    Phone: String(row[COL.PHONE - 1] || ''),
    Email: String(row[COL.EMAIL - 1] || ''),
    DateOfBirth: fmtDate(row[COL.DOB - 1]),
    Position: String(row[COL.POSITION - 1] || ''),
    Department: String(row[COL.DEPARTMENT - 1] || ''),
    StartDate: fmtDate(row[COL.STARTDATE - 1]),
    ProbationEnd: fmtDate(row[COL.PROBATION_END - 1]),
    BankBSB: String(row[COL.BANK_BSB - 1] || ''),
    BankAccountNo: String(row[COL.BANK_ACC_NO - 1] || ''),
    BankAccountName: String(row[COL.BANK_ACC_NAME - 1] || ''),
    TFN: String(row[COL.TFN - 1] || ''),
    ElectricalLicence: String(row[COL.ELEC_LIC - 1] || ''),
    DriverLicence: String(row[COL.DRIVER_LIC - 1] || '')
  };
}
function buildUsernameFromName_(name) {
  let base = String(name || '').toLowerCase().trim();
  base = base.replace(/[^a-z0-9]+/g, '.').replace(/\.+/g, '.').replace(/^\.|\.$/g, '');
  if (!base) base = 'employee' + Date.now();
  return base;
}
function replacePlaceholdersInDoc_(doc, map) {
  const safe = v => String(v ?? '').replace(/\$/g, '\\$');
  const buildPattern = k => '(?i)\\{\\{\\s*' + escapeRegex_(k) + '\\s*\\}\\}';

  const replaceInElement = (el) => {
    if (!el) return;
    if (el.editAsText) {
      const t = el.editAsText();
      Object.keys(map).forEach(k => t.replaceText(buildPattern(k), safe(map[k])));
      return;
    }
    const ElementType = DocumentApp.ElementType;
    if (el.getType && el.getType() === ElementType.TABLE) {
      const table = el.asTable();
      for (let r = 0; r < table.getNumRows(); r++) {
        const row = table.getRow(r);
        for (let c = 0; c < row.getNumCells(); c++) {
          const cell = row.getCell(c);
          for (let i = 0; i < cell.getNumChildren(); i++) {
            const child = cell.getChild(i);
            if (child.editAsText) {
              const t = child.editAsText();
              Object.keys(map).forEach(k => t.replaceText(buildPattern(k), safe(map[k])));
            }
          }
        }
      }
    }
  };

  const body   = doc.getBody();
  const header = doc.getHeader();
  const footer = doc.getFooter();

  for (let i = 0; i < body.getNumChildren(); i++) replaceInElement(body.getChild(i));
  replaceInElement(header);
  replaceInElement(footer);

  Object.keys(map).forEach(k => body.replaceText(buildPattern(k), safe(map[k])));
}

/**
 * 시트의 이름→empFolderId 인덱스 생성
 * Key는 sanitizeName(name)
 */
function _buildEmpKeyIndexByName_(){
  const map = new Map();
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const rows = sh.getDataRange().getValues();
  for (let i=1;i<rows.length;i++){
    const name = sanitizeName_(String(rows[i][COL.NAME - 1] || '').trim());
    const empId = String(rows[i][COL.EMP_FOLDER_ID - 1] || '').trim();
    if (name && empId) map.set(name, empId);
  }
  return map;
}

/**
 * 메일 제목에서 [SanitizedName] 패턴으로 직원 키 매칭
 */
function _matchEmpKeyBySubject_(subject, empKeyByName){
  if (!subject) return null;
  // 큰따옴표 안의 실제 문서제목을 우선 추출
  const quoted = subject.match(/"([^"]+)"/);
  const s = quoted ? quoted[1] : subject;

  // 문서제목 안에서 [토큰] 추출
  const m = s.match(/\[([^\]]+)\]/);
  if (m) {
    const token = sanitizeName_(m[1].trim()); // 예: '홍길동' -> '홍길동', 'dd' -> 'dd'
    if (empKeyByName.has(token)) return empKeyByName.get(token);
  }

  // 보조 휴리스틱: 사전에 등록된 이름 토큰이 제목에 그대로 포함되는지 검사
  for (const [name, key] of empKeyByName.entries()) {
    if (s.includes('[' + name + ']')) return key;
  }
  return null;
}

/* ========================= 초기 실행 가이드(수동) ========================= */
// 1) installGmailWatch() 실행
// 2) installRenewTriggerOnce() 실행


// 테스트: 특정 직원 이름을 가진 라벨 완료 메일이 들어왔다고 가정하고 카운트 증가
function testIncEmpEsig() {
  const empKeyByName = _buildEmpKeyIndexByName_();
  // 실제 받은 제목 형식으로 가정
  const fakeSubject = 'eSigned document ready: "[dd] Application for employment - 16/09/2025, 09:58"';
  const empKey = _matchEmpKeyBySubject_(fakeSubject, empKeyByName);
  if (empKey) {
    _incEmpEsig_(empKey);
    Logger.log("카운트 증가: " + empKey + " → " + _getEmpEsig_(empKey));
  } else {
    Logger.log("매칭 실패: 시트의 이름과 문서 제목의 [토큰]이 동일해야 함");
  }
}

function testListEsigCompleteMessages() {
  const p = PropertiesService.getScriptProperties();
  const labelId = p.getProperty('GMAIL_LABEL_ESIG_COMPLETE_ID');
  if (!labelId) throw new Error("라벨 ID 없음, installGmailWatch() 먼저 실행");
  
  const res = Gmail.Users.Messages.list('me', {
    labelIds: [labelId],
    maxResults: 10
  });
  (res.messages || []).forEach(m => {
    const msg = Gmail.Users.Messages.get('me', m.id, { format: 'metadata', metadataHeaders: ['Subject'] });
    const subject = (msg.payload?.headers || []).find(h => h.name === 'Subject')?.value;
    Logger.log("라벨된 메일: " + subject);
  });
}
function testDoPostSimulation() {
  const fakeEvent = {
    postData: {
      contents: JSON.stringify({
        message: {
          data: Utilities.base64Encode(
            JSON.stringify({ emailAddress: "bomul10258034@gmail.com", historyId: "1304000" })
          )
        }
      })
    }
  };
  const out = doPost(fakeEvent);
  Logger.log(out.getContent());
}
function cleanupOldProps(){
  const p = PropertiesService.getScriptProperties();
  const all = p.getProperties();
  Object.keys(all).forEach(k => {
    if (k.startsWith('ESIG_COUNT__') || k.startsWith('ESIG_DONE__')) {
      p.deleteProperty(k);
    }
  });
  // 참고: ESIG_EMP__, GMAIL_HISTORY_ID, GMAIL_LABEL_ESIG_COMPLETE_ID 는 유지
}