#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DocuSign JWT Grant 기반 문서 전송 시스템
서버 없이 실행 가능한 단순한 스크립트

사용법:
python jwt_docusign.py --email "employee@company.com" --name "김직원" --document "sample.pdf"
"""

import os
import sys
import argparse
from dotenv import load_dotenv
from docusign_jwt_service import send_docusign_envelope_jwt

load_dotenv()

def main():
    parser = argparse.ArgumentParser(description='DocuSign 문서 전송 (JWT Grant)')
    parser.add_argument('--email', required=True, help='서명자 이메일 주소')
    parser.add_argument('--name', required=True, help='서명자 이름')
    parser.add_argument('--document', default='sample.pdf', help='전송할 문서 파일명')
    
    args = parser.parse_args()
    
    try:
        envelope_id = send_docusign_envelope_jwt(
            signer_email=args.email,
            signer_name=args.name,
            document_path=args.document
        )
        print(f"✅ DocuSign 전송 성공: Envelope ID: {envelope_id}")
    except Exception as e:
        print(f"❌ DocuSign 전송 실패: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
