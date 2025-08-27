import requests



class EvergreenAgent():
    def __init__(self, modelName = "gpt-oss:20b", URL = "http://localhost:11434/api/chat"):
        self.modelName = modelName
        self.URL = URL
        self.chatHistory = []

        self.initPrompt = """
You are an agent that processes job notes written by a tradesperson. Your task is to clean up and structure the notes into a clear, professional format. 

Only use the information provided in the notes. Do not make assumptions or add recommendations. Ignore any mention of customer conversations or interactions. Fix grammar, spelling, and punctuation where necessary. Present the work as bullet points under relevant section headings.

Your response must follow this structure:

"thankyou for the opportunity to carry out the works at your premise.  
below is the scope of work carried out by the evergreen team:"

[Insert the worker's name and date here, e.g. "Worker/Date: Hayden Jensen, 22/08/25"]

[Structured job notes follow]

At the end of the output, add the following line:
"please consider evergreen electrical services for your next electrical, solar or data jobs, regards evergreen services"

Make sure the worker’s name and date are taken from the notes if available, and placed exactly as shown above — between the intro paragraph and the job details.
"""
        self.initPrompt2 = """
        the following text is an example of job notes that you should make the ones after this look like. Donot reply to this but every prompt after do reply even if they look similar to the following:
        thankyou for the opportunity to carry out the works at your premise.  
        below is the scope of work carried out by the evergreen team:

        Hayden Jenson, 22/08/25

        **Hot Water System Inspection**
        - Pump plug observed with excess water on top.
        - No cracks or penetrations in the connection box.
        - Silicon seal applied around the plug.

        **Air Conditioning System Inspection**
        - Unit is not old.
        - Isolator free of moisture.
        - Connection height is sufficient; no issues detected.

        please consider evergreen electrical services for your next electrical, solar or data jobs, regards evergreen services
        """

        self.chatHistory.append({"role": "user", "content": self.initPrompt})
        self.chatHistory.append({"role": "user", "content": self.initPrompt2})
        self.chatHistory.append({"role": "assistant", "content": "Understood. Ready to process job notes."})
        self.demoNotes = """
        Hayden Jensen (22/08/2025)
        Arrived at site, Spoke to customer, inspected hot water system, plug for the pump had lots of water on  top of it. no cracks in connection box. no penetrations through back of box. siliconed around plug
        inspected aircon. unit is not old. isolator has no signs of moisture. Connection in ac high enough not be an issue.
        """

    def sendNotes(self, jobNotes):
        self.chatHistory.append({"role": "user", "content": jobNotes})

        prompt_payload = {
            "model" : self.modelName,
            "stream" : False,
            "messages" : self.chatHistory
        }
        
        print("⏳ Sending request...")
        response = requests.post(self.URL, json=prompt_payload, timeout=300)

        self.chatHistory.pop(-1)
        print("✅ Response received.")

        if response.status_code == 200:
            data = response.json()
            assistant_message = data.get("message", {}).get("content", "")
            print("💬 Assistant: \n", assistant_message)

            self.chatHistory.append({"role": "assistant", "content": assistant_message})
        else:
            print("❌ Error:", response.status_code, response.text)

    def testRun(self):
        self.sendNotes(self.demoNotes)