File Structure:
project-folder/
├── run.sh
├── main.py
├── agent.py
├── htmlUtility.py
├── .env
└── README.txt

Setup:
1. Install Python 3 >> check version: python3 --version
2. Edit .env >> Fill in your keys and company name:
API_KEY_Deepseek=your_deepseek_key
API_KEY_Simpro=your_simpro_key
BASE_URL=https://enterprise-sandbox-au.simprosuite.com/api/v1.0/
COMPANY_NAME=Evergreen Electrical

Run:
1. Make run.sh executable (first time only): chmod +x run.sh
2. Set run.sh to be opened with Terminal >> Get Info -> Open with -> Terminal
3. Only double-click (run.sh) for normal using

Notes:
1. Change COMPANY_NAME in .env to match the Simpro company.
2. Update API keys in .env when they expire.
3. Keep .env private.
