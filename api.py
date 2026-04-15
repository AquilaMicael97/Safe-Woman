import os
import sys
import re
import pathlib
import tempfile

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = r"C:\BIOPARK\MariaPenha\chave.json"
sys.stdout.reconfigure(encoding="utf-8")

import app as ocr

from fastapi import FastAPI, File, UploadFile, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

server = FastAPI(title="Maria Penha - Portaria")


# ─────────────────────────────────────────────
#  STARTUP
# ─────────────────────────────────────────────

@server.on_event("startup")
def startup():
    ocr.criar_tabelas()
    print("Servidor iniciado. Acesse http://localhost:8000")


# ─────────────────────────────────────────────
#  STATIC FILES + HOME
# ─────────────────────────────────────────────

server.mount("/static", StaticFiles(directory="static"), name="static")

@server.get("/")
async def root():
    return FileResponse("static/index.html")


# ─────────────────────────────────────────────
#  HELPERS
# ─────────────────────────────────────────────

async def _salvar_temp(upload: UploadFile) -> pathlib.Path:
    sufixo = pathlib.Path(upload.filename or "img.jpg").suffix or ".jpg"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=sufixo)
    tmp.write(await upload.read())
    tmp.close()
    return pathlib.Path(tmp.name)


def _normalizar_cpf(cpf: str) -> str:
    digitos = re.sub(r"\D", "", cpf)
    if len(digitos) == 11:
        return f"{digitos[:3]}.{digitos[3:6]}.{digitos[6:9]}-{digitos[9:]}"
    return cpf


def _montar_resposta_verificacao(cpf, nome, data_nascimento, resultado):
    """
    Monta o dict de resposta unificado para verificação de CNH/CPF.
    Determina o nível de alerta considerando:
      - Se tem medida protetiva ativa (regra base)
      - Se a contraparte está ATUALMENTE dentro do local (urgência extra)
    """
    contrapartes = ocr.verificar_contrapartes_presentes(cpf)

    vitimas_dentro    = contrapartes["vitimas_dentro"]    # agressor entrando, vítima já dentro
    agressores_dentro = contrapartes["agressores_dentro"] # vítima entrando, agressor já dentro

    if resultado["alerta"]:
        # Agressor com medida ativa
        nivel    = "vermelho-urgente" if vitimas_dentro else "vermelho"
        urgente  = bool(vitimas_dentro)
    elif resultado["eh_vitima"]:
        # Vítima cadastrada
        nivel    = "amarelo-urgente" if agressores_dentro else "amarelo"
        urgente  = bool(agressores_dentro)
    else:
        nivel   = "verde"
        urgente = False

    # Determina tipo para registrar entrada
    if resultado["eh_agressor"]:
        tipo_presenca = "agressor"
    elif resultado["eh_vitima"]:
        tipo_presenca = "vitima"
    else:
        tipo_presenca = "outro"

    # Registra entrada automaticamente
    if cpf:
        ocr.registrar_entrada(cpf, nome or "Desconhecido", tipo_presenca)

    return {
        "status"            : "ok",
        "nivel"             : nivel,
        "urgente"           : urgente,
        "cpf"               : cpf,
        "nome"              : nome or "",
        "data_nascimento"   : data_nascimento or "",
        "alerta"            : resultado["alerta"],
        "mensagem"          : resultado["mensagem"],
        "medidas_ativas"    : resultado["medidas_ativas"],
        "vitimas_dentro"    : vitimas_dentro,
        "agressores_dentro" : agressores_dentro,
    }


# ─────────────────────────────────────────────
#  ENDPOINT 1 — Cadastrar Medida Protetiva
# ─────────────────────────────────────────────

@server.post("/api/cadastrar-medida")
async def cadastrar_medida(foto: UploadFile = File(...)):
    tmp_path = await _salvar_temp(foto)
    try:
        dados = ocr.extrair_dados_medida_protetiva(str(tmp_path))

        if dados["numero_processo"] == "Não encontrado":
            return JSONResponse(status_code=422, content={
                "status"  : "erro",
                "mensagem": "Número de processo não encontrado. Verifique se a foto está nítida."
            })

        if dados["nome_vitima"] == "Não encontrado" and dados["nome_agressor"] == "Não encontrado":
            return JSONResponse(status_code=422, content={
                "status"  : "erro",
                "mensagem": "Não foi possível identificar os nomes. Tente fotografar novamente."
            })

        vitima_id   = ocr.salvar_vitima(dados["nome_vitima"], dados["cpf_vitima"])
        agressor_id = ocr.salvar_agressor(dados["nome_agressor"], dados.get("cpf_agressor"))

        conn = ocr.conectar()
        cur  = conn.cursor()
        cur.execute("""
            INSERT INTO medidas_protetivas
                (numero_processo, vitima_id, agressor_id, data_emissao, vara)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (numero_processo) DO NOTHING
            RETURNING id;
        """, (dados["numero_processo"], vitima_id, agressor_id,
              dados["data_emissao"], dados["vara"]))
        row = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        return {
            "status"         : "ok",
            "ja_existia"     : row is None,
            "numero_processo": dados["numero_processo"],
            "nome_vitima"    : dados["nome_vitima"],
            "nome_agressor"  : dados["nome_agressor"],
            "cpf_agressor"   : dados.get("cpf_agressor", "Não encontrado"),
            "data_emissao"   : dados["data_emissao"],
            "vara"           : dados["vara"],
        }

    except Exception as e:
        return JSONResponse(status_code=500, content={
            "status": "erro", "mensagem": f"Erro interno: {str(e)}"
        })
    finally:
        tmp_path.unlink(missing_ok=True)


# ─────────────────────────────────────────────
#  ENDPOINT 2 — Verificar CNH na Portaria (ENTRADA)
# ─────────────────────────────────────────────

@server.post("/api/verificar-cnh")
async def verificar_cnh(foto: UploadFile = File(...)):
    """
    Lê a CNH, verifica medidas protetivas e registra entrada.
    Cruza com presenças ativas para detectar urgência.
    """
    tmp_path = await _salvar_temp(foto)
    try:
        dados = ocr.extrair_dados_cnh(str(tmp_path))

        if dados["cpf"] == "Não encontrado":
            return {
                "status"         : "ok",
                "nivel"          : "cinza",
                "cpf"            : None,
                "nome"           : dados.get("nome", ""),
                "data_nascimento": dados.get("data_nascimento", ""),
                "alerta"         : False,
                "urgente"        : False,
                "mensagem"       : "CPF não detectado. Tente novamente ou digite o CPF.",
                "medidas_ativas" : [],
                "vitimas_dentro" : [],
                "agressores_dentro": [],
            }

        resultado = ocr.verificar_conflito_por_cpf(dados["cpf"])
        return _montar_resposta_verificacao(
            dados["cpf"], dados.get("nome"), dados.get("data_nascimento"), resultado
        )

    except Exception as e:
        return JSONResponse(status_code=500, content={
            "status": "erro", "mensagem": f"Erro ao processar CNH: {str(e)}"
        })
    finally:
        tmp_path.unlink(missing_ok=True)


# ─────────────────────────────────────────────
#  ENDPOINT 3 — Verificar por CPF digitado (ENTRADA)
# ─────────────────────────────────────────────

@server.get("/api/verificar-cpf")
async def verificar_cpf_manual(cpf: str = Query(...)):
    try:
        cpf_fmt   = _normalizar_cpf(cpf)
        resultado = ocr.verificar_conflito_por_cpf(cpf_fmt)
        nome      = resultado.get("vitima_info", {}) or resultado.get("agressor_info", {})
        nome_str  = nome.get("nome", "") if nome else ""
        return _montar_resposta_verificacao(cpf_fmt, nome_str, "", resultado)

    except Exception as e:
        return JSONResponse(status_code=500, content={
            "status": "erro", "mensagem": f"Erro ao verificar CPF: {str(e)}"
        })


# ─────────────────────────────────────────────
#  ENDPOINT 4 — Registrar Saída
# ─────────────────────────────────────────────

@server.post("/api/saida")
async def registrar_saida(foto: UploadFile = File(...)):
    """
    Lê a CNH na saída e dá baixa na presença ativa da pessoa.
    Retorna confirmação com nome, tipo e horário de entrada.
    """
    tmp_path = await _salvar_temp(foto)
    try:
        dados = ocr.extrair_dados_cnh(str(tmp_path))

        if dados["cpf"] == "Não encontrado":
            return JSONResponse(status_code=422, content={
                "status"  : "erro",
                "mensagem": "CPF não detectado na CNH. Tente novamente ou use a saída manual."
            })

        baixa = ocr.registrar_saida(dados["cpf"])

        if baixa is None:
            return JSONResponse(status_code=404, content={
                "status"  : "erro",
                "mensagem": f"CPF {dados['cpf']} não estava registrado como presente no local."
            })

        return {
            "status"    : "ok",
            "cpf"       : dados["cpf"],
            "nome"      : baixa["nome"],
            "tipo"      : baixa["tipo"],
            "entrada_em": baixa["entrada_em"],
            "mensagem"  : f"Saída registrada para {baixa['nome']}.",
        }

    except Exception as e:
        return JSONResponse(status_code=500, content={
            "status": "erro", "mensagem": f"Erro ao registrar saída: {str(e)}"
        })
    finally:
        tmp_path.unlink(missing_ok=True)


# ─────────────────────────────────────────────
#  ENDPOINT 5 — Saída por CPF digitado
# ─────────────────────────────────────────────

@server.post("/api/saida-cpf")
async def saida_por_cpf(cpf: str = Query(...)):
    """Dá baixa por CPF digitado manualmente — sem precisar da CNH."""
    try:
        cpf_fmt = _normalizar_cpf(cpf)
        baixa   = ocr.registrar_saida(cpf_fmt)

        if baixa is None:
            return JSONResponse(status_code=404, content={
                "status"  : "erro",
                "mensagem": f"CPF {cpf_fmt} não estava registrado como presente no local."
            })

        return {
            "status"    : "ok",
            "cpf"       : cpf_fmt,
            "nome"      : baixa["nome"],
            "tipo"      : baixa["tipo"],
            "entrada_em": baixa["entrada_em"],
            "mensagem"  : f"Saída registrada para {baixa['nome']}.",
        }

    except Exception as e:
        return JSONResponse(status_code=500, content={
            "status": "erro", "mensagem": f"Erro: {str(e)}"
        })


# ─────────────────────────────────────────────
#  ENDPOINT 6 — Listar presentes (painel segurança)
# ─────────────────────────────────────────────

@server.get("/api/presentes")
async def listar_presentes():
    """Retorna lista de todos que estão atualmente no local."""
    try:
        return {"status": "ok", "presentes": ocr.listar_presentes()}
    except Exception as e:
        return JSONResponse(status_code=500, content={
            "status": "erro", "mensagem": str(e)
        })
