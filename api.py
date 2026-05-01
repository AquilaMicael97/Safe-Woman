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
import secrets
import pathlib
import tempfile

if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = r"C:\BIOPARK\MariaPenha\chave.json"
sys.stdout.reconfigure(encoding="utf-8")

import app as ocr

from fastapi import FastAPI, File, UploadFile, Query, Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

# ─────────────────────────────────────────────
#  AUTENTICAÇÃO ADMIN
# ─────────────────────────────────────────────

ADMIN_USER = os.environ.get("ADMIN_USER", "admin")
ADMIN_PASS = os.environ.get("ADMIN_PASS", "admin123")

# Sessões ativas: token -> timestamp de expiração
_sessoes_admin: dict = {}

_bearer = HTTPBearer(auto_error=False)

def _requer_admin(
    credenciais: HTTPAuthorizationCredentials = Depends(_bearer)
) -> str:
    if not credenciais:
        raise HTTPException(status_code=401, detail="Token não fornecido")
    token = credenciais.credentials
    expira = _sessoes_admin.get(token)
    if not expira or time.time() > expira:
        _sessoes_admin.pop(token, None)
        raise HTTPException(status_code=401, detail="Sessão inválida ou expirada")
    return token

server = FastAPI(title="Maria Penha - Portaria")

BASE_DIR = pathlib.Path(__file__).resolve().parent


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

server.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

@server.get("/")
async def root():
    path = BASE_DIR / "static" / "index.html"
    try:
        return FileResponse(str(path))
    except Exception as e:
        return JSONResponse({"erro": str(e), "path": str(path), "existe": path.exists()})


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


# ─────────────────────────────────────────────
#  PAINEL ADMIN — login, logout e páginas
# ─────────────────────────────────────────────

@server.get("/login")
async def login_page():
    return FileResponse(str(BASE_DIR / "static" / "login.html"))


@server.get("/admin")
async def admin_page():
    return FileResponse(str(BASE_DIR / "static" / "admin.html"))


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
    token: str = Depends(_requer_admin),
    data_inicio: str = None,
    data_fim: str = None,
):
    """Histórico de entradas e saídas. Aceita filtros data_inicio e data_fim (YYYY-MM-DD)."""
    try:
        conn = ocr.conectar()
        cur  = conn.cursor()
        if data_inicio and data_fim:
            cur.execute("""
                SELECT cpf, nome, tipo, entrada_em, saida_em
                FROM   presencas
                WHERE  entrada_em::date BETWEEN %s AND %s
                ORDER  BY entrada_em DESC
            """, (data_inicio, data_fim))
        elif data_inicio:
            cur.execute("""
                SELECT cpf, nome, tipo, entrada_em, saida_em
                FROM   presencas
                WHERE  entrada_em::date = %s
                ORDER  BY entrada_em DESC
            """, (data_inicio,))
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
