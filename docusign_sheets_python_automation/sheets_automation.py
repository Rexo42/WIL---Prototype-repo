#!/usr/bin/env python3
"""
Bulk onboarding automation based on Google Sheets
When the HR team enters employee information in Google Sheets, it is automatically processed in batch.
"""

import gspread
from google.oauth2.service_account import Credentials
import subprocess
import time
from datetime import datetime
import os

class SheetsAutomation:
    def __init__(self):
        # Google Sheets API setup
        self.scope = [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive"
        ]
        # Service account key file (must be created separately)
        self.creds_file = "service_account_key.json"
        self.sheet_url = "https://docs.google.com/spreadsheets/d/1yipgSATtg6juKfCUh6nvDbbOtCGk5x3oW0KpLPpjXUs/edit?gid=0#gid=0"  # Google Sheets URL

    def connect_sheets(self):
        """Connect to Google Sheets"""
        try:
            creds = Credentials.from_service_account_file(
                self.creds_file, scopes=self.scope
            )
            client = gspread.authorize(creds)
            wb = client.open_by_url(self.sheet_url)
            return wb
        except Exception as e:
            print(f"[ERROR] Google Sheets connection error: {repr(e)}")
            return None

    def process_pending_employees(self):
        """Automatically set new employees to Pending and process those waiting"""
        workbook = self.connect_sheets()
        if not workbook:
            return
        try:
            worksheet = workbook.worksheet('NewEmployee')
            records = worksheet.get_all_records()
            for i, record in enumerate(records, start=2):  # Start from the 2nd row
                name = record.get('Name', '').strip()
                email = record.get('Email', '').strip()
                department = record.get('Department', '').strip()
                status = record.get('Status', '').strip()
                # If Name, Email, and Department exist but Status is empty
                if name and email and department and not status:
                    print(f"🆕 New employee found: {name} ({email}) - Set to Pending")
                    worksheet.update_cell(i, 4, 'Pending')  # Set Status to Pending
                    status = 'Pending'
                # Only process employees with 'Pending' status
                if status == 'Pending':
                    if email and name:
                        # Send DocuSign document
                        result = self.send_docusign(email, name)
                        # Update the result in the sheet
                        if result['success']:
                            worksheet.update_cell(i, 4, 'Completed')  # Column D: Status
                            worksheet.update_cell(i, 5, result['envelope_id'])  # Column E: Envelope ID
                            worksheet.update_cell(i, 6, datetime.now().strftime('%Y-%m-%d %H:%M:%S'))  # Column F: Process Time
                            print(f"✅ {name} processed successfully!")
                        else:
                            worksheet.update_cell(i, 4, 'Error')
                            worksheet.update_cell(i, 7, result['error'])  # Column G: Error
                            print(f"❌ {name} processing failed: {result['error']}")
                        time.sleep(2)  # Prevent API rate limit
        except Exception as e:
            print(f"[ERROR] Sheet processing error: {e}")

    def send_docusign(self, email, name):
        """Send DocuSign document"""
        try:
            cmd = f'cd /Users/teo/Documents/WIL/docusign_project && source docusign_env/bin/activate && python jwt_docusign.py --email "{email}" --name "{name}"'
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            if "SUCCESS" in result.stdout:
                envelope_id = ""
                for line in result.stdout.split('\n'):
                    if "Envelope ID:" in line:
                        envelope_id = line.split("Envelope ID: ")[-1].strip()
                        break
                return {'success': True, 'envelope_id': envelope_id}
            else:
                # Return both stderr and stdout as error message
                error_msg = (result.stderr or '') + ("\nSTDOUT:\n" + result.stdout if result.stdout else '')
                return {'success': False, 'error': error_msg.strip()}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def setup_template_sheet(self):
        """Create template sheet (first time only, without sample data)"""
        workbook = self.connect_sheets()
        if not workbook:
            return
        try:
            # Create worksheet if it does not exist
            try:
                worksheet = workbook.worksheet('NewEmployee')
            except:
                worksheet = workbook.add_worksheet('NewEmployee', 1000, 7)
            # Set headers
            headers = ['Name', 'Email', 'Department', 'Status', 'Envelope ID', 'Process Time', 'Error']
            worksheet.update([headers], range_name='A1:G1')
            # Delete existing sample data
            records = worksheet.get_all_records()
            for i, record in enumerate(records, start=2):
                name = record.get('Name', '').strip()
                if name in ['John Smith', 'Sarah Johnson']:
                    worksheet.delete_rows(i)
            pass  # Template creation success message omitted
        except Exception as e:
            print(f"[ERROR] Template creation error: {e}")

def main():
    automation = SheetsAutomation()
    print("📊 Starting Google Sheets monitoring...")
    print("🛑 Press Ctrl+C to stop")
    try:
        while True:
            automation.process_pending_employees()
            time.sleep(30)
    except KeyboardInterrupt:
        print("\n📊 Automation stopped")

if __name__ == "__main__":
    main()
