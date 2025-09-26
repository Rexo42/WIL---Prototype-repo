FROM python:3.11-slim

WORKDIR /app
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/Rexo42/WIL---Prototype-repo.git .
COPY .env .env
RUN pip install -r requirements.txt

CMD ["python", "main.py"]