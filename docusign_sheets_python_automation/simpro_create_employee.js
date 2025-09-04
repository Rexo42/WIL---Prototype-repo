// @ts-nocheck
/***** ==================== Simpro Integration (Final Clean) ==================== ******
 * How it works
 * - Uses API Key (Bearer) auth to call Simpro API v1.0
 * - Endpoint: /api/v1.0/companies/{companyID}/employees/
 * - Payload fields used: Name, Position (from Department), DateOfHire, PrimaryContact.Email,
 *   AccountSetup.Username (from employee name), AccountSetup.Password ("Password1234!"),
 *   DefaultCompany (Script Properties에서 지정)
 *
 * Script Properties (File > Project properties > Script properties):
 *  SIMPRO_BASE                  = https://enterprise-sandbox-au.simprosuite.com
 *  SIMPRO_COMPANY_ID            = 590
 *  SIMPRO_API_TOKEN             = <your API key>
 *  SIMPRO_DEFAULT_COMPANY_ID    = 590   // Evergreen Electrical (or 원하는 회사 ID)
 ******************************************************************************/

/** ===== Public: Create employee in Simpro (name/email/opts) ===== */
// @ts-nocheck
/***** ==================== Simpro Integration (Final Clean) ==================== *****/

function registerEmployeeInSimpro(name, email, opts) {
  const props  = PropertiesService.getScriptProperties();
  const BASE   = (props.getProperty('SIMPRO_BASE') || '').replace(/\/+$/,'');
  const token  = (props.getProperty('SIMPRO_API_TOKEN') || '').trim();
  const CID    = String((props.getProperty('SIMPRO_COMPANY_ID') || '').trim());
  const DEF_CO = parseInt((props.getProperty('SIMPRO_DEFAULT_COMPANY_ID') || '0').trim(), 10);

  if (!BASE || !token) return { ok:false, error:'Missing SIMPRO_BASE or SIMPRO_API_TOKEN' };
  if (!CID)            return { ok:false, error:'SIMPRO_COMPANY_ID not set' };
  if (!DEF_CO)         return { ok:false, error:'SIMPRO_DEFAULT_COMPANY_ID not set or invalid' };

  Logger.log('CID(prop)= ' + CID);
  Logger.log('DEF_CO(prop)= ' + DEF_CO);

  const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const username = (opts && opts.username) || buildUsernameFromName_(name);
  const password = (opts && opts.password) || 'Evergreen1234!';

 const payload = {
  Name: name,
  Position: (opts && opts.position) || '',
  DateOfHire: (opts && opts.dateOfHire) || todayStr,
  PrimaryContact: { 
    Email: email
  },
  AccountSetup: { Username: username, Password: password },
  DefaultCompany: DEF_CO
};

  Logger.log('PAYLOAD=' + JSON.stringify(payload));

  const url = `${BASE}/api/v1.0/companies/${encodeURIComponent(CID)}/employees/`;
  Logger.log('POST URL = ' + url);

  const resp = UrlFetchApp.fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = resp.getResponseCode();
  const body = resp.getContentText();
  Logger.log('SIMPRO_RESP_CODE=' + code);
  Logger.log('SIMPRO_RESP_BODY=' + body);

  if (code === 201) {
    const json = safeJson_(body) || {};
    return { ok: true, employeeId: json.ID, username, password };
  }
  return { ok:false, error:`HTTP_${code}: ${body}` };
} // ⬅️ 이 중괄호가 꼭 필요합니다!
/** ===== Hook: Call from Sheet row ===== */
function createSimproEmployeeFromRow_(sheet, row) {
  var name  = sheet.getRange(row, COL.NAME).getValue();
  var email = sheet.getRange(row, COL.EMAIL).getValue();
  var pos   = sheet.getRange(row, COL.POSITION).getValue();
  var phone = sheet.getRange(row, COL.PHONE).getValue();
  var start = sheet.getRange(row, COL.STARTDATE).getValue();

  var res = registerEmployeeInSimpro(name, email, {
    position: pos,
    phone: normalizePhone_(phone),                 // 아래 3) 참고
    dateOfHire: start ? Utilities.formatDate(new Date(start), Session.getScriptTimeZone(), 'yyyy-MM-dd') : undefined,
  });

  if (res.ok) {
    sheet.getRange(row, COL.STATUS).setValue('Registered');
  } else {
    sheet.getRange(row, COL.ERROR).setValue('Simpro reg failed: ' + res.error);
  }
  return !!res.ok;
}

/* ==================== Helpers ==================== */

function buildUsernameFromName_(name) {
  var base = String(name || '').toLowerCase().trim();
  base = base.replace(/[^a-z0-9]+/g, '.'); // non-alnum → '.'
  base = base.replace(/\.+/g, '.');        // collapse multiple dots
  base = base.replace(/^\.|\.$/g, '');     // trim leading/trailing
  if (!base) base = 'employee' + Date.now();
  return base;
}

function safeJson_(text) {
  try { return JSON.parse(text); } catch(e) { return null; }
}

/** ===== Utilities / Tests ===== */

function testSimproAuth_basicListEmployees() {
  const p = PropertiesService.getScriptProperties();
  const BASE  = (p.getProperty('SIMPRO_BASE') || '').replace(/\/+$/,'');
  const CID   = p.getProperty('SIMPRO_COMPANY_ID') || '0';
  const token = p.getProperty('SIMPRO_API_TOKEN');
  const url   = `${BASE}/api/v1.0/companies/${encodeURIComponent(CID)}/employees/?pageSize=1`;

  const resp = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
    muteHttpExceptions: true
  });
  Logger.log(resp.getResponseCode() + ' ' + resp.getContentText());
}

function quickTest_CreateSimproFromRow() {
  const sheet = SpreadsheetApp.getActive().getSheetByName('NewEmployee');
  const row = 2; // 테스트할 행
  const name  = sheet.getRange(row, COL.NAME).getValue();
  const email = sheet.getRange(row, COL.EMAIL).getValue();
  const pos   = sheet.getRange(row, COL.POSITION).getValue();
  const phone = sheet.getRange(row, COL.PHONE).getValue();
  const start = sheet.getRange(row, COL.STARTDATE).getValue();

  const res = registerEmployeeInSimpro(name, email, {
    position: pos,
    phone: normalizePhone_(phone),
    dateOfHire: start ? Utilities.formatDate(new Date(start), Session.getScriptTimeZone(), 'yyyy-MM-dd') : undefined,
  });

  Logger.log('RES=' + JSON.stringify(res));
}

