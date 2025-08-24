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
            idNum = company.get("ID")
            
            return requests.get(BASE_URL+"companies/"+str(idNum), headers=headers).json()    
    return "company not found!"

def get_Costomers(ID):
    URL = BASE_URL+"companies/"+str(ID)+'/customers/'
    return requests.get(URL, headers=headers).json()

def find_Customer(ID, GivenName, FamilyName):
    URL = BASE_URL+"companies/"+str(ID)+'/customers/'
    customers = requests.get(URL, headers=headers).json()
    for customer in customers:
        if customer.get("GivenName").strip() == GivenName.strip() and customer.get("FamilyName").strip() == FamilyName.strip():
            return customer
    return f"could not find customer with name: {GivenName} {FamilyName}"

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

def test_Requests(ID):
    company = get_Company()
    print(json.dumps(company, indent=2))

    ## gets all jobs from the company and prints
    print("getting all jobs...")
    jobList = get_Jobs(company.get("ID"))
    print(json.dumps(jobList, indent=2))

    ## get and display customers
    print("getting all customers...")
    customers = get_Costomers(company.get("ID"))
    print(json.dumps(customers, indent=2))

    ## add a customer and redisplay new list of customers
    print("adding customer...")
    add_Customer(company.get("ID"),"Mr","Mike", "Ross", "0422352436")
    print(json.dumps(get_Costomers(company.get("ID")), indent=2))

    print()

    ## delete a customer and redisplay new list of customers
    print("removing customer...")
    remove_Customer(company.get("ID"), "Mike", "Ross")
    print(json.dumps(get_Costomers(company.get("ID")), indent=2))

    # jobs - x name


    del company, jobList, customers
class API:
    def __init__(self, ID):
        self.ID = ID
        pass

    def structureData(self, input):
        data = input.split(maxsplit = 1)
        return data
        # take the user input string and break it into an array of strings where [0] is the command keyword [1] is the query

    def interperet(self, input):
        filteredData = self.structureData(input)

        if filteredData[0] == "search_customer":
            if len(filteredData) < 2:
                print("Please provide a full name to search.")
                return

            data = filteredData[1].split(maxsplit=1)

            if len(data) < 2:
                print("Please enter both first and last name.")
                return

            customer = find_Customer(self.ID, data[0], data[1])
            if customer:
                print(json.dumps(customer, indent=2))
            else:
                print("Could not find customer with the given credentials")
        if filteredData[0] == "create_job":
            pass
        else:
            print(f"Uknown Command Input: {filteredData[0]}")
        # direct flow of input and call necessary functions

headers = {
    'Authorization': f'Bearer {ACCESS_TOKEN}',
    'Accept': 'application/json',
    'Content-Type': 'application/json'
}


running = True
company = get_Company()
testAPI = API(company.get("ID"))
while running:
    userInput = input("enter API search: ")
    if userInput == "q":
        running = False
        break
    outputData = testAPI.interperet(userInput)

test_Requests(company.get("ID"))
