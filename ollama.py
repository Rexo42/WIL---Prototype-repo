import requests
modelName = "gpt-oss:20b" ###If your using a different model change this variable to what your using ###
baseURL = "http://localhost:11434/api/chat"
### Initial system prompt ###
initPrompt = """
Your are an Agent that will take in job notes written by a tradie and organise/structure them in a more readable format. Donot make recommendations yourself and only use information provided in the notes.
make sure spelling and punctuations is good aswell. consider each new prompt a new job note/not related to the last. you will put this above the notes: thankyou for the opportunity to carry out the works at your premise.
below is the scope of work carried out by the evergreen team
and you will put this below the notes: please consider evergreen electrical services for your next electrical, solar or data jobs, regards evergreen services
"""
demoNotes ="""
Hayden Jensen (22/08/2025)
Arrived at site, Spoke to customer, inspected hot water system, plug for the pump had lots of water on  top of it. no cracks in connection box. no penetrations through back of box. siliconed around plug
inspected aircon. unit is not old. isolator has no signs of moisture. Connection in ac high enough not be an issue.
"""


chatHistory = []
chatHistory.append({"role": "user", "content":initPrompt})
chatHistory.append({"role": "user", "content":demoNotes})


class EvergreenAgent():
    def __init__(self, modelName = "gpt-oss:20b", URL = "http://localhost:11434/api/chat"):
        self.modelName = modelName
        self.URL = URL
        self.chatHistory = []

        self.initPrompt = """
        Your are an Agent that will take in job notes written by a tradie and organise/structure them in a more readable format. Donot make recommendations yourself and only use information provided in the notes.
        make sure spelling and punctuations is good aswell. consider each new prompt a new job note/not related to the last. you will put this above the notes: thankyou for the opportunity to carry out the works at your premise.
        below is the scope of work carried out by the evergreen team
        and you will put this below the notes: please consider evergreen electrical services for your next electrical, solar or data jobs, regards evergreen services
        """
        self.chatHistory.append({"role": "user", "content": self.initPrompt})
        self.demoNotes = """
        Hayden Jensen (22/08/2025)
        Arrived at site, Spoke to customer, inspected hot water system, plug for the pump had lots of water on  top of it. no cracks in connection box. no penetrations through back of box. siliconed around plug
        inspected aircon. unit is not old. isolator has no signs of moisture. Connection in ac high enough not be an issue.
        """

    def sendNotes(self, jobNotes):
        chatHistory.append({"role": "user", "content": jobNotes})

        prompt_payload = {
            "model" : self.modelName,
            "stream" : False,
            "messages" : self.chatHistory
        }
        
        print("⏳ Sending request...")
        response = requests.post(baseURL, json=prompt_payload, timeout=300)
        print("✅ Response received.")

        if response.status_code == 200:
            data = response.json()
            assistant_message = data.get("message", {}).get("content", "")
            print("💬 Assistant: \n", assistant_message)

            chatHistory.append({"role": "assistant", "content": assistant_message})
        else:
            print("❌ Error:", response.status_code, response.text)

        print("⏳ Sending request...")
        response = requests.post(baseURL, json=prompt_payload, timeout=300)
        print("✅ Response received.")

        if response.status_code == 200:
            data = response.json()
            assistant_message = data.get("message", {}).get("content", "")
            print("💬 Assistant: \n", assistant_message)

            chatHistory.append({"role": "assistant", "content": assistant_message})
        else:
            print("❌ Error:", response.status_code, response.text)


agent = EvergreenAgent()
running = True
while running:
    userInput = input("Enter message for LLM: ")
    if (userInput.strip() == 'q'):
        print("exiting program...")
        quit()
    else:
        agent.sendNotes(userInput)