FROM python:3.11-slim

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN git clone https://github.com/Rexo42/WIL---Prototype-repo.git .

RUN pip install --no-cache-dir -r requirements.txt

CMD ["python", "main.py"]