import os
import time
import jwt
import requests
import base64
from dotenv import load_dotenv

load_dotenv()

def get_jwt_token():
    """Obtain DocuSign access token using JWT"""

    # Settings for creating JWT token
    integration_key = os.getenv("CLIENT_ID")
    user_id = os.getenv("USER_ID")  # DocuSign account User ID (API Username)
    private_key_path = os.getenv("PRIVATE_KEY_PATH", "private_key.pem")

    # Read RSA Private Key
    try:
        if not os.path.isabs(private_key_path):
            # If relative path, convert based on project directory
            private_key_path = os.path.join(os.path.dirname(__file__), private_key_path)

        with open(private_key_path, 'r') as key_file:
            private_key = key_file.read()
    except FileNotFoundError:
        print(f"[ERROR] Private key file not found: {private_key_path}")
        raise

    # Create JWT payload (according to documentation guide)
    now = int(time.time())
    payload = {
        'iss': integration_key,  # Integration Key
        'sub': user_id,         # User ID
        'aud': 'account-d.docusign.com',  # Demo environment
        'iat': now,             # Issued at
        'exp': now + 6000,      # Expiration (recommended: 6000 seconds)
        'scope': 'signature impersonation'  # Recommended scope
    }

    # Sign JWT token
    token = jwt.encode(payload, private_key, algorithm='RS256')

    # Exchange for access token from DocuSign
    token_url = "https://account-d.docusign.com/oauth/token"
    headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    data = {
        'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion': token
    }
    
    response = requests.post(token_url, headers=headers, data=data)
    if response.status_code == 200:
        access_token = response.json()['access_token']
        return access_token
    else:
        print(f"[ERROR] JWT token request failed: {response.status_code}")
        print(f"[ERROR] Response: {response.text}")
        raise Exception(f"JWT authentication failed: {response.text}")

def send_docusign_envelope_jwt(signer_email, signer_name, document_path="sample.pdf"):
    """Send DocuSign envelope using JWT (REST API)"""
    try:
        # JWT로 액세스 토큰 획득
        access_token = get_jwt_token()
        # 계정 정보
        account_id = os.getenv("ACCOUNT_ID")
        base_path = os.getenv("BASE_PATH")
        # PDF 문서 불러오기
        with open(document_path, "rb") as file:
            document_base64 = base64.b64encode(file.read()).decode("utf-8")
        # Envelope 정의 (JSON)
        envelope_data = {
            "emailSubject": "Evergreen Electrical - 입사 서류 서명 요청",
            "status": "sent",
            "documents": [
                {
                    "documentBase64": document_base64,
                    "name": "Evergreen Electrical Onboarding Document",
                    "fileExtension": "pdf",
                    "documentId": "1"
                }
            ],
            "recipients": {
                "signers": [
                    {
                        "email": signer_email,
                        "name": signer_name,
                        "recipientId": "1",
                        "routingOrder": "1",
                        "tabs": {
                            "signHereTabs": [
                                {
                                    "documentId": "1",
                                    "pageNumber": "1",
                                    "recipientId": "1",
                                    "xPosition": "200",
                                    "yPosition": "200"
                                }
                            ]
                        }
                    }
                ]
            }
        }
        url = f"{base_path}/v2.1/accounts/{account_id}/envelopes"
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
        response = requests.post(url, json=envelope_data, headers=headers)
        if response.status_code == 201:  # Created
            result = response.json()
            envelope_id = result.get('envelopeId')
            print(f"✅ DocuSign 전송 성공: Envelope ID: {envelope_id}")
            return envelope_id
        else:
            print(f"❌ DocuSign 전송 실패: {response.text}")
            raise Exception(f"Envelope creation failed: {response.text}")
    except Exception as e:
        print(f"[ERROR] DocuSign envelope send failed: {e}")
        raise
