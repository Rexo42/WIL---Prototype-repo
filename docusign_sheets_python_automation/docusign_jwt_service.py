import os
import time
import jwt
import requests
import base64
from dotenv import load_dotenv

load_dotenv()

def get_jwt_token():
    """JWT 방식으로 DocuSign 액세스 토큰 획득"""
    
    # JWT 토큰 생성을 위한 설정
    integration_key = os.getenv("CLIENT_ID")
    user_id = os.getenv("USER_ID")  # DocuSign 계정의 User ID (API Username)
    private_key_path = os.getenv("PRIVATE_KEY_PATH", "private_key.pem")
    
    # RSA Private Key 읽기
    try:
        if not os.path.isabs(private_key_path):
            # 상대 경로인 경우 프로젝트 디렉토리 기준으로 변환
            private_key_path = os.path.join(os.path.dirname(__file__), private_key_path)
        
        with open(private_key_path, 'r') as key_file:
            private_key = key_file.read()
    except FileNotFoundError:
        print(f"[ERROR] Private key file not found: {private_key_path}")
        raise
    
    # JWT 페이로드 생성 (문서 가이드에 따라)
    now = int(time.time())
    payload = {
        'iss': integration_key,  # Integration Key
        'sub': user_id,         # User ID
        'aud': 'account-d.docusign.com',  # Demo 환경
        'iat': now,             # 발급 시간
        'exp': now + 6000,      # 만료 시간 (문서 가이드 권장: 6000초)
        'scope': 'signature impersonation'  # 문서 가이드 권장 스코프
    }
    
    # JWT 토큰 서명
    token = jwt.encode(payload, private_key, algorithm='RS256')
    
    # DocuSign에서 액세스 토큰 교환
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
    """JWT 방식으로 DocuSign envelope 전송 (REST API 사용)"""
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
