// Save DocuSign Envelope PDF to Google Drive under Employee/EmployeeName folder
 function saveEnvelopePdfToDrive(envelopeId, employeeName) {
   const accessToken = generateJWTToken();
   if (!accessToken) {
     Logger.log('JWT token creation failed');
     return null;
   }
   // 1. Find or create the root Employee folder
   let employeeRoot;
   const folders = DriveApp.getFoldersByName('Evergreen');
   if (folders.hasNext()) {
     employeeRoot = folders.next();
   } else {
     employeeRoot = DriveApp.createFolder('Evergreen');
   }
    //2. Find or create the employee's name folder
   let empFolder;
   const empFolders = employeeRoot.getFoldersByName(employeeName);
   if (empFolders.hasNext()) {
     empFolder = empFolders.next();
   } else {
     empFolder = employeeRoot.createFolder(employeeName);
   }
   // 3. Download and save the PDF
   const url = `${DOCUSIGN_CONFIG.basePath}/v2.1/accounts/${DOCUSIGN_CONFIG.accountId}/envelopes/${envelopeId}/documents/combined`;
   const response = UrlFetchApp.fetch(url, {
     method: 'GET',
     headers: {
       'Authorization': `Bearer ${accessToken}`,
       'Accept': 'application/pdf'
     }
   });
   if (response.getResponseCode() === 200) {
     const blob = response.getBlob().setName(employeeName + '_signed.pdf');
     const file = empFolder.createFile(blob);
     Logger.log('PDF saved: ' + file.getUrl());
     return file.getUrl();
   } else {
     Logger.log('PDF download failed: ' + response.getContentText());
     return null;
   }
 }
 // Only save when DocuSign Envelope status is complete
 /*
 @OnlyCurrentDoc
 */
 function myPermissions() {
 let ss = SpreadsheetApp.getActiveSpreadsheet();
 }
const DOCUSIGN_CONFIG = {
   integrationKey: '55b012c6-e799-4329-b869-fe0cc4eb009f',
   userId: '617fc1cf-ab2d-4a3b-9c8a-136e79e9effb',
   privateKey: `-----BEGIN PRIVATE KEY-----
 MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCmc3iKias/P2H5
 jSe4igQcF4aNOg9sGDa2qwdrNyFiXsfndBZlDDnklXyC7f4qCh2f6wdGD1gOKUHV
 oxjOM7IwoamgzON7N+ycLaHRZ8Q+9LuiehRH+wfxmtdKrNUqclqM/PmU8/RApjLS
 3O9ikmlLAaNKbN4aE1omHzPUDNM7peieHxyZVVw1sLxFLPKinwBgKdcdJaLARo8s
 dOX+FuFYi1aWhKQ0PA9MYLRH2jq2oYtQkhqAg3nxECPVPXSV86xQ70C1ggIvvuEc
 a7aNoXc1ws6tUWpCXp7m29Iv+3tcmu4acN1bkll0MFDMAR2T/TgdwRwfG2kZYwIO
 0uAGVjYbAgMBAAECggEAE/fKQCRfzMiXwk4ys6qq74vK8mpCq18EQUmnLC+C68Af
 Dx8YCKs8zrU4KKTQVs672xFg4AC7OYethCl6slH1UGw0YzvxFjkRQ3Md9HcUTdEi
 KU2n3TK6Mzu2FBlDwUHSpxM6Bap2ZMMLWcxzU0npI7xgkG8a/dnQeL5Jg2i+dmsx
 Jw6X969v7lQlkCKomTbGIrukK6J0zK8TcsBA15+bdbQ/Bac3h4wI3/HVGj1GxKXu
 GUyYZLg1U3Cvdw3lOUOchz/bNHWgoUp8sOr3cTRoazqDoTidblmRgJZV6zkJrwTz
 53XlR/Xeyurv0ghoPP7rxpbjJ6eRktiEoOIqTgVsMQKBgQDcxMggBIxTiOnXqeu/
 qTlIRTp+Pi6thVEcSv7WJfUs4FKwhJGS3CfcIimYrgSVQhJSuwah7A4IKvV5ENNC
 9Mv6OBMmfAovuZCMYZ790ii2UQMd0SaIx8Gj6KXWPLJbsbcZpfFuarRbO7DAI55Q
 fegA10/GpT0UN5FCR+c1q0XyTQKBgQDBA5z1/qFSNPKHeIllpPPnmKFddAL92saO
 PPggY73V5nwXx2AcY+Fj0A+9PBwTti5btfQiYP3gXWKp/oaUH5jztqQli7EYX86q
 UjkCk57+QGmBMsYMbdEE0lKv5o4wqbJvshxr8yySi8zHAROaLeFaQyo6PKECrtMi
 Q1hyq03uBwKBgGjfIaH0ByT3eP31vgOBw7BNEog9ybasCefCyGO6DEmRFja8Atsc
 seKkZ9YbdBnjFQkvxurMU64Vmh40m+bGms72LEKv0bbyE3RcO0afuq9AtJZJcGCx
 Y48VSRIIK0HbnfsVFSc6kQp1xHTBdscNyFP98+uNOwKLkvlFZtPb1JJRAoGARC9y
 k7SQaOorg5Ahebb8MyTIXKtPIz7WRglj3o1d0uLJk9zrJxxh01D9Pmytvojtd5if
 1kVNaqWS5Vr1T/6Zmf87ncfrmCDAcYr6eN6NnGRE4U9+h4WEAaALdfiM4sQQNUVG
 pRwS8vJQNT08H4t1wN1ZXZlth/UawU/pPxklPqECgYBxVCucoFZBz9ypXy4Ac9Nz
 G9724lCftrplhGN5W5k/h3lW8Hci9Dp1twoSnCw7uFOAq63gxMrEEWYTzcrWqX5J
 YmrgZJ+c+exx979Xqiv2GofWsyFuuq0b7Kwj3YbOk/Q+iLD5smys5A2b3K9hFp3E
 qyjo/qSMvrZ6dW4tgWrpZw==
 -----END PRIVATE KEY-----`,
   basePath: 'https:demo.docusign.net/restapi',
   accountId: 'ab74b31f-b771-488c-a959-1196053757e5'
 };

 const SHEET_NAME = 'NewEmployee';
 const COL = { NAME: 1, EMAIL: 2, DEPT: 3, STATUS: 4, ENVID: 5, TIME: 6, ERROR: 7 };

// Main trigger function (onEdit)
 function onEdit(e) {
   const sheet = e.source.getActiveSheet();
   if (sheet.getName() !== SHEET_NAME) return;
   const row = e.range.getRow();
   if (row <= 1) return;
   processRow(sheet, row);
 }

//  Automatically process Pending status (can also be run manually)
 function processPendingEmployees() {
   const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
   const data = sheet.getDataRange().getValues();
   for (let i = 1; i < data.length; i++) {
     const row = i + 1;
     const name = data[i][COL.NAME - 1];
     const email = data[i][COL.EMAIL - 1];
     const dept = data[i][COL.DEPT - 1];
     let status = data[i][COL.STATUS - 1];
     if (name && email && dept && !status) {
       sheet.getRange(row, COL.STATUS).setValue('Pending');
       status = 'Pending';
     }
     if (status === 'Pending') {
       processRow(sheet, row);
       Utilities.sleep(2000);
     }
      // Automatically check for completed signature and save
     if (status === 'Sent') {
       const envelopeId = sheet.getRange(row, COL.ENVID).getValue();
       if (envelopeId) {
         const accessToken = generateJWTToken();
         if (accessToken) {
           const url = `${DOCUSIGN_CONFIG.basePath}/v2.1/accounts/${DOCUSIGN_CONFIG.accountId}/envelopes/${envelopeId}`;
           const response = UrlFetchApp.fetch(url, {
             method: 'GET',
             headers: {
               'Authorization': `Bearer ${accessToken}`,
               'Accept': 'application/json'
             }
           });
           if (response.getResponseCode() === 200) {
             const result = JSON.parse(response.getContentText());
             if (result.status === 'completed') {
               sheet.getRange(row, COL.STATUS).setValue('Complete');
                //Save PDF to Google Drive
               const name = sheet.getRange(row, COL.NAME).getValue();
               saveEnvelopePdfToDrive(envelopeId, name);
             }
           }
         }
       }
     }
   }
 }

  //Process a single row
 function processRow(sheet, row) {
   if (!sheet) {
     Logger.log('processRow: sheet is undefined!');
     return;
   }
   const name = sheet.getRange(row, COL.NAME).getValue();
   const email = sheet.getRange(row, COL.EMAIL).getValue();
   const dept = sheet.getRange(row, COL.DEPT).getValue();
   try {
      //Pre-generate JWT token
     const accessToken = generateJWTToken();
      if (!accessToken) {
        sheet.getRange(row, COL.STATUS).setValue('Error');
        sheet.getRange(row, COL.ERROR).setValue('JWT token creation failed');
        return;
      }
     sheet.getRange(row, COL.STATUS).setValue('Processing...');
     const result = sendDocuSignEnvelopeWithToken(name, email, dept, accessToken);
     if (result.success) {
       sheet.getRange(row, COL.STATUS).setValue('Sent');
       sheet.getRange(row, COL.ENVID).setValue(result.envelopeId);
       sheet.getRange(row, COL.TIME).setValue(new Date().toLocaleString());
       sheet.getRange(row, COL.ERROR).setValue('');
     }
   } catch (err) {
     sheet.getRange(row, COL.STATUS).setValue('Error');
     sheet.getRange(row, COL.ERROR).setValue(err.message);
   }
 }
  //Send DocuSign Envelope (with token as argument)
 function sendDocuSignEnvelopeWithToken(name, email, department, accessToken) {
   try {
     Logger.log('JWT token created: ' + accessToken);
      //Create Envelope based on DocuSign template
     const envelopeData = {
       templateId: '88a7456c-dec9-4468-be8d-ca30db792a86',  //Your template ID
       templateRoles: [
         {
           email: email,
           name: name,
           roleName: 'Signer' // Role name defined in template
         }
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
       payload: JSON.stringify(envelopeData)
     });
     Logger.log('DocuSign API response: ' + response.getContentText());
     if (response.getResponseCode() === 201) {
       const result = JSON.parse(response.getContentText());
       return { success: true, envelopeId: result.envelopeId };
     } else {
       return { success: false, error: response.getContentText() };
     }
   } catch (error) {
     Logger.log('DocuSign send error: ' + error);
     return { success: false, error: error.message };
   }
 }

  //Generate JWT token
 function generateJWTToken() {
   try {
     const now = Math.floor(Date.now() / 1000);
     const exp = now + 6000;
     const header = { typ: 'JWT', alg: 'RS256' };
     const payload = {
       iss: DOCUSIGN_CONFIG.integrationKey,
       sub: DOCUSIGN_CONFIG.userId,
       aud: 'account-d.docusign.com',
       iat: now,
       exp: exp,
       scope: 'signature impersonation'
     };
     const headerB64 = Utilities.base64EncodeWebSafe(JSON.stringify(header)).replace(/=+$/, '');
     const payloadB64 = Utilities.base64EncodeWebSafe(JSON.stringify(payload)).replace(/=+$/, '');
     const signData = `${headerB64}.${payloadB64}`;
     const pemKey = DOCUSIGN_CONFIG.privateKey;
     const signature = Utilities.base64EncodeWebSafe(
       Utilities.computeRsaSha256Signature(signData, pemKey)
     ).replace(/=+$/, '');
     const jwt = `${headerB64}.${payloadB64}.${signature}`;
     const tokenResponse = UrlFetchApp.fetch('https:account-d.docusign.com/oauth/token', {
       method: 'POST',
       headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
       payload: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
     });
     Logger.log('DocuSign token response: ' + tokenResponse.getContentText());
     if (tokenResponse.getResponseCode() === 200) {
       const tokenData = JSON.parse(tokenResponse.getContentText());
       return tokenData.access_token;
     } else {
       return null;
     }
   } catch (error) {
     Logger.log('JWT token creation error: ' + error);
     return null;
   }
 }


// Manual execution function (process all Pending)
 function testProcess() {
   processPendingEmployees();
 }