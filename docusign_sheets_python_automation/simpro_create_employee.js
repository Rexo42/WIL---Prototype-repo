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
function registerEmployeeInSimpro(name, email, opts) {
  const props  = PropertiesService.getScriptProperties();
  const BASE   = (props.getProperty('SIMPRO_BASE') || '').replace(/\/+$/,'');
  const token  = (props.getProperty('SIMPRO_API_TOKEN') || '').trim();
  const CID    = String((props.getProperty('SIMPRO_COMPANY_ID') || '').trim());         // ← 590
  const DEF_CO = parseInt((props.getProperty('SIMPRO_DEFAULT_COMPANY_ID') || '0').trim(), 10); // ← 590

  if (!BASE || !token) return { ok:false, error:'Missing SIMPRO_BASE or SIMPRO_API_TOKEN' };
  if (!CID)            return { ok:false, error:'SIMPRO_COMPANY_ID not set' };
  if (!DEF_CO)         return { ok:false, error:'SIMPRO_DEFAULT_COMPANY_ID not set or invalid' };

  Logger.log('CID(prop)= ' + CID);
  Logger.log('DEF_CO(prop)= ' + DEF_CO);

  const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const username = (opts && opts.username) || buildUsernameFromName_(name);
  const password = (opts && opts.password) || 'Password1234!';

 const payload = {
  Name: name,
  Position: (opts && opts.position) || '',
  DateOfHire: (opts && opts.dateOfHire) || todayStr,
  PrimaryContact: { Email: email },
  AccountSetup: { Username: username, Password: password },
  DefaultCompany: DEF_CO   // ✅ 이것만 필요
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
  if (code === 201) {
    const json = safeJson_(body) || {};
    return { ok: true, employeeId: json.ID, username, password };
  }
  return { ok:false, error:`HTTP_${code}: ${body}` };
}
/** ===== Hook: Call from Sheet row ===== */
function createSimproEmployeeFromRow_(sheet, row) {
  var name  = sheet.getRange(row, 1).getValue(); // COL.NAME
  var email = sheet.getRange(row, 2).getValue(); // COL.EMAIL
  var dept  = sheet.getRange(row, 3).getValue(); // COL.DEPT

  var res = registerEmployeeInSimpro(name, email, { position: dept });

  var STATUS_COL = 4; // COL.STATUS
  var ERROR_COL  = 7; // COL.ERROR

  if (res.ok) {
    sheet.getRange(row, STATUS_COL).setValue('Registered');
    return true;
  } else {
    sheet.getRange(row, ERROR_COL).setValue('Simpro reg failed: ' + res.error);
    return false;
  }
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
  const row = 2; // 테스트 행 번호
  const ok = createSimproEmployeeFromRow_(sheet, row);
  Logger.log('Simpro create: ' + ok);
}

function testDirectCreate() {
  const res = registerEmployeeInSimpro(
    'Jane Test',
    'jane.test+1@example.com',
    { position: 'Electrical' }
  );
  Logger.log(JSON.stringify(res));
}