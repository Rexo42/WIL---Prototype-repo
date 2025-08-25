#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DocuSign JWT Grant - Step 1: Obtain user consent
You only need to run this once.
"""

import os
from dotenv import load_dotenv
import webbrowser

load_dotenv()

def get_consent_url():
    """Generate URL for user consent"""
    
    client_id = os.getenv("CLIENT_ID")
    redirect_uri = os.getenv("REDIRECT_URI")
    
    # Individual consent URL
    consent_url = (
        f"https://account-d.docusign.com/oauth/auth?"
        f"response_type=code&"
        f"scope=signature%20impersonation&"
        f"client_id={client_id}&"
        f"redirect_uri={redirect_uri}"
    )
    
    return consent_url

def main():
    print("🔐 DocuSign JWT Grant - Obtain user consent")
    print("=" * 50)

    consent_url = get_consent_url()
    print("🔐 DocuSign JWT Grant user consent URL:")
    print(f"{consent_url}")

    # Automatically open browser
    try:
        webbrowser.open(consent_url)
    except:
        print("❌ Failed to open browser automatically. Please copy the above URL and paste it into your browser.")

    input("\nPress Enter after completing consent...")
    print("🎉 Consent complete!")

if __name__ == "__main__":
    main()
