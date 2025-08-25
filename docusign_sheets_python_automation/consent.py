#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DocuSign JWT Grant - 첫 번째 단계: 사용자 동의 받기
한 번만 실행하면 됩니다.
"""

import os
from dotenv import load_dotenv
import webbrowser

load_dotenv()

def get_consent_url():
    """사용자 동의를 위한 URL 생성"""
    
    client_id = os.getenv("CLIENT_ID")
    redirect_uri = os.getenv("REDIRECT_URI")
    
    # Individual consent URL (개별 동의)
    consent_url = (
        f"https://account-d.docusign.com/oauth/auth?"
        f"response_type=code&"
        f"scope=signature%20impersonation&"
        f"client_id={client_id}&"
        f"redirect_uri={redirect_uri}"
    )
    
    return consent_url

def main():
    print("🔐 DocuSign JWT Grant - 사용자 동의 받기")
    print("=" * 50)
    
    consent_url = get_consent_url()
    print("🔐 DocuSign JWT Grant 사용자 동의 URL:")
    print(f"{consent_url}")

    # 자동으로 브라우저 열기
    try:
        webbrowser.open(consent_url)
    except:
        print("❌ 브라우저 자동 실행 실패. 위 URL을 복사해 브라우저에 붙여넣으세요.")

    input("\n동의 완료 후 Enter를 눌러주세요...")
    print("🎉 동의 완료!")

if __name__ == "__main__":
    main()
