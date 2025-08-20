import requests
import json

ACCESS_TOKEN = '8077324ef83f67fbc7b0507e1e03ec85ff6a4655'
BASE_URL = 'https://enterprise-sandbox-au.simprosuite.com/api/v1.0/'
COMPANY_NAME = "Evergreen Electrical"

#function definitions
def get_Jobs(ID):
    URL = BASE_URL+"companies/"+str(ID)+'/jobs/'
    return requests.get(URL, headers=headers)

def get_Company():
    URL = BASE_URL+"companies/"
    companies = requests.get(URL, headers=headers).json()
    for company in companies:
        if company.get("Name") == COMPANY_NAME:
            print("found company:")
            idNum = company.get("ID")
            
            return requests.get(BASE_URL+"companies/"+str(idNum), headers=headers).json()    
    return "company not found!"
###

headers = {
    'Authorization': f'Bearer {ACCESS_TOKEN}',
    'Accept': 'application/json',
    'Content-Type': 'application/json'
}
## pulls and prints all details related to the company
company = get_Company()
print(json.dumps(company, indent=2))

## gets all jobs from the company and prints
jobList = get_Jobs(company.get("ID"))
print(json.dumps(jobList.json(), indent=2))

del company, jobList

