import requests
import json

ACCESS_TOKEN = '8077324ef83f67fbc7b0507e1e03ec85ff6a4655'
BASE_URL = 'https://enterprise-sandbox-au.simprosuite.com/api/v1.0/'
COMPANY_NAME = "Evergreen Electrical"

#function definitions
def get_Jobs(ID):
    URL = BASE_URL+"companies/"+str(ID)+'/jobs/'
    return requests.get(URL, headers=headers).json()

def get_Company():
    URL = BASE_URL+"companies/"
    companies = requests.get(URL, headers=headers).json()
    for company in companies:
        if company.get("Name") == COMPANY_NAME:
            print("found company:")
            idNum = company.get("ID")
            
            return requests.get(BASE_URL+"companies/"+str(idNum), headers=headers).json()    
    return "company not found!"

def get_Costomers(ID):
    URL = BASE_URL+"companies/"+str(ID)+'/customers/'
    return requests.get(URL, headers=headers).json()


def add_Customer(ID, Title, GivenName, FamilyName, Phone):
    customer = {
        "Title":Title,
        "GivenName":GivenName,
        "FamilyName":FamilyName,
        "Phone":Phone
    }
    URL = BASE_URL+"companies/"+str(ID)+'/customers/individuals/'
    requests.post(URL, headers=headers, data=json.dumps(customer))

def remove_Customer(ID, GivenName, FamilyName):
    URL = BASE_URL+"companies/"+str(ID)+'/customers/'
    customers = requests.get(URL, headers=headers).json()
    for customer in customers:
        if customer.get("GivenName") == GivenName and customer.get("FamilyName") == FamilyName:
            URL += "individuals/"+str(customer.get("ID"))
            requests.delete(URL, headers=headers)
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
print(json.dumps(jobList, indent=2))

## get and display customers
customers = get_Costomers(company.get("ID"))
print(json.dumps(customers, indent=2))

## add a customer and redisplay new list of customers
print("adding customer")
add_Customer(company.get("ID"),"Mr","Mike", "Ross", "0422352436")
print(json.dumps(get_Costomers(company.get("ID")), indent=2))

print()

## delete a customer and redisplay new list of customers
print("removing customer")
remove_Customer(company.get("ID"), "Mike", "Ross")
print(json.dumps(get_Costomers(company.get("ID")), indent=2))


del company, jobList, customers

