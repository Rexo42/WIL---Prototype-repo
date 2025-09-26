FROM python:3.11-slim

WORKDIR /app
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

RUN git clone -b deepSeek https://github.com/Rexo42/WIL---Prototype-repo.git .
COPY .env .env
RUN pip install -r requirements.txt
ENV API_KEY_DeepSeek =sk-29660c07f305432ba08c12ea348976bc
ENV API_KEY_Simpro =8077324ef83f67fbc7b0507e1e03ec85ff6a4655
CMD ["python", "main.py"]