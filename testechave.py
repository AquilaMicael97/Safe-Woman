import os
from google.cloud import vision

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = r"C:\BIOPARK\MariaPenha\chave.json"

client = vision.ImageAnnotatorClient()
print("Conexão com a Vision API estabelecida com sucesso!")