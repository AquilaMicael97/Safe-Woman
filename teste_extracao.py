# Teste offline das heurísticas de extração — simula o retorno do OCR
# para CNH, RG antigo e CIN sem chamar o Google Vision.
import app

TEXTO_CNH = """REPUBLICA FEDERATIVA DO BRASIL
DEPARTAMENTO NACIONAL DE TRANSITO
CARTEIRA NACIONAL DE HABILITACAO
NOME
MARIA APARECIDA DOS SANTOS
DOC IDENTIDADE / ORG EMISSOR / UF
123456789 SSP PR
CPF
123.456.789-09
DATA NASCIMENTO
15/03/1990
"""

TEXTO_RG_ANTIGO = """SECRETARIA DE SEGURANCA PUBLICA
INSTITUTO DE IDENTIFICACAO
REGISTRO GERAL 12.345.678-9 DATA DE EXPEDICAO 10/01/2015
NOME JOANA PEREIRA LIMA
FILIACAO
JOSE PEREIRA LIMA
ANA MARIA PEREIRA
NATURALIDADE CURITIBA PR
DATA DE NASCIMENTO 22/07/1985
CPF 987.654.321-00
"""

TEXTO_CIN = """REPUBLICA FEDERATIVA DO BRASIL
CARTEIRA DE IDENTIDADE NACIONAL
NOME / NAME
CARLA REGINA SOUZA
CPF 111.222.333-96
DATA DE NASCIMENTO / DATE OF BIRTH
05/12/2000
VALIDADE 05/12/2030
"""

class _FakeAnnotation:
    def __init__(self, texto):
        self.description = texto

class _FakeResponse:
    def __init__(self, texto):
        self.text_annotations = [_FakeAnnotation(texto)]

class _FakeClient:
    texto = ""
    def document_text_detection(self, image):
        return _FakeResponse(_FakeClient.texto)

app.vision.ImageAnnotatorClient = lambda: _FakeClient()

falhas = []
for rotulo, texto, esperado in [
    ("CNH",       TEXTO_CNH,       {"nome": "MARIA APARECIDA DOS SANTOS", "cpf": "123.456.789-09", "data_nascimento": "15/03/1990"}),
    ("RG antigo", TEXTO_RG_ANTIGO, {"nome": "JOANA PEREIRA LIMA",         "cpf": "987.654.321-00", "data_nascimento": "22/07/1985"}),
    ("CIN",       TEXTO_CIN,       {"nome": "CARLA REGINA SOUZA",         "cpf": "111.222.333-96", "data_nascimento": "05/12/2000"}),
]:
    _FakeClient.texto = texto
    dados = app.extrair_dados_documento("teste_cnh.jpg")
    for campo, valor in esperado.items():
        if dados[campo] != valor:
            falhas.append(f"{rotulo}: {campo} = {dados[campo]!r}, esperado {valor!r}")

if falhas:
    print("FALHAS:")
    for f in falhas:
        print(" -", f)
else:
    print("Todos os 3 documentos extraidos corretamente.")
