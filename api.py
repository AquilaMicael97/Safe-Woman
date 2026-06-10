# import os
# import sys
# import re
# import time
# import secrets
# import pathlib
# import tempfile

# if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
#     os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = r"C:\BIOPARK\MariaPenha\chave.json"
# sys.stdout.reconfigure(encoding="utf-8")


#Teste no Raiway
import os
import sys
import re
import time
import asyncio
import hashlib
import secrets
import pathlib
import tempfile

sys.stdout.reconfigure(encoding="utf-8")

import app as ocr  # app.py já configura as credenciais Google

from fastapi import FastAPI, File, Form, UploadFile, Query, Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# ─────────────────────────────────────────────
#  CREDENCIAIS
# ─────────────────────────────────────────────

ADMIN_USER     = os.environ.get("ADMIN_USER",     "admin")
ADMIN_PASS     = os.environ.get("ADMIN_PASS",     "safewoman@2025")
PORTARIA_USER  = os.environ.get("PORTARIA_USER",  "portaria")
PORTARIA_PASS  = os.environ.get("PORTARIA_PASS",  "portaria@2025")
RETENCAO_DIAS  = int(os.environ.get("RETENCAO_DIAS", "90"))

_sessoes_admin:    dict = {}
_sessoes_portaria: dict = {}

_bearer = HTTPBearer(auto_error=False)


def _requer_admin(credenciais: HTTPAuthorizationCredentials = Depends(_bearer)) -> str:
    if not credenciais:
        raise HTTPException(status_code=401, detail="Token não fornecido")
    token  = credenciais.credentials
    expira = _sessoes_admin.get(token)
    if not expira or time.time() > expira:
        _sessoes_admin.pop(token, None)
        raise HTTPException(status_code=401, detail="Sessão inválida ou expirada")
    return token


def _requer_portaria(credenciais: HTTPAuthorizationCredentials = Depends(_bearer)) -> str:
    """Aceita token de portaria OU de admin."""
    if not credenciais:
        raise HTTPException(status_code=401, detail="Token não fornecido")
    token  = credenciais.credentials
    expira = _sessoes_portaria.get(token) or _sessoes_admin.get(token)
    if not expira or time.time() > expira:
        raise HTTPException(status_code=401, detail="Sessão inválida ou expirada")
    return token


server = FastAPI(title="Safe Woman — Portaria")

# CORS — permite chamadas do Vercel e do dev local
_origins = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:5174"
).split(",")

server.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = pathlib.Path(__file__).resolve().parent


# ─────────────────────────────────────────────
#  STARTUP
# ─────────────────────────────────────────────

def _segundos_ate_reset() -> float:
    from datetime import datetime, timedelta
    agora = datetime.now()
    alvo = agora.replace(hour=17, minute=30, second=0, microsecond=0)
    if agora >= alvo:
        alvo += timedelta(days=1)
    return (alvo - agora).total_seconds()


async def _reset_diario():
    """Aguarda as 17:30 e reseta o banco completo; repete todo dia."""
    while True:
        espera = _segundos_ate_reset()
        print(f"[reset-diario] Próximo reset em {espera/3600:.1f}h (17:30)")
        await asyncio.sleep(espera)
        try:
            ocr.resetar_banco()
            print("[reset-diario] Banco resetado com sucesso.")
        except Exception as e:
            print(f"[reset-diario] Erro ao resetar banco: {e}")


async def _purga_diaria():
    """Roda uma vez por dia e remove presenças com mais de RETENCAO_DIAS dias."""
    while True:
        await asyncio.sleep(24 * 3600)
        try:
            total = ocr.purgar_presencas_antigas(RETENCAO_DIAS)
            print(f"[retencao] Purga automática: {total} registro(s) removido(s) (>{RETENCAO_DIAS} dias)")
        except Exception as e:
            print(f"[retencao] Erro na purga automática: {e}")


@server.on_event("startup")
async def startup():
    ocr.criar_tabelas()
    # Purga imediata ao iniciar (limpa backlog) + agendamento diário
    try:
        removidos = ocr.purgar_presencas_antigas(RETENCAO_DIAS)
        if removidos:
            print(f"[retencao] Startup: {removidos} registro(s) antigo(s) removido(s)")
    except Exception as e:
        print(f"[retencao] Erro na purga de startup: {e}")
    asyncio.create_task(_purga_diaria())
    asyncio.create_task(_reset_diario())
    print("Servidor iniciado. Acesse http://localhost:8000")


# ─────────────────────────────────────────────
#  STATIC FILES — React build (dist/)
# ─────────────────────────────────────────────

_DIST = pathlib.Path(__file__).parent / "dist"

if (_DIST / "assets").exists():
    server.mount("/assets", StaticFiles(directory=str(_DIST / "assets")), name="assets")


# ─────────────────────────────────────────────
#  AUTH — PORTARIA
# ─────────────────────────────────────────────

@server.post("/api/portaria/login")
async def portaria_login(request: Request):
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Corpo inválido")

    usuario = body.get("usuario", "")
    senha   = body.get("senha",   "")

    if secrets.compare_digest(usuario, PORTARIA_USER) and secrets.compare_digest(senha, PORTARIA_PASS):
        token = secrets.token_hex(32)
        _sessoes_portaria[token] = time.time() + 12 * 3600
        return {"status": "ok", "token": token, "tipo": "portaria", "nome": "Portaria"}

    if secrets.compare_digest(usuario, ADMIN_USER) and secrets.compare_digest(senha, ADMIN_PASS):
        token = secrets.token_hex(32)
        _sessoes_admin[token] = time.time() + 8 * 3600
        return {"status": "ok", "token": token, "tipo": "admin", "nome": "Administrador"}

    raise HTTPException(status_code=401, detail="Usuário ou senha incorretos")


@server.post("/api/portaria/logout")
async def portaria_logout(token: str = Depends(_requer_portaria)):
    _sessoes_portaria.pop(token, None)
    return {"status": "ok"}


# ─────────────────────────────────────────────
#  AUTH — VÍTIMA (pré-cadastro remoto)
# ─────────────────────────────────────────────

def _hash_senha(senha: str) -> str:
    return hashlib.sha256(senha.encode()).hexdigest()


@server.post("/api/vitima/registrar")
async def vitima_registrar(request: Request):
    """Cria conta de vítima para pré-cadastro remoto de medida protetiva."""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Corpo inválido")

    email = (body.get("email") or "").strip().lower()
    senha = body.get("senha", "")

    if not email or not senha or len(senha) < 6:
        raise HTTPException(status_code=422, detail="E-mail e senha (mín. 6 caracteres) obrigatórios")

    conn = ocr.conectar()
    cur  = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO contas_vitima (email, senha_hash)
            VALUES (%s, %s)
            ON CONFLICT (email) DO NOTHING
            RETURNING id
        """, (email, _hash_senha(senha)))
        row = cur.fetchone()
        conn.commit()
    finally:
        cur.close(); conn.close()

    if not row:
        raise HTTPException(status_code=409, detail="E-mail já cadastrado")
    return {"status": "ok", "mensagem": "Conta criada com sucesso"}


@server.post("/api/vitima/login")
async def vitima_login(request: Request):
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Corpo inválido")

    email = (body.get("email") or "").strip().lower()
    senha = body.get("senha", "")

    conn = ocr.conectar()
    cur  = conn.cursor()
    cur.execute("SELECT id FROM contas_vitima WHERE email=%s AND senha_hash=%s",
                (email, _hash_senha(senha)))
    row = cur.fetchone()
    cur.close(); conn.close()

    if not row:
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos")

    token = secrets.token_hex(32)
    _sessoes_portaria[token] = time.time() + 24 * 3600
    return {"status": "ok", "token": token, "tipo": "vitima", "vitima_id": row[0]}


@server.post("/api/vitima/pre-cadastro-medida")
async def vitima_pre_cadastro(
    foto: UploadFile = File(...),
    token: str = Depends(_requer_portaria),
):
    """Vítima faz upload da medida protetiva de casa. Fica pendente até confirmar CNH na entrada."""
    tmp_path = await _salvar_temp(foto)
    try:
        dados = ocr.extrair_dados_medida_protetiva(str(tmp_path))

        if dados["numero_processo"] == "Não encontrado":
            return JSONResponse(status_code=422, content={
                "status": "erro",
                "mensagem": "Número do processo não identificado. Foto muito escura ou desfocada?"
            })

        conn = ocr.conectar()
        cur  = conn.cursor()
        cur.execute("""
            INSERT INTO pre_cadastros_medida
                (numero_processo, nome_vitima, cpf_vitima, nome_agressor, cpf_agressor, data_emissao, vara)
            VALUES (%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (numero_processo) DO NOTHING
            RETURNING id
        """, (dados["numero_processo"], dados["nome_vitima"], dados["cpf_vitima"],
              dados["nome_agressor"], dados.get("cpf_agressor"), dados["data_emissao"], dados["vara"]))
        row = cur.fetchone()
        conn.commit(); cur.close(); conn.close()

        return {
            "status"          : "ok",
            "ja_existia"      : row is None,
            "numero_processo" : dados["numero_processo"],
            "nome_vitima"     : dados["nome_vitima"],
            "nome_agressor"   : dados["nome_agressor"],
            "mensagem"        : "Medida pré-cadastrada. Será ativada quando você apresentar sua CNH na entrada do evento."
        }
    finally:
        tmp_path.unlink(missing_ok=True)


@server.get("/api/vitima/status")
async def vitima_status(token: str = Depends(_requer_portaria)):
    """Retorna medidas pré-cadastradas ainda pendentes de ativação."""
    conn = ocr.conectar()
    cur  = conn.cursor()
    cur.execute("""
        SELECT numero_processo, nome_vitima, nome_agressor, data_emissao, ativada, criado_em
        FROM pre_cadastros_medida ORDER BY criado_em DESC
    """)
    rows = cur.fetchall()
    cur.close(); conn.close()
    return {"status": "ok", "medidas": [
        {"numero_processo": r[0], "nome_vitima": r[1], "nome_agressor": r[2],
         "data_emissao": r[3], "ativada": r[4], "criado_em": str(r[5])}
        for r in rows
    ]}


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

        # Verifica se o agressor já está presente no local
        cpf_agressor = dados.get("cpf_agressor", "Não encontrado")
        agressor_presente = False
        vitima_presente   = False

        if cpf_agressor and cpf_agressor != "Não encontrado":
            cur.execute(
                "SELECT id FROM presencas WHERE cpf = %s AND saida_em IS NULL",
                (cpf_agressor,)
            )
            if cur.fetchone():
                agressor_presente = True
                # Corrige o tipo da presença para 'agressor'
                cur.execute(
                    "UPDATE presencas SET tipo = 'agressor' WHERE cpf = %s AND saida_em IS NULL",
                    (cpf_agressor,)
                )
                conn.commit()

        cpf_vitima = dados.get("cpf_vitima", "Não encontrado")
        if cpf_vitima and cpf_vitima != "Não encontrado":
            cur.execute(
                "SELECT id FROM presencas WHERE cpf = %s AND saida_em IS NULL",
                (cpf_vitima,)
            )
            if cur.fetchone():
                vitima_presente = True
                cur.execute(
                    "UPDATE presencas SET tipo = 'vitima' WHERE cpf = %s AND saida_em IS NULL",
                    (cpf_vitima,)
                )
                conn.commit()

        cur.close()
        conn.close()

        nivel = "verde"
        alerta = False
        mensagem_alerta = ""

        if agressor_presente and vitima_presente:
            nivel = "vermelho-urgente"
            alerta = True
            mensagem_alerta = f"URGENTE: {dados['nome_agressor']} (agressor) e {dados['nome_vitima']} (vítima) estão AMBOS presentes no local!"
        elif agressor_presente:
            nivel = "vermelho"
            alerta = True
            mensagem_alerta = f"ALERTA: {dados['nome_agressor']} está presente no local e possui medida protetiva ativa!"
        elif vitima_presente:
            nivel = "amarelo"
            alerta = True
            mensagem_alerta = f"ATENÇÃO: {dados['nome_vitima']} (vítima protegida) está presente no local."

        return {
            "status"           : "ok",
            "ja_existia"       : row is None,
            "numero_processo"  : dados["numero_processo"],
            "nome_vitima"      : dados["nome_vitima"],
            "nome_agressor"    : dados["nome_agressor"],
            "cpf_agressor"     : cpf_agressor,
            "data_emissao"     : dados["data_emissao"],
            "vara"             : dados["vara"],
            "nivel"            : nivel,
            "alerta"           : alerta,
            "agressor_presente": agressor_presente,
            "vitima_presente"  : vitima_presente,
            "mensagem_alerta"  : mensagem_alerta,
        }

    except Exception as e:
        return JSONResponse(status_code=500, content={
            "status": "erro", "mensagem": f"Erro interno: {str(e)}"
        })
    finally:
        tmp_path.unlink(missing_ok=True)


def _ativar_pre_cadastros(cpf_vitima: str):
    """Promove medidas pré-cadastradas para o sistema principal quando a vítima apresenta sua CNH."""
    conn = ocr.conectar()
    cur  = conn.cursor()
    cur.execute("""
        SELECT numero_processo, nome_vitima, cpf_vitima, nome_agressor, cpf_agressor, data_emissao, vara
        FROM pre_cadastros_medida
        WHERE cpf_vitima = %s AND ativada = FALSE
    """, (cpf_vitima,))
    pendentes = cur.fetchall()
    for p in pendentes:
        vitima_id   = ocr.salvar_vitima(p[1], p[2])
        agressor_id = ocr.salvar_agressor(p[3], p[4])
        ocr.salvar_medida_protetiva(p[0], vitima_id, agressor_id, p[5], p[6])
        cur.execute("UPDATE pre_cadastros_medida SET ativada=TRUE WHERE numero_processo=%s", (p[0],))
    conn.commit(); cur.close(); conn.close()


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

        # Ativa pré-cadastros da vítima (medidas cadastradas de casa)
        _ativar_pre_cadastros(dados["cpf"])

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


# ─────────────────────────────────────────────
#  PAINEL ADMIN — login, logout e páginas
# ─────────────────────────────────────────────


@server.post("/api/admin/login")
async def admin_login(request: Request):
    """Autentica o administrador e retorna um token de sessão."""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Corpo da requisição inválido")

    usuario = body.get("usuario", "")
    senha   = body.get("senha", "")

    usuario_ok = secrets.compare_digest(usuario, ADMIN_USER)
    senha_ok   = secrets.compare_digest(senha,   ADMIN_PASS)

    if not (usuario_ok and senha_ok):
        raise HTTPException(status_code=401, detail="Usuário ou senha incorretos")

    token = secrets.token_hex(32)
    _sessoes_admin[token] = time.time() + 8 * 3600  # expira em 8 horas
    return {"status": "ok", "token": token}


@server.post("/api/admin/logout")
async def admin_logout(token: str = Depends(_requer_admin)):
    """Encerra a sessão do administrador."""
    _sessoes_admin.pop(token, None)
    return {"status": "ok"}


@server.get("/api/admin/stats")
async def admin_stats(token: str = Depends(_requer_admin)):
    """Estatísticas gerais para o dashboard admin."""
    try:
        conn = ocr.conectar()
        cur  = conn.cursor()

        # Presentes agora
        cur.execute("SELECT COUNT(*), tipo FROM presencas WHERE saida_em IS NULL GROUP BY tipo")
        rows_pres = cur.fetchall()
        presentes_map = {r[1]: r[0] for r in rows_pres}
        total_presentes     = sum(presentes_map.values())
        agressores_presentes = presentes_map.get("agressor", 0)
        vitimas_presentes    = presentes_map.get("vitima",   0)

        # Totais de cadastro
        cur.execute("SELECT COUNT(*) FROM medidas_protetivas")
        total_medidas = cur.fetchone()[0]

        # Entradas e saídas hoje (usando fuso horário local do servidor)
        cur.execute("""
            SELECT COUNT(*) FROM presencas
            WHERE entrada_em::date = CURRENT_DATE
        """)
        entradas_hoje = cur.fetchone()[0]

        cur.execute("""
            SELECT COUNT(*) FROM presencas
            WHERE saida_em IS NOT NULL AND saida_em::date = CURRENT_DATE
        """)
        saidas_hoje = cur.fetchone()[0]

        # Entradas por hora hoje
        cur.execute("""
            SELECT EXTRACT(HOUR FROM entrada_em)::int AS hora, COUNT(*) AS total
            FROM   presencas
            WHERE  entrada_em::date = CURRENT_DATE
            GROUP  BY hora
            ORDER  BY hora
        """)
        entradas_por_hora = [{"hora": r[0], "total": r[1]} for r in cur.fetchall()]

        cur.close()
        conn.close()

        return {
            "status"              : "ok",
            "total_presentes"     : total_presentes,
            "agressores_presentes": agressores_presentes,
            "vitimas_presentes"   : vitimas_presentes,
            "total_medidas"       : total_medidas,
            "entradas_hoje"       : entradas_hoje,
            "saidas_hoje"         : saidas_hoje,
            "entradas_por_hora"   : entradas_por_hora,
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "erro", "mensagem": str(e)})


@server.get("/api/admin/historico")
async def admin_historico(
    data: str = Query(default=None, description="Data no formato YYYY-MM-DD"),
    token: str = Depends(_requer_admin),
):
    """Histórico de entradas e saídas. Sem `data` retorna o dia atual."""
    try:
        conn = ocr.conectar()
        cur  = conn.cursor()
        if data:
            cur.execute("""
                SELECT cpf, nome, tipo, entrada_em, saida_em
                FROM   presencas
                WHERE  entrada_em::date = %s::date
                ORDER  BY entrada_em DESC
            """, (data,))
        else:
            cur.execute("""
                SELECT cpf, nome, tipo, entrada_em, saida_em
                FROM   presencas
                WHERE  entrada_em::date = CURRENT_DATE
                ORDER  BY entrada_em DESC
            """)
        rows = cur.fetchall()
        cur.close()
        conn.close()
        historico = [
            {
                "cpf"       : r[0],
                "nome"      : r[1],
                "tipo"      : r[2],
                "entrada_em": str(r[3]) if r[3] else None,
                "saida_em"  : str(r[4]) if r[4] else None,
            }
            for r in rows
        ]
        return {"status": "ok", "historico": historico}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "erro", "mensagem": str(e)})


@server.get("/api/admin/medidas")
async def admin_medidas(token: str = Depends(_requer_admin)):
    """Lista todas as medidas protetivas com detalhes de vítima e agressor."""
    try:
        conn = ocr.conectar()
        cur  = conn.cursor()
        cur.execute("""
            SELECT mp.numero_processo, mp.data_emissao, mp.vara, mp.ativa, mp.criado_em,
                   v.nome  AS nome_vitima,
                   a.nome  AS nome_agressor,
                   a.cpf   AS cpf_agressor
            FROM   medidas_protetivas mp
            JOIN   vitimas    v ON v.id = mp.vitima_id
            JOIN   agressores a ON a.id = mp.agressor_id
            ORDER  BY mp.criado_em DESC
        """)
        rows = cur.fetchall()
        cur.close()
        conn.close()
        medidas = [
            {
                "numero_processo": r[0],
                "data_emissao"   : r[1],
                "vara"           : r[2],
                "ativa"          : r[3],
                "criado_em"      : str(r[4]) if r[4] else None,
                "nome_vitima"    : r[5],
                "nome_agressor"  : r[6],
                "cpf_agressor"   : r[7],
            }
            for r in rows
        ]
        return {"status": "ok", "medidas": medidas}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "erro", "mensagem": str(e)})


@server.get("/api/admin/agressores")
async def admin_agressores(token: str = Depends(_requer_admin)):
    """Lista todos os agressores com contagem de medidas ativas."""
    try:
        conn = ocr.conectar()
        cur  = conn.cursor()
        cur.execute("""
            SELECT a.id, a.nome, a.cpf, a.criado_em,
                   COUNT(mp.id) FILTER (WHERE mp.ativa = TRUE) AS total_medidas
            FROM   agressores a
            LEFT   JOIN medidas_protetivas mp ON mp.agressor_id = a.id
            GROUP  BY a.id
            ORDER  BY a.nome
        """)
        rows = cur.fetchall()
        cur.close()
        conn.close()
        agressores = [
            {
                "id"           : r[0],
                "nome"         : r[1],
                "cpf"          : r[2],
                "criado_em"    : str(r[3]) if r[3] else None,
                "total_medidas": r[4],
            }
            for r in rows
        ]
        return {"status": "ok", "agressores": agressores}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "erro", "mensagem": str(e)})


@server.get("/api/admin/vitimas")
async def admin_vitimas(token: str = Depends(_requer_admin)):
    """Lista todas as vítimas com contagem de medidas ativas."""
    try:
        conn = ocr.conectar()
        cur  = conn.cursor()
        cur.execute("""
            SELECT v.id, v.nome, v.cpf, v.data_nascimento, v.criado_em,
                   COUNT(mp.id) FILTER (WHERE mp.ativa = TRUE) AS total_medidas
            FROM   vitimas v
            LEFT   JOIN medidas_protetivas mp ON mp.vitima_id = v.id
            GROUP  BY v.id
            ORDER  BY v.nome
        """)
        rows = cur.fetchall()
        cur.close()
        conn.close()
        vitimas = [
            {
                "id"            : r[0],
                "nome"          : r[1],
                "cpf"           : r[2],
                "data_nascimento": r[3],
                "criado_em"     : str(r[4]) if r[4] else None,
                "total_medidas" : r[5],
            }
            for r in rows
        ]
        return {"status": "ok", "vitimas": vitimas}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "erro", "mensagem": str(e)})


@server.post("/api/admin/resetar-banco")
async def resetar_banco_manual(
    request: Request,
    token: str = Depends(_requer_admin),
):
    """Reset completo do banco. Requer confirmação no body: {"confirmar": true}"""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Corpo da requisição inválido")

    if not body.get("confirmar"):
        raise HTTPException(status_code=400, detail='Envie {"confirmar": true, "senha": "..."} para confirmar')

    senha = body.get("senha", "")
    if not secrets.compare_digest(senha, ADMIN_PASS):
        raise HTTPException(status_code=401, detail="Senha incorreta")

    ocr.resetar_banco()
    return {"status": "ok", "mensagem": "Banco de dados resetado com sucesso."}


@server.delete("/api/admin/presencas/antigas")
async def purgar_presencas_antigas(
    dias: int = Query(default=RETENCAO_DIAS, ge=1, le=3650),
    token: str = Depends(_requer_admin),
):
    """Remove registros de presença com mais de `dias` dias (padrão: RETENCAO_DIAS)."""
    try:
        removidos = ocr.purgar_presencas_antigas(dias)
        return {"status": "ok", "removidos": removidos, "dias": dias}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "erro", "mensagem": str(e)})


@server.get("/api/admin/presencas/retencao")
async def info_retencao(token: str = Depends(_requer_admin)):
    """Retorna quantos registros seriam removidos para cada janela de retenção."""
    try:
        from datetime import datetime, timedelta, timezone
        conn = ocr.conectar()
        cur  = conn.cursor()
        resultado = {}
        for dias in (30, 60, 90, 180, 365):
            corte = datetime.now(timezone.utc) - timedelta(days=dias)
            cur.execute("SELECT COUNT(*) FROM presencas WHERE entrada_em < %s", (corte,))
            resultado[f"mais_de_{dias}_dias"] = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM presencas")
        resultado["total"] = cur.fetchone()[0]
        resultado["retencao_atual_dias"] = RETENCAO_DIAS
        cur.close()
        conn.close()
        return {"status": "ok", **resultado}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "erro", "mensagem": str(e)})


# ─────────────────────────────────────────────
#  SPA FALLBACK — deve ser o último route
# ─────────────────────────────────────────────

@server.get("/{full_path:path}", include_in_schema=False)
async def spa_fallback(full_path: str):
    index = _DIST / "index.html"
    if index.exists():
        return FileResponse(index)
    return JSONResponse(
        status_code=503,
        content={"detail": "Frontend não compilado. Execute: cd frontend && npm run build"},
    )
