/***** Evergreen + DocuSign (Latest Integrated Version) ************************************
 * ✅ Core Features
 *  - Sheet input → Send DocuSign template (recommended: installable onEdit trigger)
 *  - Webhook (doPost) receive → ENVID match, update status + save PDF to Drive/Evergreen/EmployeeName folder
 *  - If webhook ENVID match fails: backfill ENVID by matching recipient email, then process
 *
 * ✅ Stability Points
 *  - getAccessToken(): JWT→AccessToken cached for 55 minutes
 *  - generateJWTToken(): Enhanced error messages
 *  - All UrlFetch use muteHttpExceptions:true (log response body)
 *  - WebhookLog sheet logs RAW/PARSED/MATCHED/BACKFILLED_BY_EMAIL/NOT_FOUND and more
 *
 * ⚠️ Prerequisites
 *  1) appsscript.json OAuth scopes:
 *     - external_request, scriptapp, drive, spreadsheets
 *  2) WebApp deployment: "Execute as me / Anyone (anonymous)" (for DocuSign Connect)
 *  3) Sheet name: SHEET_NAME = 'NewEmployee'
 *  4) DocuSign template RoleName assumed to be 'Signer' (fields: Full Name, Email, etc.)
 *********************************************************************/

/*
@OnlyCurrentDoc
*/
function myPermissions() {
  // Dummy for permission approval
  SpreadsheetApp.getActiveSpreadsheet();
}

/* ========================= DocuSign Config ========================= */

const DOCUSIGN_CONFIG = {
  integrationKey: 'be5a7354-de60-476c-af4e-1a81f485163d',   // Integration Key (Client ID)
  userId:        '54cfdc04-afa7-41ce-a40d-9f4bf5ee8c79',    // User ID (GUID)
  basePath:      'https://demo.docusign.net/restapi',       // Demo REST API
  accountId:     '5327da65-5be7-47af-a1b1-ceb70dcf068f',    // API Account ID
  // PKCS#8 (-----BEGIN PRIVATE KEY-----) format private key
  privateKey: `-----BEGIN PRIVATE KEY-----
  ...existing key...
  -----END PRIVATE KEY-----`
};
// Evergreen root folder ID (string between /folders/ and ? in the URL)
const EVERGREEN_FOLDER_ID = '1FP_pzHPBX1M-Jm7captuNeMgWwPFpS2w';

const SHEET_NAME = 'NewEmployee';
const COL = { NAME: 1, EMAIL: 2, DEPT: 3, STATUS: 4, ENVID: 5, TIME: 6, ERROR: 7 };

/* ========================= Token Cache/Generation ========================= */

// 55 minute cache
function getAccessToken() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('docusign_access_token');
  if (hit) return hit;

  const res = generateJWTToken(true);
  if (!res || !res.accessToken) {
    throw new Error('JWT exchange failed: ' + (res && res.errorDetail ? res.errorDetail : 'unknown'));
  }
  cache.put('docusign_access_token', res.accessToken, 55 * 60);
  return res.accessToken;
}

// JWT generation + exchange
function generateJWTToken(returnDetail) {
  try {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 3600; // 1 hour
    const header = { typ: 'JWT', alg: 'RS256' };
    const payload = {
      iss: DOCUSIGN_CONFIG.integrationKey,
      sub: DOCUSIGN_CONFIG.userId,
      aud: 'account-d.docusign.com',
      iat: now, exp: exp,
      scope: 'signature impersonation'
    };

    const headerB64  = Utilities.base64EncodeWebSafe(JSON.stringify(header)).replace(/=+$/,'');
    const payloadB64 = Utilities.base64EncodeWebSafe(JSON.stringify(payload)).replace(/=+$/,'');
    const signData   = `${headerB64}.${payloadB64}`;

    const pemKey = (DOCUSIGN_CONFIG.privateKey || '').replace(/\r\n/g, '\n').trim();
    if (!/^-----BEGIN PRIVATE KEY-----\n[\s\S]+\n-----END PRIVATE KEY-----$/.test(pemKey)) {
      const msg = 'Private Key is not in PKCS#8 format.';
      return returnDetail ? { accessToken: null, errorDetail: msg } : null;
    }

    const signature = Utilities.base64EncodeWebSafe(
      Utilities.computeRsaSha256Signature(signData, pemKey)
    ).replace(/=+$/,'');

    const jwt = `${headerB64}.${payloadB64}.${signature}`;

    const tokenResponse = UrlFetchApp.fetch('https://account-d.docusign.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      payload: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
      muteHttpExceptions: true
    });

    if (tokenResponse.getResponseCode() === 200) {
      const tokenData = JSON.parse(tokenResponse.getContentText());
      return returnDetail ? { accessToken: tokenData.access_token, errorDetail: '' } : tokenData.access_token;
    } else {
      const body = tokenResponse.getContentText();
      return returnDetail ? { accessToken: null, errorDetail: body } : null;
    }
  } catch (error) {
    const msg = error && error.message ? error.message : String(error);
    return returnDetail ? { accessToken: null, errorDetail: msg } : null;
  }
}

/* ========================= Envelope Send/Status/Save ========================= */

// Send template (RoleName 'Signer', auto-merge Full Name/Email)
function sendDocuSignEnvelopeWithToken(name, email, department, accessToken) {
  try {
    const envelopeData = {
      templateId: '71704360-d1ec-49d4-94fc-05dcf1a81225',
      templateRoles: [
        { roleName: 'Signer', name: name, email: email }
      ],
      status: 'sent'
    };

    const url = `${DOCUSIGN_CONFIG.basePath}/v2.1/accounts/${DOCUSIGN_CONFIG.accountId}/envelopes`;
    const response = UrlFetchApp.fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      payload: JSON.stringify(envelopeData),
      muteHttpExceptions: true
    });

    Logger.log('DocuSign API response: ' + response.getContentText());
    if (response.getResponseCode() === 201) {
      const result = JSON.parse(response.getContentText());
      return { success: true, envelopeId: result.envelopeId };
    }
    return { success: false, error: response.getContentText() };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function saveEnvelopePdfToDrive(envelopeId, employeeName) {
  var logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('WebhookLog');
  if (!logSheet) logSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('WebhookLog');

  if (!envelopeId || String(envelopeId).trim() === '') {
    logSheet.appendRow([new Date(), 'SAVE_FAIL', 'NO_ENVELOPE_ID', employeeName]);
    return null;
  }

  let accessToken;
  try {
    accessToken = getAccessToken();
  } catch (e) {
    logSheet.appendRow([new Date(), 'SAVE_FAIL', 'TOKEN_ERROR', (e && e.message) || String(e)]);
    return null;
  }

  // 1) Evergreen root folder (fixed by ID)
  let employeeRoot;
  try {
    employeeRoot = DriveApp.getFolderById(EVERGREEN_FOLDER_ID);
  } catch (e) {
    logSheet.appendRow([new Date(), 'SAVE_FAIL', 'INVALID_FOLDER_ID', (e && e.message) || String(e)]);
    return null;
  }

  // 2) Employee name folder (exactly employeeName)
  let empFolder;
  const it = employeeRoot.getFoldersByName(employeeName);
  empFolder = it.hasNext() ? it.next() : employeeRoot.createFolder(employeeName);

  // 3) Download DocuSign combined PDF
  const url = `${DOCUSIGN_CONFIG.basePath}/v2.1/accounts/${DOCUSIGN_CONFIG.accountId}/envelopes/${encodeURIComponent(envelopeId)}/documents/combined`;
  const res = UrlFetchApp.fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/pdf'
    },
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  if (code === 200) {
    const blob = res.getBlob().setName(`${employeeName}_signed.pdf`);
    const file = empFolder.createFile(blob);
    logSheet.appendRow([new Date(), 'SAVE_OK', employeeName, envelopeId, file.getUrl()]);
    return file.getUrl();
  } else {
    // Log failure reason (HTTP code + body)
    logSheet.appendRow([new Date(), 'SAVE_FAIL', `HTTP_${code}`, envelopeId, res.getContentText()]);
    return null;
  }
}

// Status check (ENVID guard)
function getEnvelopeStatus(envelopeId) {
  if (!envelopeId || String(envelopeId).trim() === '') {
    throw new Error('envelopeId is empty.');
  }
  const accessToken = getAccessToken();
  const url = `${DOCUSIGN_CONFIG.basePath}/v2.1/accounts/${DOCUSIGN_CONFIG.accountId}/envelopes/${encodeURIComponent(envelopeId)}`;
  const r = UrlFetchApp.fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    },
    muteHttpExceptions: true
  });
  const code = r.getResponseCode();
  if (code !== 200) {
    throw new Error(`Status check failed (${code}): ${r.getContentText()}`);
  }
  return JSON.parse(r.getContentText());
}
/* ========================= Sheet Process ========================= */

// (Note) Simple onEdit(e) has limited external call permissions → recommend connecting the function below to an installable onEdit trigger
function onEdit(e) { /* Not used (installable trigger should connect to processPendingEmployees) */ }

// Pending → Send → After Sent, periodically check status (with webhook)
function processPendingEmployees() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data  = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const row   = i + 1;
    const name  = data[i][COL.NAME  - 1];
    const email = data[i][COL.EMAIL - 1];
    const dept  = data[i][COL.DEPT  - 1];
    let status  = data[i][COL.STATUS- 1];
    const envid = data[i][COL.ENVID - 1];

    if (envid || ["Sent","Complete","Error","Processing..."].includes(status)) continue;

    if (name && email && dept && !status) {
      sheet.getRange(row, COL.STATUS).setValue('Pending');
      status = 'Pending';
    }

    if (status === 'Pending') {
      processRow(sheet, row);
      Utilities.sleep(1500);
    }

    const currentStatus = sheet.getRange(row, COL.STATUS).getValue();
    if (currentStatus === 'Sent') {
      const envelopeId = sheet.getRange(row, COL.ENVID).getValue();
      if (envelopeId) {
        try {
          const st = getEnvelopeStatus(envelopeId);
          if (st.status === 'completed') {
            sheet.getRange(row, COL.STATUS).setValue('Complete');
            saveEnvelopePdfToDrive(envelopeId, name);
          } else if (st.status && st.status !== 'sent') {
            sheet.getRange(row, COL.STATUS).setValue(st.status);
          }
        } catch (e) {
          sheet.getRange(row, COL.ERROR).setValue('Status check failed: ' + (e.message || String(e)));
        }
      }
    }
  }
}

function processRow(sheet, row) {
  if (!sheet) return;

  const name   = sheet.getRange(row, COL.NAME ).getValue();
  const email  = sheet.getRange(row, COL.EMAIL).getValue();
  const dept   = sheet.getRange(row, COL.DEPT ).getValue();
  const status = sheet.getRange(row, COL.STATUS).getValue();
  const envid  = sheet.getRange(row, COL.ENVID ).getValue();
  if (envid || ["Sent","Complete","Error","Processing..."].includes(status)) return;

  try {
    let accessToken;
    try {
      accessToken = getAccessToken();
    } catch (e) {
      sheet.getRange(row, COL.STATUS).setValue('Error');
      sheet.getRange(row, COL.ERROR ).setValue('JWT token creation failed: ' + (e && e.message ? e.message : String(e)));
      return;
    }

    sheet.getRange(row, COL.STATUS).setValue('Processing...');
    const result = sendDocuSignEnvelopeWithToken(name, email, dept, accessToken);

    if (result.success) {
      sheet.getRange(row, COL.STATUS).setValue('Sent');
      sheet.getRange(row, COL.ENVID ).setValue(result.envelopeId);
      sheet.getRange(row, COL.TIME  ).setValue(new Date().toLocaleString());
      sheet.getRange(row, COL.ERROR ).setValue('');
      Logger.log('ENVID recorded row ' + row + ' : ' + result.envelopeId);
    } else {
      sheet.getRange(row, COL.STATUS).setValue('Error');
      sheet.getRange(row, COL.ERROR ).setValue('DocuSign send failed: ' + (result.error || ''));
    }
  } catch (err) {
    sheet.getRange(row, COL.STATUS).setValue('Error');
    sheet.getRange(row, COL.ERROR ).setValue(err && err.stack ? err.stack : (err && err.message ? err.message : 'Unknown error'));
  }
}

/* ========================= Webhook (Connect) ========================= */

// Helper: Get first signer's email/name from envelope
function _getFirstSignerInfo(envelopeId) {
  try {
    const accessToken = getAccessToken();
    const url = `${DOCUSIGN_CONFIG.basePath}/v2.1/accounts/${DOCUSIGN_CONFIG.accountId}/envelopes/${encodeURIComponent(envelopeId)}/recipients`;
    const r = UrlFetchApp.fetch(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' },
      muteHttpExceptions: true
    });
    if (r.getResponseCode() !== 200) {
      Logger.log('recipients fetch failed: ' + r.getContentText());
      return null;
    }
    const data = JSON.parse(r.getContentText());
    const signer = (data.signers && data.signers.length) ? data.signers[0] : null;
    if (!signer) return null;
    return { email: (signer.email || '').trim().toLowerCase(), name: signer.name || '' };
  } catch (e) {
    Logger.log('_getFirstSignerInfo error: ' + (e && e.message ? e.message : String(e)));
    return null;
  }
}
// Webhook endpoint (replacement)
function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var logSheet = ss.getSheetByName('WebhookLog');
    if (!logSheet) logSheet = ss.insertSheet('WebhookLog');

    // 0) RAW log
    var rawBody = e && e.postData ? e.postData.contents : 'NO_BODY';
    logSheet.appendRow([new Date(), 'RAW', rawBody]);

    // 1) Parse
    var data = {};
    try {
      data = e && e.postData ? JSON.parse(e.postData.contents) : {};
    } catch (parseErr) {
      logSheet.appendRow([new Date(), 'ERROR', 'JSON_PARSE_FAIL', String(parseErr)]);
      return ContentService.createTextOutput('Bad JSON');
    }

    // 2) Extract envelopeId / status
    var envelopeId =
      (data.envelopeId) ||
      (data.data && data.data.envelopeId) ||
      (data.envelopeSummary && data.envelopeSummary.envelopeId) || '';

    var rawStatus =
      data.status || data.event ||
      (data.data && data.data.status) ||
      (data.envelopeSummary && data.envelopeSummary.status) || '';

    // 3) Normalize status
    var lowered = String(rawStatus).toLowerCase().trim();
    var normalized = lowered.replace(/\s+/g, '').replace(/_/g, '-');
    var isCompleted = (
      normalized === 'completed' ||
      normalized === 'complete' ||
      normalized === 'envelope-completed' ||
      normalized === 'recipient-completed'
    );

    logSheet.appendRow([new Date(), 'PARSED', envelopeId, rawStatus]);

    if (!envelopeId || !rawStatus) {
      logSheet.appendRow([new Date(), 'ERROR', 'Missing envelopeId or status']);
      return ContentService.createTextOutput('Missing envelopeId or status');
    }

    // 4) Match in sheet
    var sheet  = ss.getSheetByName(SHEET_NAME);
    var values = sheet.getDataRange().getValues();
    var foundRow = -1;
    var target = String(envelopeId).trim().toLowerCase();

    // 4-1) First match by ENVID
    for (var i = 1; i < values.length; i++) {
      var sheetEnvId = (values[i][COL.ENVID - 1] || '').toString().trim();
      if (sheetEnvId && sheetEnvId.toLowerCase() === target) {
        foundRow = i + 1;
        break;
      }
    }

    // 4-2) If not found, backfill by email (latest row with matching email, empty ENVID, and status Sent/Processing/Pending/blank)
    if (foundRow === -1) {
      var signerInfo = _getFirstSignerInfo(envelopeId);
      if (signerInfo && signerInfo.email) {
        var candidateRow = -1;
        for (var j = values.length - 1; j >= 1; j--) {
          var rowEmail  = (values[j][COL.EMAIL - 1] || '').toString().trim().toLowerCase();
          var rowEnvid  = (values[j][COL.ENVID - 1] || '').toString().trim();
          var rowStatus = (values[j][COL.STATUS- 1] || '').toString().trim();
          if (rowEmail === signerInfo.email && !rowEnvid &&
              ['Sent','Processing...','Pending',''].includes(rowStatus)) {
            candidateRow = j + 1;
            break;
          }
        }
        if (candidateRow !== -1) {
          sheet.getRange(candidateRow, COL.ENVID).setValue(envelopeId); // Backfill ENVID
          foundRow = candidateRow;
          logSheet.appendRow([new Date(), 'BACKFILLED_BY_EMAIL', envelopeId, signerInfo.email, 'row', candidateRow]);
        }
      }
    }

    // 5) Process match result (only here: save/update status)
    if (foundRow !== -1) {
      if (isCompleted) {
        sheet.getRange(foundRow, COL.STATUS).setValue('Complete');
        var empName = sheet.getRange(foundRow, COL.NAME).getValue();

        // Log save attempt/result (for flow tracking)
        logSheet.appendRow([new Date(), 'SAVE_ATTEMPT', envelopeId, empName]);
        var fileUrl = saveEnvelopePdfToDrive(envelopeId, empName);
        logSheet.appendRow([new Date(), 'SAVE_RESULT', envelopeId, empName, fileUrl || 'NO_URL']);
      } else {
        sheet.getRange(foundRow, COL.STATUS).setValue(rawStatus);
      }
      logSheet.appendRow([new Date(), 'MATCHED', 'row', foundRow]);
    } else {
      logSheet.appendRow([new Date(), 'NOT_FOUND', envelopeId, 'no envid match & no email backfill']);
    }

    return ContentService.createTextOutput('OK');
  } catch (err) {
    return ContentService.createTextOutput('Error: ' + (err && err.message ? err.message : String(err)));
  }
}

/* ========================= Util/Debug ========================= */

// Manual run (process all Pending)
function testProcess() {
  processPendingEmployees();
}

// Debug single send
function _debugSendOne() {
  const res = sendDocuSignEnvelopeWithToken('Test', 'bomul10258034@gmail.com', 'HR', getAccessToken());
  Logger.log(JSON.stringify(res));
}

// Create installable onEdit trigger (connects to processPendingEmployees)
function createEditTrigger() {
  const ssId = SpreadsheetApp.getActive().getId();

  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'processPendingEmployees') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('processPendingEmployees')
    .forSpreadsheet(ssId)
    .onEdit()
    .create();

  Logger.log('Installable onEdit trigger created');
}