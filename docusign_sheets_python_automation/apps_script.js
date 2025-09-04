/***** Evergreen + DocuSign + Simpro (통합본) *****************************************
 * ✅ 기능
 *  - 시트 입력(필수 6칸 모두 기입) → Status 자동 Pending → DocuSign 템플릿 전송
 *  - Connect Webhook(doPost) 수신: 상태 갱신 + PDF를 Drive/Evergreen/직원이름 폴더에 저장
 *  - Webhook ENVID 미매칭 시: 수신자 이메일 역매칭하여 ENVID 백필 후 처리
 *  - 완료 시 Simpro 직원 자동 생성
 *
 * ✅ 시트 레이아웃 (SHEET_NAME='NewEmployee')
 *  | A:Name | B:Email | C:Department | D:Phone | E:Position | F:Date of Commencement |
 *  | G:Status | H:Envelope ID | I:Process Time | J:Error |
 *
 * ✅ Script Properties (File ▶ Project properties ▶ Script properties)
 *  - DocuSign:
 *    DOCUSIGN_INTEGRATION_KEY
 *    DOCUSIGN_USER_ID
 *    DOCUSIGN_ACCOUNT_ID
 *    DOCUSIGN_TEMPLATE_ID
 *    DOCUSIGN_PRIVATE_KEY           // PKCS#8, 줄바꿈은 \n 또는 실제 줄바꿈 모두 허용

 *
 *  - Simpro:
 *    SIMPRO_BASE                    // https://enterprise-sandbox-au.simprosuite.com  등
 *    SIMPRO_COMPANY_ID              // 예: 590
 *    SIMPRO_API_TOKEN               // Bearer 토큰
 *    SIMPRO_DEFAULT_COMPANY_ID      // 예: 590
 *
 * ✅ WebApp 배포
 *  - “나로 실행 / 누구나(익명)” 로 배포한 URL을 DocuSign Connect의 Endpoint로 등록
 ****************************************************************************************/

/*
/* ========================= 설정/상수 ========================= */

const SHEET_NAME = 'NewEmployee';
const COL = {
  NAME: 1, EMAIL: 2, DEPT: 3, PHONE: 4, POSITION: 5, STARTDATE: 6, STATUS: 7, ENVID: 8, TIME: 9, ERROR: 10,};

// Evergreen 루트 폴더 (서명 PDF 저장 위치)
const EVERGREEN_FOLDER_ID = '1FP_pzHPBX1M-Jm7captuNeMgWwPFpS2w';

const props = PropertiesService.getScriptProperties();
const DOCUSIGN_CONFIG = {
  integrationKey: props.getProperty('DOCUSIGN_INTEGRATION_KEY'),
  userId:        props.getProperty('DOCUSIGN_USER_ID'),
  accountId:     props.getProperty('DOCUSIGN_ACCOUNT_ID'),
  templateId:    props.getProperty('DOCUSIGN_TEMPLATE_ID'),
  privateKey: `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCEbFlB6EBjm0Vy
ulekgKr3pXrDlJTKAektul5X/8hSNhcWVWRhIdByla+nks9YTLjqYOFui5F115pf
Bm7bO9+t5Sa5fcWhbGsOBINHs0OZAc9Li7y7jzjIS0B1As9TiGR7AdXAhb37nkRK
lIEamF+mCFkp/5y84LU6KXAx/t/oM1/3PJnxmLJDUNmsyLiRmHtsQlkfuNtm0B8N
8XDquw8LH2DcZWusutTQH8REtS/GCATRZQaUAvEsJNlFhclXuscsgnykFzdeAB2Z
Z51fJr84iJw4ZZzv3wi9iIbGq1ac8EnAN/fUEI3FIpA3I/GBmLVypOOndAEtuPQy
XTMsDtCXAgMBAAECggEAQGxj2iwPE0ZpeYDNfaL5SiTP/lGNN1/JnO0T0/UE9HYL
MlrVzGmCexR2kexbAmbE+YWrdrfgyvday0saaH8O+Y9HkStul/Nie73XTm0YgFpA
iszPQ2JQqiTuFV8KFWYAGFXSs2h9fmnHaI8p5hHmSqS6GDQagUtC76pUQoZwUQrl
c4PW1ZmffaAq8kznxaMvCcuo5/9Qup9C2MD4ZjvdGuNt3fmdKhH84lDMaBjoPTY3
W/qWeodfX6m3QLZ6BGz0mqPgkWBGQglQGdOfRmHsDXiMcmhpK03ZbBllbq7XbzUf
XaTenm5Vmi/3gGXv5nYgMPOdzSCVhvfwnSI6tBJukQKBgQDKxMTkxp2dh4oK7Jj7
aFUJsVjvV6/HcnWHc+4KwPBhQKDaGxn0MjfV34GodXnJlfkGZB3Y+11uAe/t5Jl7
ETRTrq+lTfLLFFSUi+DKhDGdVH0pqDNc+VoFz3z/rCVIH9mjLK6bPipuUT1axJdS
LvDqVHolOGXw/Il+KbLK76NQUQKBgQCnL/XMyU8+H0gV8CqVZF3yhOfTaJ9Qqf3B
JAZy7p5BIiYqqiBoqcQ6zrRmZuK4vUPXeLM2NfC8KPtGNblVmEyTgd3QwSczNaDn
T5Xagtno6IAIWVNerE0dN82R5vxf2TMJli4o1rgimqC3yXx+RXeb2WDJXyZi9ga6
Ze0q4uGAZwKBgDZ2gbg9TOqaFE742+JzVJwE4bFv6Qv2R3E5h0+mISrOFCZhLyhz
MKImpYnc+/hUaw33aDj201KP/KT2SO9QYLC1dAI/nJ5FeK5pn9hlh3oNzoyY3Cr1
4uM6pwV5dI4Z1/hHMSMLoJP/CC7QLSDq8NTQGfrTWjZPbpLPmnF9ymzxAoGAMead
vf8EGO2rTWj+vNJVPDKxIyeiDah/ZeuDxUA1mglATRG0VKj/OfJCZCInX66WFjUf
gHm/Hdo5ja4xYDvx90EW3N0Z/y3tlbzqZGsT8XGb7WIEAUj6R1NFl1vTTiR9GEps
AqJ8GU//0ntgHixL1Aeg3Nn6kiUOwwnzLQ7E8dcCgYEAxXFtyNKG4tBSuW6MMFQp
uClyEFtycYl2HTW0pU1SsHj4yqQlAaoqQN8PhqFeOjFL/yp7D2vx64mfPo6Jmr1V
bNLfycO+T40mKn3bcfJaGDV7VGODUavpH2ONPjCxgi3C/zmJuOUziCSzspzcPfPU
bdALDbFPLuvo6kb1UnvEm0M=
-----END PRIVATE KEY-----`,
  basePath:      'https://demo.docusign.net/restapi'
};

/* ========================= DocuSign: 토큰 ========================= */

// 55분 캐시
function getAccessToken() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('docusign_access_token');
  if (hit) return hit;

  const res = generateJWTToken(true);
  if (!res || !res.accessToken) {
    throw new Error('JWT 교환 실패: ' + (res && res.errorDetail ? res.errorDetail : 'unknown'));
  }
  cache.put('docusign_access_token', res.accessToken, 55 * 60);
  return res.accessToken;
}

function generateJWTToken(returnDetail) {
  try {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 3600;

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


    const pemKey = String(DOCUSIGN_CONFIG.privateKey || '')
  .trim()
  .replace(/\\n/g, '\n')      // 프로퍼티에 \n로 저장된 경우 복원
  .replace(/\r\n/g, '\n');    // CRLF → LF
if (!/^-----BEGIN (?:RSA )?PRIVATE KEY-----\n[\s\S]+\n-----END (?:RSA )?PRIVATE KEY-----$/.test(pemKey)) {
  const msg = 'Private Key가 PKCS#8 형식이 아닙니다.';
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

/* ========================= DocuSign: 작업 함수 ========================= */
function sendDocuSignEnvelopeWithToken(payload, accessToken) {
  try {
    const templateRoles = [
      {
        roleName: 'New Employee',
        name: payload.name,
        email: payload.email,
        routingOrder: '1',
        tabs: {
          // 'Date of Commencement'는 텍스트 탭으로 맞추기 (템플릿 라벨과 철자/띄어쓰기 동일)
          textTabs: [
            { tabLabel: 'Employee Position', value: payload.position || '' },
            { tabLabel: 'Employee Phone', value: payload.phone || '' },
            { tabLabel: 'Date of Commencement', value: payload.startDate || '' },
          ],
        },
      },
    ];

    // 템플릿에 HR가 “고정”돼 있으면 payload.hrEmail을 주지 말고, 아래 블록이 실행되지 않게 둡니다.
    if (payload.hrEmail) {
      templateRoles.push({
        roleName: 'HR',
        name: payload.hrName || 'HR',
        email: payload.hrEmail,
        routingOrder: '2',
      });
    }

    const envelopeData = {
      templateId: DOCUSIGN_CONFIG.templateId,
      templateRoles,
      status: 'sent',
    };

    const url = `${DOCUSIGN_CONFIG.basePath}/v2.1/accounts/${DOCUSIGN_CONFIG.accountId}/envelopes`;
    const response = UrlFetchApp.fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      payload: JSON.stringify(envelopeData),
      muteHttpExceptions: true,
    });

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

  let employeeRoot;
  try {
    employeeRoot = DriveApp.getFolderById(EVERGREEN_FOLDER_ID);
  } catch (e) {
    logSheet.appendRow([new Date(), 'SAVE_FAIL', 'INVALID_FOLDER_ID', (e && e.message) || String(e)]);
    return null;
  }

  let empFolder;
  const it = employeeRoot.getFoldersByName(employeeName);
  empFolder = it.hasNext() ? it.next() : employeeRoot.createFolder(employeeName);

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
    logSheet.appendRow([new Date(), 'SAVE_FAIL', `HTTP_${code}`, envelopeId, res.getContentText()]);
    return null;
  }
}

function getEnvelopeStatus(envelopeId) {
  if (!envelopeId || String(envelopeId).trim() === '') {
    throw new Error('envelopeId가 비어있습니다.');
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
    throw new Error(`상태 조회 실패(${code}): ${r.getContentText()}`);
  }
  return JSON.parse(r.getContentText());
}

function debugStatusByRow(row){
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const id = String(sh.getRange(row, COL.ENVID).getValue() || '').trim();
  if (!id) throw new Error('해당 행에 ENVID가 없음');
  const st = getEnvelopeStatus(id);
  Logger.log(JSON.stringify(st));
}

/* ========================= 시트 → 전송 ========================= */

function rowIsReady_(rowArr){
  const req = [COL.NAME, COL.EMAIL, COL.DEPT, COL.PHONE, COL.POSITION, COL.STARTDATE];
  return req.every(c => String(rowArr[c-1] || '').toString().trim() !== '');
}

function processPendingEmployees(){
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data  = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const row   = i + 1;
    const envid = data[i][COL.ENVID - 1];
    let   status= data[i][COL.STATUS- 1];

    if (envid || ["Sent","Complete","Registered","Error","Processing..."].includes(status)) continue;

    if (rowIsReady_(data[i]) && !status) {
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
            const name = sheet.getRange(row, COL.NAME).getValue();
            saveEnvelopePdfToDrive(envelopeId, name);
          } else if (st.status && st.status !== 'sent') {
            sheet.getRange(row, COL.STATUS).setValue(st.status);
          }
        } catch (e) {
          sheet.getRange(row, COL.ERROR).setValue('상태 조회 실패: ' + (e.message || String(e)));
        }
      }
    }
  }
}

function processRow(sheet, row){
  if (!sheet) return;

  const name      = sheet.getRange(row, COL.NAME).getValue();
  const email     = sheet.getRange(row, COL.EMAIL).getValue();
  const dept      = sheet.getRange(row, COL.DEPT).getValue();
  const phone     = sheet.getRange(row, COL.PHONE).getValue();
  const position  = sheet.getRange(row, COL.POSITION).getValue();
  const startDate = sheet.getRange(row, COL.STARTDATE).getValue();
  const status    = sheet.getRange(row, COL.STATUS).getValue();
  const envid     = sheet.getRange(row, COL.ENVID).getValue();

  if (envid || ["Sent","Complete","Registered","Error","Processing..."].includes(status)) return;
  if (![name,email,dept,phone,position,startDate].every(v => String(v||'').trim() !== '')) return;

  let accessToken;
  try {
    accessToken = getAccessToken();
  } catch (e) {
    sheet.getRange(row, COL.STATUS).setValue('Error');
    sheet.getRange(row, COL.ERROR).setValue('JWT token error: ' + (e && e.message ? e.message : String(e)));
    return;
  }

 const sp = PropertiesService.getScriptProperties();
const payload = {
  name,
  email,
  department: dept,
  phone,
  position,
  startDate: Utilities.formatDate(new Date(startDate), Session.getScriptTimeZone(), 'yyyy-MM-dd'),

  // 템플릿에 HR가 이미 지정되어 있다면 값 주지 않기 (null/빈칸)
  hrName:  null,
  hrEmail: null,
};

  sheet.getRange(row, COL.STATUS).setValue('Processing...');
  const result = sendDocuSignEnvelopeWithToken(payload, accessToken);

  if (result.success) {
    sheet.getRange(row, COL.STATUS).setValue('Sent');
    sheet.getRange(row, COL.ENVID).setValue(result.envelopeId);
    sheet.getRange(row, COL.TIME).setValue(new Date());
    sheet.getRange(row, COL.ERROR).setValue('');
  } else {
    sheet.getRange(row, COL.STATUS).setValue('Error');
    sheet.getRange(row, COL.ERROR).setValue('DocuSign send failed: ' + (result.error || ''));
  }
}

/* ========================= Webhook (Connect) ========================= */

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
      Logger.log('recipients 조회 실패: ' + r.getContentText());
      return null;
    }
    const data = JSON.parse(r.getContentText());
    const signer = (data.signers && data.signers.length) ? data.signers[0] : null;
    if (!signer) return null;
    return { email: (signer.email || '').trim().toLowerCase(), name: signer.name || '' };
  } catch (e) {
    Logger.log('_getFirstSignerInfo 에러: ' + (e && e.message ? e.message : String(e)));
    return null;
  }
}

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var logSheet = ss.getSheetByName('WebhookLog');
    if (!logSheet) logSheet = ss.insertSheet('WebhookLog');

    // 본문 + Content-Type 로그
    var contentType = (e && e.postData && e.postData.type || '').toLowerCase();
    var rawBody = e && e.postData ? e.postData.contents : '';
    logSheet.appendRow([new Date(), 'RAW', rawBody, contentType]);

    // JSON 또는 XML 파싱
    var envelopeId = '';
    var rawStatus  = '';
    try {
      if (contentType.indexOf('application/json') !== -1) {
        var data = JSON.parse(rawBody || '{}');
        envelopeId =
          (data.envelopeId) ||
          (data.data && data.data.envelopeId) ||
          (data.envelopeSummary && data.envelopeSummary.envelopeId) || '';
        rawStatus =
          data.status || data.event ||
          (data.data && data.data.status) ||
          (data.envelopeSummary && data.envelopeSummary.status) || '';
      } else {
        var xml = XmlService.parse(rawBody);
        var root = xml.getRootElement();
        // EnvelopeID
        var envIdEl = root.getDescendants().filter(function(x){
          return x.asElement && x.asElement() && x.asElement().getName() === 'EnvelopeID';
        })[0];
        if (envIdEl && envIdEl.asElement()) envelopeId = (envIdEl.asElement().getText() || '').trim();
        // Status
        var statusEl = root.getDescendants().filter(function(x){
          return x.asElement && x.asElement() && x.asElement().getName() === 'Status';
        })[0];
        if (statusEl && statusEl.asElement()) rawStatus = (statusEl.asElement().getText() || '').trim();
      }
    } catch (parseErr) {
      logSheet.appendRow([new Date(), 'ERROR', 'PARSE_FAIL', String(parseErr)]);
      return ContentService.createTextOutput('Bad payload');
    }

    logSheet.appendRow([new Date(), 'PARSED', envelopeId, rawStatus]);

    if (!envelopeId || !rawStatus) {
      logSheet.appendRow([new Date(), 'ERROR', 'Missing envelopeId or status']);
      return ContentService.createTextOutput('Missing envelopeId or status');
    }

    // 완료 판정
    var lowered = String(rawStatus).toLowerCase().trim();
    var normalized = lowered.replace(/\s+/g, '').replace(/_/g, '-');
    var isCompleted = (normalized === 'completed' || normalized === 'envelope-completed');

    // 시트 매칭
    var sheet  = ss.getSheetByName(SHEET_NAME);
    var values = sheet.getDataRange().getValues();
    var foundRow = -1;
    var target = String(envelopeId).trim().toLowerCase();

    // ENVID 1차 매칭
    for (var i = 1; i < values.length; i++) {
      var sheetEnvId = (values[i][COL.ENVID - 1] || '').toString().trim();
      if (sheetEnvId && sheetEnvId.toLowerCase() === target) {
        foundRow = i + 1;
        break;
      }
    }

    // 실패 시 이메일 역매칭
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
          sheet.getRange(candidateRow, COL.ENVID).setValue(envelopeId);
          foundRow = candidateRow;
          logSheet.appendRow([new Date(), 'BACKFILLED_BY_EMAIL', envelopeId, signerInfo.email, 'row', candidateRow]);
        }
      }
    }

    if (foundRow !== -1) {
      if (isCompleted) {
        sheet.getRange(foundRow, COL.STATUS).setValue('Complete');
        var empName = sheet.getRange(foundRow, COL.NAME).getValue();

        // PDF 저장
        logSheet.appendRow([new Date(), 'SAVE_ATTEMPT', envelopeId, empName]);
        var fileUrl = saveEnvelopePdfToDrive(envelopeId, empName);
        logSheet.appendRow([new Date(), 'SAVE_RESULT', envelopeId, empName, fileUrl || 'NO_URL']);

        // Simpro 등록
        var __res = registerEmployeeInSimpro(
          empName,
          sheet.getRange(foundRow, COL.EMAIL).getValue(),
          {
            position: sheet.getRange(foundRow, COL.POSITION).getValue(),
            phone: normalizePhone_(sheet.getRange(foundRow, COL.PHONE).getValue()),
            dateOfHire: (function(){
              var d = sheet.getRange(foundRow, COL.STARTDATE).getValue();
              return d ? Utilities.formatDate(new Date(d), Session.getScriptTimeZone(), 'yyyy-MM-dd') : undefined;
            })()
          }
        );

        if (__res.ok) {
          sheet.getRange(foundRow, COL.STATUS).setValue('Registered');
          logSheet.appendRow([new Date(), 'SIMPRO_OK', envelopeId, empName, 'ID:' + __res.employeeId, 'user:' + __res.username]);
        } else {
          sheet.getRange(foundRow, COL.ERROR).setValue('Simpro reg failed: ' + __res.error);
          logSheet.appendRow([new Date(), 'SIMPRO_FAIL', envelopeId, empName, __res.error]);
        }
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

/* ========================= Simpro ========================= */

function registerEmployeeInSimpro(name, email, opts) {
  const p      = PropertiesService.getScriptProperties();
  const BASE   = (p.getProperty('SIMPRO_BASE') || '').replace(/\/+$/,'');
  const token  = (p.getProperty('SIMPRO_API_TOKEN') || '').trim();
  const CID    = String((p.getProperty('SIMPRO_COMPANY_ID') || '').trim());
  const DEF_CO = parseInt((p.getProperty('SIMPRO_DEFAULT_COMPANY_ID') || '0').trim(), 10);

  if (!BASE || !token) return { ok:false, error:'Missing SIMPRO_BASE or SIMPRO_API_TOKEN' };
  if (!CID)            return { ok:false, error:'SIMPRO_COMPANY_ID not set' };
  if (!DEF_CO)         return { ok:false, error:'SIMPRO_DEFAULT_COMPANY_ID not set or invalid' };

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

  const url = `${BASE}/api/v1.0/companies/${encodeURIComponent(CID)}/employees/`;
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

/* ========================= 유틸 ========================= */

function buildUsernameFromName_(name) {
  var base = String(name || '').toLowerCase().trim();
  base = base.replace(/[^a-z0-9]+/g, '.').replace(/\.+/g, '.').replace(/^\.|\.$/g, '');
  if (!base) base = 'employee' + Date.now();
  return base;
}

function safeJson_(text) {
  try { return JSON.parse(text); } catch(e) { return null; }
}

function normalizePhone_(v){
  var s = String(v || '').replace(/\D+/g,'');
  if (!s) return '';
  if (s.startsWith('0')) s = '61' + s.slice(1); // AU 가정
  if (!s.startsWith('+')) s = '+' + s;
  return s;
}

/* ========================= 디버그/트리거 ========================= */

function testProcess() {
  processPendingEmployees();
}

function _debugSendOne() {
  var token = getAccessToken();
  var sp = PropertiesService.getScriptProperties();
  var payload = {
    name: '테스트',
    email: 'test@example.com',
    department: 'HR',
    position: 'Apprentice',
    startDate: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    hrName: sp.getProperty('HR_NAME') || 'HR',
    hrEmail: sp.getProperty('HR_EMAIL') || 'hr@example.com'
  };
  var res = sendDocuSignEnvelopeWithToken(payload, token);
  Logger.log(JSON.stringify(res));
}

function createEditTrigger() {
  const ssId = SpreadsheetApp.getActive().getId();
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'processPendingEmployees') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('processPendingEmployees')
    .forSpreadsheet(ssId)
    .onEdit()
    .create();
  Logger.log('설치형 onEdit 트리거 생성 완료');
}


function debugStatusByEnvid(envelopeId){
  if (!envelopeId) throw new Error('envelopeId를 입력하세요.');
  const st = getEnvelopeStatus(envelopeId);
  Logger.log(JSON.stringify(st));
}

function testDebugStatus() {
  debugStatusByEnvid('9b0eefd1-5899-42e8-9a20-4bac8d1cbfeb');
  debugRecipients('9b0eefd1-5899-42e8-9a20-4bac8d1cbfeb');
}

// 해당 ENVID의 수신자/라우팅 상태 덤프
function debugRecipients(envelopeId){
  if (!envelopeId) throw new Error('envelopeId를 넣으세요');
  const accessToken = getAccessToken();
  const url = `${DOCUSIGN_CONFIG.basePath}/v2.1/accounts/${DOCUSIGN_CONFIG.accountId}/envelopes/${encodeURIComponent(envelopeId)}/recipients`;
  const r = UrlFetchApp.fetch(url, {
    method:'GET',
    headers:{ Authorization:`Bearer ${accessToken}`, Accept:'application/json' },
    muteHttpExceptions:true
  });
  Logger.log(r.getResponseCode() + ' ' + r.getContentText());
}

// 시트의 ENVID로 바로 검사 (행 번호 넣기)
function debugStatusByRow(row){
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const envelopeId = String(sh.getRange(row, COL.ENVID).getValue() || '').trim();
  if (!envelopeId) throw new Error('해당 행에 ENVID 없음');
  Logger.log('ENVID=' + envelopeId);
  Logger.log(JSON.stringify(getEnvelopeStatus(envelopeId)));
  debugRecipients(envelopeId);
}
