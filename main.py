import requests
import json
import ollama
import htmlUtility

from dotenv import load_dotenv
import os

load_dotenv()
### TODO
#   Only check completed Jobs DONE!!!!
#   ALLOW MULTIPLE NOTE SUPPORT, IE TWO DIFFERENT TECHNICIAN NOTES
    #IF A JOB IS DEEMED INCOMPLETE MOVE IT TO PENDING
###
ACCESS_TOKEN = os.getenv("API_KEY_Simpro")
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

def updateJob(ID, jobID, stageID):
    URL = BASE_URL+"companies/"+str(ID)+'/jobs/'+str(jobID)
    print(URL)
    payload = {"Stage": stageID}
    return requests.patch(URL, headers=headers, json=payload)


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

###


def get_Job_Logs(ID, JobID):
    URL = BASE_URL+"companies/"+str(ID)+"/jobs/"+str(JobID)+"/timelines/"
    response = requests.get(URL, headers=headers)
    res = response.json()
    valid_Notes = []
    for note in res:
        #print(note.get("Type"))
        #print(note.get("Type"))
        if note.get("Type") == "Work Order Technician Notes" or note.get("Type") == "Customer Note":
            #print(note.get("Type"))
            #print("found note!!!")
            #return note
            valid_Notes.append(note)
            #print(note.get("message"))
    return valid_Notes  
class API:
    def __init__(self, headers):
        self.ID = get_Company().get("ID")
        self.headers = headers

    def updateJobs(self, evergreenAgent):
        jobData = get_Jobs(self.ID)
        for job in jobData:
            currentID = job.get("ID")
            URL = BASE_URL + 'companies/'+str(self.ID)+'/jobs/'+str(currentID)
            data = requests.get(URL, headers=headers).json()
            if (data.get("Stage") != "Complete"):
                continue

            content = htmlUtility.strip_html(job.get("Description"))
            if content.startswith("[REWRITE]"):
                print(f"skipping job...(#{currentID}) REASON: contains [REWRITE TAG]")
                continue
            result = get_Job_Logs(self.ID, job.get("ID"))
            if (not result):
                print(f"skipping job... (#{currentID}) REASON: no valid job notes found")
                continue
            text = ""
            for note in result:
                #print("PRINTING NOTE CONTENTS")
                #print(note.get("Message"))
                #print('/n')
                text += htmlUtility.strip_html(note.get("Message"))
                text += '\n'
            #print(text)
            print(f"editing job #{currentID}...")
            # complete = False
            filtered = htmlUtility.strip_html(text)
            editedMessage = evergreenAgent.sendNotes(text)
            # if (["REWRITE F" not in editedMessage]):
            #     complete = True



            #check = updateJob(self.ID, currentID, "Complete", 11)
            #print(check)
            # IF CONTAINS REWRITE F THEN ITS INCOMPLETE AND SKIP
            # ELSE IF CONTAINS JUST REWRITE AND NO F THEN MOVE IT TO COMPLETE
            # if ("[REWRITE] F" in editedMessage and !()):
            payload = {
            "Description" : editedMessage
            }

            updateURL = BASE_URL+"companies/"+str(self.ID)+"/jobs/"+str(job.get("ID"))
            checker = requests.patch(updateURL, headers=headers, json=payload)
            # if complete:
            #     print("job deemed complete, updating status...")
            #     updateJob(self.ID, currentID, "Complete")


            #print(f"PATCH status: {checker.status_code}")
            if checker.status_code not in (200, 204):
                print("❌ Error updating job:")
                print(checker.text)
            else:
                print(f"✅ Job #{currentID} updated successfully")
        

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
