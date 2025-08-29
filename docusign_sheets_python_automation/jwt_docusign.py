#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DocuSign JWT Grant-based document sending system
Simple script that can be run without a server

Usage:
python jwt_docusign.py --email "employee@company.com" --name "Employee Kim" --document "sample.pdf"
"""

import os
import sys
import argparse
from dotenv import load_dotenv
from docusign_jwt_service import send_docusign_envelope_jwt

load_dotenv()

def main():
    parser = argparse.ArgumentParser(description='Send DocuSign document (JWT Grant)')
    parser.add_argument('--email', required=True, help='Signer email address')
    parser.add_argument('--name', required=True, help='Signer name')
    parser.add_argument('--document', default='sample.pdf', help='Document file name to send')

    args = parser.parse_args()

    try:
        envelope_id = send_docusign_envelope_jwt(
            signer_email=args.email,
            signer_name=args.name,
            document_path=args.document
        )
        print(f"✅ DocuSign sent successfully: Envelope ID: {envelope_id}")
    except Exception as e:
        print(f"❌ DocuSign sending failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
