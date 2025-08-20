import requests
import json

ACCESS_TOKEN = '8077324ef83f67fbc7b0507e1e03ec85ff6a4655'
BASE_URL = 'https://enterprise-sandbox-au.simprosuite.com/api/v1.0/companies/'
COMPANY_NAME = "Evergreen Electrical"

headers = {
    'Authorization': f'Bearer {ACCESS_TOKEN}',
    'Accept': 'application/json',
    'Content-Type': 'application/json'
}
response = requests.get(BASE_URL, headers=headers)
print(f"response code: {response.status_code}") #200 = success 402 = wrong token 400 = cooked
companies = response.json()
for company in companies:
    if company.get("Name") == COMPANY_NAME:
        selected = company
        print("found company:")
        print(f"Name = {selected.get('Name')}")
        print(f"ID = {selected.get('ID')}")
