import requests



class EvergreenAgent():
    def __init__(self, modelName = "gpt-oss:20b", URL = "http://localhost:11434/api/chat"):
        self.modelName = modelName
        self.URL = URL
        self.chatHistory = []
        self.initPrompt = """
You are an agent that processes job notes written by a tradesperson. Your task is to clean up and structure the notes into a clear, professional format.

Only use the information provided in the notes. Do not add extra commentary, assumptions, or customer conversation. Correct grammar, spelling, and punctuation. Present all tasks as clear bullet points under the correct headings.

---

🔧 Your output **must be valid HTML** using only the following elements:
- <div style="font-size: 10pt;"> to wrap each paragraph or section
- <strong> for section headings
- <ul> and <li> for bullet points
- <br> for inline line breaks
your output may have fewer than two subheading groups or more depending on the job notes given
---

🧱 Structure your output *exactly like this*:

<div style="font-size: 10pt;">
  [REWRITE]
</div>

<div style="font-size: 10pt;">
  Thank you for the opportunity to carry out the works at your premise.<br>
  Below is the scope of work carried out by the Evergreen team:
</div>
<br>
<div style="font-size: 10pt;">
  <strong>Worker/Date:</strong> [Insert name and date from notes here]
</div>

<div style="font-size: 10pt;">
  <strong>Work Completed:</strong>
  <ul>
    <li>Task Group 1 Subheading
      <ul>
        <li>Task 1</li>
        <li>Task 2</li>
      </ul>
    </li>
    <li>Task Group 2 Subheading
      <ul>
        <li>Task 1</li>
        <li>Task 2</li>
      </ul>
    </li>
  </ul>
</div>

<div style="font-size: 10pt;">
  Please consider Evergreen Electrical Services for your next electrical, solar or data job.<br>
  Regards, Evergreen Services.
</div>

---

📌 Ensure:
- `[REWRITE]` is included in the first <div>
- Each task is in its own `<li>` inside the `<ul>`
- No extra commentary or invented details
"""

#         self.initPrompt = """
# You are an agent that processes job notes written by a tradesperson. Your task is to clean up and structure the notes into a clear, professional format. 

# Only use the information provided in the notes. Do not make assumptions or add recommendations. Ignore any mention of customer conversations or interactions. Fix grammar, spelling, and punctuation where necessary. Present the work as bullet points under relevant section headings.

# ---

# Your output must be valid HTML and follow this structure using these elements:
# - `<div style="font-size: 10pt;">` to wrap each paragraph or section
# - `<strong>` for section headings
# - `<ul>` and `<li>` for bullet points
# - `<br>` for inline line breaks

# ---

# 🔧 **Your output HTML should follow this structure:**
# <div style="font-size: 10pt;">
#   [REWRITE]
# </div>

# <div style="font-size: 10pt;">
#   Thank you for the opportunity to carry out the works at your premise.<br>
#   Below is the scope of work carried out by the Evergreen team:
# </div>
# <br>
# <div style="font-size: 10pt;">
#   <strong>Worker/Date:</strong> [Insert name and date from notes here]
# </div>

# <div style="font-size: 10pt;">
#   <strong>Work Completed:</strong>
#   <ul>
#     <li>[First job task]</li>
#     <li>[Second job task]</li>
#     <li>[More tasks as needed]</li>
#   </ul>
# </div>

# <div style="font-size: 10pt;">
#   Please consider Evergreen Electrical Services for your next electrical, solar or data job.<br>
#   Regards, Evergreen Services.
# </div>
# """
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
            return assistant_message

            self.chatHistory.append({"role": "assistant", "content": assistant_message})
        else:
            print("❌ Error:", response.status_code, response.text)

    def testRun(self):
        self.sendNotes(self.demoNotes)