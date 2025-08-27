import requests
import json
import ollama
import htmlUtility

ACCESS_TOKEN = '8077324ef83f67fbc7b0507e1e03ec85ff6a4655'
BASE_URL = 'https://enterprise-sandbox-au.simprosuite.com/api/v1.0/'
COMPANY_NAME = "Evergreen Electrical"

headers = {
'Authorization': f'Bearer {ACCESS_TOKEN}',
'Accept': 'application/json',
'Content-Type': 'application/json'
}

### API FUNCTIONS ###
def get_Jobs(ID): #gets list of all jobs 
    URL = BASE_URL+"companies/"+str(ID)+'/jobs/'
    return requests.get(URL, headers=headers).json()

def get_Company(): #finds evergreen electrical
    URL = BASE_URL+"companies/"
    companies = requests.get(URL, headers=headers).json()
    for company in companies:
        if company.get("Name") == COMPANY_NAME:
            idNum = company.get("ID")
            
            return requests.get(BASE_URL+"companies/"+str(idNum), headers=headers).json()    
    return "company not found!"

def get_Costomers(ID): #gets all customers
    URL = BASE_URL+"companies/"+str(ID)+'/customers/'
    return requests.get(URL, headers=headers).json()

def find_Customer(ID, GivenName, FamilyName): #finds a customer
    URL = BASE_URL+"companies/"+str(ID)+'/customers/'
    customers = requests.get(URL, headers=headers).json()
    for customer in customers:
        name = customer.get("GivenName").lower()
        surname = customer.get("FamilyName").lower()
        if name.strip() == GivenName.strip() and surname.strip() == FamilyName.strip():
            return customer
    return f"could not find customer with name: {GivenName} {FamilyName}"

def add_Customer(ID, Title, GivenName, FamilyName, Phone): #adds a customer
    customer = {
        "Title":Title,
        "GivenName":GivenName,
        "FamilyName":FamilyName,
        "Phone":Phone
    }
    URL = BASE_URL+"companies/"+str(ID)+'/customers/individuals/'
    requests.post(URL, headers=headers, data=json.dumps(customer))

def remove_Customer(ID, GivenName, FamilyName): #removes a customer
    URL = BASE_URL+"companies/"+str(ID)+'/customers/'
    customers = requests.get(URL, headers=headers).json()
    for customer in customers:
        if customer.get("GivenName") == GivenName and customer.get("FamilyName") == FamilyName:
            URL += "individuals/"+str(customer.get("ID"))
            requests.delete(URL, headers=headers)

### TESTING ###
def test_Requests(ID): #function for running all test API requests and prints out resulting data
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

def get_Job_Logs(ID, JobID):
    params = {
    "search": "all",
    "columns": "Type,Message,Date"
}
    relevantNotes = []
    URL = BASE_URL+"companies/"+str(ID)+"/jobs/"+str(JobID)+"/timelines/"
    #print(demo.status_code)
    ###


    #print(URL)
    response = requests.get(URL, headers=headers)
    res = response.json()
    for note in res:
        if note.get("Type") == "Customer Note":
            return note


class API:
    def __init__(self, headers):
        self.ID = get_Company().get("ID")
        self.headers = headers


    def updateJobs(self, evergreenAgent):
        jobData = get_Jobs(self.ID)
        for job in jobData:
            print(json.dumps(job, indent=2))
            print(job.get("ID"))
            content = htmlUtility.strip_html(job.get("Description"))
            if content.startswith("[REWRITE]"):
                print("skipping job...")
                continue
            result = get_Job_Logs(self.ID, job.get("ID"))
            print(json.dumps(result, indent=2))
            filtered = htmlUtility.strip_html(result.get("Message"))
            editedMessage = evergreenAgent.sendNotes(filtered)

            payload = {
            "Description" : editedMessage
            }

            updateURL = BASE_URL+"companies/"+str(self.ID)+"/jobs/"+str(job.get("ID"))
    
            checker = requests.patch(updateURL, headers=headers, json=payload)
            print(f"PATCH status: {checker.status_code}")
            if checker.status_code not in (200, 204):
                print("❌ Error updating job:")
                print(checker.text)
            else:
                print("✅ Job updated successfully")
            
            #######evergreenAgent.testRun()

             ## contents needs to be the logs when i get them
        # takes in an instance of ollama??
            #for job in jobs
            # does logic for getting notes off timeline and updating them and putting it into job description

running = True
testAPI = API(headers)
testAgent = ollama.EvergreenAgent()
print("NEW RUN...")
while running:
    userInput = input("enter API query ('r' or 'q') ")
    if userInput == "q":
        running = False
        print("exiting program runtime...")
        break
    elif userInput == "r":
        testAPI.updateJobs(testAgent)
