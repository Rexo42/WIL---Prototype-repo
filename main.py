import requests
import json
import agent
import htmlUtility

from dotenv import load_dotenv
import os
load_dotenv()

ACCESS_TOKEN = os.getenv("API_KEY_Simpro")
API_KEY = os.getenv("API_KEY_DeepSeek")

print(ACCESS_TOKEN)
print(API_KEY)

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

def get_Job_Logs(ID, JobID):
    URL = BASE_URL+"companies/"+str(ID)+"/jobs/"+str(JobID)+"/timelines/"
    response = requests.get(URL, headers=headers)
    res = response.json()
    valid_Notes = []
    for note in res:
        if note.get("Type") == "Work Order Technician Notes" or note.get("Type") == "Customer Note":
            valid_Notes.append(note)
    return valid_Notes  
### ###
class API:
    def __init__(self, headers):
        self.ID = get_Company().get("ID")
        self.headers = headers

    def updateJobs(self, evergreenAgent):
        jobData = get_Jobs(self.ID)
        completeJobs = []
        editedJobs = []
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
                text += htmlUtility.strip_html(note.get("Message"))
                text += '\n'

            print(f"editing job #{currentID}...")

            editedMessage = evergreenAgent.sendNotes(text)

            payload = {
            "Description" : editedMessage
            }

            updateURL = BASE_URL+"companies/"+str(self.ID)+"/jobs/"+str(job.get("ID"))
            checker = requests.patch(updateURL, headers=headers, json=payload)

            if checker.status_code not in (200, 204):
                print("❌ Error updating job:")
                print(checker.text)
            else:
                if ("[REWRITE] INCOMPLETE" in editedMessage):
                    editedJobs.append(currentID)
                elif ("[REWRITE]" in editedMessage):
                    completeJobs.append(currentID)
                print(f"✅ Job #{currentID} updated successfully")

        print()
        print("Edited Jobs Marked Complete: ")
        for id in completeJobs:
            print(f"Job #{id}")

        print()
        print("Edited Jobs Deemed Incomplete: ")
        for id in editedJobs:
            print(f"Job #{id}")
        
running = True
testAPI = API(headers)
testAgent = agent.EvergreenAgent(API_KEY)
print("NEW RUN...")
while running:
    userInput = input("enter API query ('r' or 'q') ")
    if userInput == "q":
        running = False
        print("exiting program runtime...")
        break
    elif userInput == "r":
        testAPI.updateJobs(testAgent)
