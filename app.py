import os
import re
import sys
import json
import tempfile
import psycopg2
from pathlib import Path
from google.cloud import vision

sys.stdout.reconfigure(encoding='utf-8')

# ─── Credenciais Google Cloud ───────────────────────────────────────────────
# Em produção: variável GOOGLE_CREDENTIALS_JSON com o conteúdo do JSON da chave
# Em dev local: variável GOOGLE_APPLICATION_CREDENTIALS com o caminho do arquivo
_cred_json = os.environ.get("GOOGLE_CREDENTIALS_JSON")
if _cred_json and not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
    _tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False)
    _tmp.write(_cred_json)
    _tmp.close()
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = _tmp.name
elif not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
    # fallback para desenvolvimento local
    _local = Path(__file__).parent / "chave2.json"
    if _local.exists():
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(_local)


# ─────────────────────────────────────────────
#  CONEXÃO GOOGLE CLOUD VISION
# ─────────────────────────────────────────────

def testar_conexao():
    try:
        client = vision.ImageAnnotatorClient()
        print("✔ Conexão com Google Cloud estabelecida com sucesso!")
        return client
    except Exception as e:
        print(f"✖ Erro ao conectar: {e}")


# ─────────────────────────────────────────────
#  EXTRAÇÃO — CNH
# ─────────────────────────────────────────────

def extrair_dados_cnh(caminho_foto):
    """
    Extrai nome, CPF e data de nascimento de uma foto de CNH.
    Retorna um dicionário com os campos extraídos.
    """
    client = vision.ImageAnnotatorClient()

    with open(caminho_foto, 'rb') as f:
        content = f.read()

    response = client.document_text_detection(image=vision.Image(content=content))
    texto_bruto = response.text_annotations[0].description if response.text_annotations else ""

    print("\n--- TEXTO BRUTO (CNH) ---")
    print(texto_bruto)
    print("-------------------------\n")

    # CPF: 000.000.000-00
    cpf_match = re.search(r'\d{3}\.?\d{3}\.?\d{3}-?\d{2}', texto_bruto)
    cpf = cpf_match.group(0) if cpf_match else "Não encontrado"

    # Data de nascimento: primeira data DD/MM/AAAA
    datas = re.findall(r'\d{2}/\d{2}/\d{4}', texto_bruto)
    data_nasc = datas[0] if datas else "Não encontrada"

    # Nome: tenta rótulo "NOME" → senão, busca linha em maiúsculas com 2-4 palavras
    # que apareça antes de "DOC IDENTIDADE" ou "CPF" (padrão de CNHs sem rótulo)
    linhas = [l.strip() for l in texto_bruto.split('\n') if l.strip()]
    nome = "Não encontrado"

    # Estratégia 1: rótulo explícito "NOME"
    for i, linha in enumerate(linhas):
        if re.search(r'\bNOME\b', linha.upper()):
            candidato = linha.split("NOME", 1)[-1].strip()
            if candidato:
                nome = candidato
            elif i + 1 < len(linhas):
                nome = linhas[i + 1]
            break

    # Estratégia 2: CNH sem rótulo — nome em maiúsculas antes de "DOC IDENTIDADE"
    if nome == "Não encontrado":
        for i, linha in enumerate(linhas):
            if re.search(r'DOC.?\s*IDENTIDADE|CPF', linha, re.IGNORECASE):
                # Varre as linhas anteriores em busca de um nome (2 a 4 palavras maiúsculas)
                for j in range(i - 1, max(i - 6, -1), -1):
                    candidato = linhas[j]
                    palavras = candidato.split()
                    if (2 <= len(palavras) <= 5
                            and re.match(r'^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s]+$', candidato)
                            and not re.search(r'BRASIL|MINIST|DEPART|TRANSIT|HABILI|NACION', candidato)):
                        nome = candidato
                        break
                break

    dados = {
        "tipo": "cnh",
        "nome": nome,
        "cpf": cpf,
        "data_nascimento": data_nasc,
    }

    print("Dados extraídos da CNH:", dados)
    return dados


# ─────────────────────────────────────────────
#  EXTRAÇÃO — MEDIDA PROTETIVA
# ─────────────────────────────────────────────

def extrair_dados_medida_protetiva(caminho_foto):
    """
    Extrai dados de uma Medida Protetiva do Paraná.

    Suporta dois formatos:
      Formato 1 — seções "Qualificação do réu" / "Qualificação da vítima"
                  (ex: documento 001366529-48)
      Formato 2 — campos "Solicitante(s)" / "Noticiado(s)"
                  (ex: PROJUDI 0000835-10.2021.8.16.0073)

    ATENÇÃO: no Formato 1 o CPF que aparece no documento é do AGRESSOR
    (seção do réu). O CPF da vítima pode constar como "Não Cadastrado".
    Ambos são extraídos separadamente para o cruzamento na portaria.
    """
    client = vision.ImageAnnotatorClient()

    with open(caminho_foto, 'rb') as f:
        content = f.read()

    response = client.document_text_detection(image=vision.Image(content=content))
    texto_bruto = response.text_annotations[0].description if response.text_annotations else ""

    print("\n--- TEXTO BRUTO (MEDIDA PROTETIVA) ---")
    print(texto_bruto)
    print("---------------------------------------\n")

    linhas = [l.strip() for l in texto_bruto.split('\n') if l.strip()]
    texto_unificado = ' '.join(linhas)

    # ── Número do processo ─────────────────────────────────────────────────
    # Formato CNJ:  0000835-10.2021.8.16.0073
    # Formato nº:   001366529-48  (após "nº" ou "n°")
    numero_processo = "Não encontrado"
    cnj_match = re.search(r'\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}', texto_unificado)
    if cnj_match:
        numero_processo = cnj_match.group(0)
    else:
        num_match = re.search(r'n[º°o]\.?\s*(\d{6,9}-\d{2})', texto_unificado, re.IGNORECASE)
        if num_match:
            numero_processo = num_match.group(1)

    # ── Data de emissão ────────────────────────────────────────────────────
    # Prioridade: data explicitamente rotulada → última data do doc → "Não encontrada"
    # Evita pegar datas de nascimento que aparecem nas seções de qualificação
    data_emissao = "Não encontrada"
    data_rotulada = re.search(
        r'(?:data\s*(?:da?\s*)?(?:emiss[aã]o|decis[aã]o|expedi[çc][aã]o|decreto))'
        r'[:\s]+(\d{2}/\d{2}/\d{4})',
        texto_unificado, re.IGNORECASE
    )
    if data_rotulada:
        data_emissao = data_rotulada.group(1)
    else:
        # Pega todas as datas e descarta as que estão dentro das seções de qualificação
        # (nascimento do réu e da vítima), ficando com a última mencionada no doc
        todas_datas = re.findall(r'\d{2}/\d{2}/\d{4}', texto_unificado)
        if len(todas_datas) > 2:
            data_emissao = todas_datas[-1]   # última costuma ser a do documento
        elif todas_datas:
            data_emissao = todas_datas[0]

    # ── Vara / Comarca ─────────────────────────────────────────────────────
    vara_match = re.search(
        r'(COMARCA\s+DE\s+[\w\s]{3,40}|UNIDADE\s+REGIONALIZADA[^\n]{3,60}'
        r'|\d+[ªa°]\s*VARA[\w\s]{3,40}|JUIZADO[\w\s]+VIOL[EÊ]NCIA[\w\s]*)',
        texto_bruto, re.IGNORECASE
    )
    vara = vara_match.group(0).strip().replace('\n', ' ') if vara_match else "Não identificada"

    nome_vitima   = "Não encontrado"
    nome_agressor = "Não encontrado"
    cpf_vitima    = "Não encontrado"
    cpf_agressor  = "Não encontrado"

    # ══════════════════════════════════════════════════════════════════════
    # FORMATO 1 — seções "Qualificação do réu" / "Qualificação da vítima"
    # ══════════════════════════════════════════════════════════════════════
    if re.search(r'qualifica[çc][aã]o\s+do\s+r[eé]u', texto_bruto, re.IGNORECASE):

        # Divide o texto em seção do réu e seção da vítima
        secao_reu, secao_vitima = _dividir_secoes_formato1(linhas)

        nome_agressor = _campo_na_secao(secao_reu,    r'nome\s*[:：]?\s*')
        cpf_agressor  = _cpf_na_secao(secao_reu)

        nome_vitima   = _campo_na_secao(secao_vitima, r'nome\s*[:：]?\s*')
        cpf_vitima    = _cpf_na_secao(secao_vitima)

    # ══════════════════════════════════════════════════════════════════════
    # FORMATO 2 — PROJUDI: "Solicitante(s)" / "Noticiado(s)"
    # ══════════════════════════════════════════════════════════════════════
    elif re.search(r'solicitante|noticiado', texto_bruto, re.IGNORECASE):

        # Vítima = Solicitante / Requerente
        # Padrão: "Solicitante(s):  • JOSIANE ALVES"
        v_match = re.search(
            r'(?:solicitante|requerente)\(s\)[):\s•*·]+([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][A-ZÁÀÂÃÉÊÍÓÔÕÚÇa-záàâãéêíóôõúç\s]{3,60})',
            texto_bruto, re.IGNORECASE
        )
        if v_match:
            nome_vitima = v_match.group(1).strip()

        # Agressor = Noticiado / Requerido
        # Padrão: "Noticiado(s):  • WALLASE GONÇALVES ARAUJO"
        a_match = re.search(
            r'(?:noticiado|requerido)\(s\)[):\s•*·]+([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][A-ZÁÀÂÃÉÊÍÓÔÕÚÇa-záàâãéêíóôõúç\s]{3,60})',
            texto_bruto, re.IGNORECASE
        )
        if a_match:
            nome_agressor = a_match.group(1).strip()

        # CPF pode estar em qualquer parte do doc neste formato
        cpf_all = re.findall(r'\d{3}\.?\d{3}\.?\d{3}-?\d{2}', texto_unificado)
        if cpf_all:
            cpf_vitima = cpf_all[0]

    # ══════════════════════════════════════════════════════════════════════
    # FALLBACK — padrões genéricos
    # ══════════════════════════════════════════════════════════════════════
    else:
        rotulos_vitima   = r'(V[IÍ]TIMA|REQUERENTE|OFENDIDA|AUTORA)'
        rotulos_agressor = r'(R[EÉ]U|REQUERIDO|AGRESSOR|ACUSADO|NOTICIADO)'
        nome_vitima   = _extrair_nome_apos_rotulo(texto_unificado, linhas, rotulos_vitima)
        nome_agressor = _extrair_nome_apos_rotulo(texto_unificado, linhas, rotulos_agressor)
        cpf_all = re.findall(r'\d{3}\.?\d{3}\.?\d{3}-?\d{2}', texto_unificado)
        if cpf_all:
            cpf_vitima = cpf_all[0]

    dados = {
        "tipo"            : "medida_protetiva",
        "numero_processo" : numero_processo,
        "data_emissao"    : data_emissao,
        "nome_vitima"     : nome_vitima,
        "cpf_vitima"      : cpf_vitima,
        "nome_agressor"   : nome_agressor,
        "cpf_agressor"    : cpf_agressor,   # campo novo — CPF do réu
        "vara"            : vara,
    }

    print("Dados extraídos da Medida Protetiva:", dados)
    return dados


# ─── auxiliares para Formato 1 ────────────────────────────────────────────────

def _dividir_secoes_formato1(linhas):
    """
    Separa as linhas em [seção_do_réu] e [seção_da_vítima] pelo cabeçalho de cada seção.
    """
    idx_reu    = next((i for i, l in enumerate(linhas)
                       if re.search(r'qualifica[çc][aã]o\s+do\s+r[eé]u', l, re.IGNORECASE)), -1)
    idx_vitima = next((i for i, l in enumerate(linhas)
                       if re.search(r'qualifica[çc][aã]o\s+da\s+v[ií]tima', l, re.IGNORECASE)), -1)

    secao_reu    = linhas[idx_reu:idx_vitima]    if idx_reu    != -1 else []
    secao_vitima = linhas[idx_vitima:]           if idx_vitima != -1 else []
    return secao_reu, secao_vitima


def _campo_na_secao(secao, rotulo_regex):
    """Busca 'Rotulo: Valor' dentro de uma lista de linhas."""
    for linha in secao:
        match = re.search(rotulo_regex + r'(.+)', linha, re.IGNORECASE)
        if match:
            valor = match.group(1).strip()
            if valor:
                return valor
    return "Não encontrado"


def _cpf_na_secao(secao):
    """Extrai o primeiro CPF encontrado em uma seção de linhas."""
    for linha in secao:
        # Aceita "C.P.F.: 000.000.000-00"  e  "CPF/CNPJ: 000.000.000-00"
        cpf_match = re.search(r'\d{3}\.?\d{3}\.?\d{3}-?\d{2}', linha)
        if cpf_match:
            return cpf_match.group(0)
    return "Não encontrado"


def _extrair_nome_apos_rotulo(texto_unificado, linhas, padrao_rotulo):
    """Fallback genérico: encontra nome após um rótulo em texto corrido ou por linhas."""
    match = re.search(
        padrao_rotulo + r'[:\s]+([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s]{5,60})',
        texto_unificado, re.IGNORECASE
    )
    if match:
        return match.group(2).strip()

    for i, linha in enumerate(linhas):
        if re.search(padrao_rotulo, linha, re.IGNORECASE):
            resto = re.sub(padrao_rotulo + r'[:\s]*', '', linha, flags=re.IGNORECASE).strip()
            if len(resto) > 4:
                return resto
            if i + 1 < len(linhas):
                proxima = linhas[i + 1]
                if re.match(r'^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s]{5,}$', proxima):
                    return proxima

    return "Não encontrado"


# ─────────────────────────────────────────────
#  BANCO DE DADOS — SCHEMA E OPERAÇÕES
# ─────────────────────────────────────────────

_SQL_PATH = Path(__file__).parent / "db.sql"

#AQUI É PARA CONECTAR O POSTGRES LOCAL
# def conectar():
#     return psycopg2.connect(
#         dbname=os.environ.get("DB_NAME",     "cnh_db"),
#         user=os.environ.get("DB_USER",       "postgres"),
#         password=os.environ.get("DB_PASSWORD", "@SV$ab!@#2506"),
#         host=os.environ.get("DB_HOST",       "localhost"),
#         port=os.environ.get("DB_PORT",       "5432"),
#     )

#RODAR O POSTGRES NO RAILWAY E USAR ESSA CONFIGURAÇÃO PARA CONECTAR
def conectar():
    db_url = os.environ.get("DATABASE_URL")
    if db_url:
        # Railway e outros serviços fornecem DATABASE_URL diretamente
        return psycopg2.connect(db_url)
    return psycopg2.connect(
        dbname=os.environ.get("DB_NAME",     "cnh_db"),
        user=os.environ.get("DB_USER",       "postgres"),
        password=os.environ.get("DB_PASSWORD", ""),
        host=os.environ.get("DB_HOST",       "localhost"),
        port=os.environ.get("DB_PORT",       "5432"),
    )


def criar_tabelas():
    sql = _SQL_PATH.read_text(encoding="utf-8")
    conn = conectar()
    cur = conn.cursor()
    cur.execute(sql)
    conn.commit()
    cur.close()
    conn.close()
    print("✔ Tabelas criadas/verificadas com sucesso.")


def salvar_vitima(nome, cpf, data_nascimento=None):
    """Insere ou retorna a vítima existente pelo CPF."""
    conn = conectar()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO vitimas (nome, cpf, data_nascimento)
        VALUES (%s, %s, %s)
        ON CONFLICT (cpf) DO UPDATE SET nome = EXCLUDED.nome
        RETURNING id;
    """, (nome, cpf or None, data_nascimento))
    vitima_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    print(f"✔ Vítima salva — ID {vitima_id}: {nome}")
    return vitima_id


def salvar_agressor(nome, cpf=None):
    """
    Insere agressor ou retorna o existente.
    Prioridade de busca: CPF (quando disponível) → nome exato.
    Se o registro já existe mas estava sem CPF, atualiza.
    """
    conn = conectar()
    cur = conn.cursor()

    cpf_valor = cpf if (cpf and cpf != "Não encontrado") else None

    if cpf_valor:
        cur.execute("SELECT id FROM agressores WHERE cpf = %s", (cpf_valor,))
    else:
        cur.execute("SELECT id FROM agressores WHERE LOWER(nome) = LOWER(%s)", (nome,))

    existente = cur.fetchone()
    if existente:
        agressor_id = existente[0]
        # Aproveita para salvar CPF se antes não havia
        if cpf_valor:
            cur.execute("UPDATE agressores SET cpf = %s WHERE id = %s AND cpf IS NULL",
                        (cpf_valor, agressor_id))
        print(f"✔ Agressor já existe — ID {agressor_id}: {nome}")
    else:
        cur.execute(
            "INSERT INTO agressores (nome, cpf) VALUES (%s, %s) RETURNING id;",
            (nome, cpf_valor)
        )
        agressor_id = cur.fetchone()[0]
        print(f"✔ Agressor salvo — ID {agressor_id}: {nome} | CPF: {cpf_valor or 'não informado'}")

    conn.commit()
    cur.close()
    conn.close()
    return agressor_id


def salvar_medida_protetiva(numero_processo, vitima_id, agressor_id, data_emissao, vara):
    conn = conectar()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO medidas_protetivas
            (numero_processo, vitima_id, agressor_id, data_emissao, vara)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (numero_processo) DO NOTHING
        RETURNING id;
    """, (numero_processo, vitima_id, agressor_id, data_emissao, vara))
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    if row:
        print(f"✔ Medida Protetiva salva — ID {row[0]}: processo {numero_processo}")
    else:
        print(f"⚠ Medida Protetiva já cadastrada: {numero_processo}")


# ─────────────────────────────────────────────
#  CONTROLE DE PRESENÇA (entrada / saída)
# ─────────────────────────────────────────────

def registrar_entrada(cpf, nome, tipo='outro'):
    """
    Registra a entrada de uma pessoa.
    Se já há uma presença ativa para o CPF, atualiza nome/tipo.
    Retorna (presenca_id, eh_nova_entrada).
    """
    conn = conectar()
    cur  = conn.cursor()

    cur.execute(
        "SELECT id FROM presencas WHERE cpf = %s AND saida_em IS NULL",
        (cpf,)
    )
    existente = cur.fetchone()

    if existente:
        cur.execute(
            "UPDATE presencas SET nome = %s, tipo = %s WHERE id = %s",
            (nome, tipo, existente[0])
        )
        presenca_id = existente[0]
        nova = False
    else:
        cur.execute(
            "INSERT INTO presencas (cpf, nome, tipo) VALUES (%s, %s, %s) RETURNING id",
            (cpf, nome, tipo)
        )
        presenca_id = cur.fetchone()[0]
        nova = True

    conn.commit()
    cur.close()
    conn.close()
    return presenca_id, nova


def registrar_saida(cpf):
    """
    Dá baixa na presença ativa do CPF informado.
    Retorna dict com nome, tipo, entrada_em ou None se não estava dentro.
    """
    conn = conectar()
    cur  = conn.cursor()
    cur.execute("""
        UPDATE presencas
        SET    saida_em = NOW()
        WHERE  cpf = %s AND saida_em IS NULL
        RETURNING nome, tipo, entrada_em
    """, (cpf,))
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()

    if row:
        return {"nome": row[0], "tipo": row[1], "entrada_em": str(row[2])}
    return None


def resetar_banco() -> dict:
    """
    Apaga todos os dados de todas as tabelas e reinicia os IDs (SERIAL).
    Usado para reset diário em ambientes de demo/homologação.
    """
    conn = conectar()
    cur  = conn.cursor()
    cur.execute("""
        TRUNCATE presencas, medidas_protetivas, vitimas, agressores
        RESTART IDENTITY CASCADE
    """)
    conn.commit()
    cur.close()
    conn.close()
    print("✔ Banco de dados resetado — todas as tabelas limpas.")
    return {"resetado": True}


def purgar_presencas_antigas(dias: int = 90) -> int:
    """
    Remove registros de presença com mais de `dias` dias (LGPD — retenção limitada).
    Retorna o número de registros excluídos.
    """
    from datetime import datetime, timedelta, timezone
    corte = datetime.now(timezone.utc) - timedelta(days=dias)
    conn = conectar()
    cur  = conn.cursor()
    cur.execute("DELETE FROM presencas WHERE entrada_em < %s", (corte,))
    total = cur.rowcount
    conn.commit()
    cur.close()
    conn.close()
    return total


def listar_presentes():
    """Retorna todos que estão atualmente no local (saida_em IS NULL)."""
    conn = conectar()
    cur  = conn.cursor()
    cur.execute("""
        SELECT cpf, nome, tipo, entrada_em
        FROM   presencas
        WHERE  saida_em IS NULL
        ORDER  BY entrada_em DESC
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [
        {"cpf": r[0], "nome": r[1], "tipo": r[2], "entrada_em": str(r[3])}
        for r in rows
    ]


def verificar_contrapartes_presentes(cpf_pessoa):
    """
    Verifica se alguma contraparte com medida protetiva está ATUALMENTE no local.

    Se a pessoa é VÍTIMA   → retorna lista de agressores que estão dentro.
    Se a pessoa é AGRESSOR → retorna lista de vítimas que estão dentro.
    """
    conn = conectar()
    cur  = conn.cursor()

    # Agressores ativos presentes (caso a pessoa seja vítima)
    cur.execute("""
        SELECT a.nome, a.cpf, mp.numero_processo
        FROM   vitimas v
        JOIN   medidas_protetivas mp ON mp.vitima_id   = v.id  AND mp.ativa = TRUE
        JOIN   agressores         a  ON a.id           = mp.agressor_id
        JOIN   presencas          p  ON p.cpf          = a.cpf AND p.saida_em IS NULL
        WHERE  v.cpf = %s
    """, (cpf_pessoa,))
    agressores_dentro = [
        {"nome": r[0], "cpf": r[1], "processo": r[2]}
        for r in cur.fetchall()
    ]

    # Vítimas protegidas presentes (caso a pessoa seja agressor)
    cur.execute("""
        SELECT v.nome, v.cpf, mp.numero_processo
        FROM   agressores         a
        JOIN   medidas_protetivas mp ON mp.agressor_id = a.id  AND mp.ativa = TRUE
        JOIN   vitimas            v  ON v.id           = mp.vitima_id
        JOIN   presencas          p  ON p.cpf          = v.cpf AND p.saida_em IS NULL
        WHERE  a.cpf = %s
    """, (cpf_pessoa,))
    vitimas_dentro = [
        {"nome": r[0], "cpf": r[1], "processo": r[2]}
        for r in cur.fetchall()
    ]

    cur.close()
    conn.close()
    return {
        "agressores_dentro": agressores_dentro,
        "vitimas_dentro"   : vitimas_dentro,
    }


# ─────────────────────────────────────────────
#  CRUZAMENTO DE DADOS
# ─────────────────────────────────────────────

def verificar_conflito_por_cpf(cpf_pessoa):
    """
    Dado o CPF lido na portaria (de uma CNH, por exemplo), verifica:
      - Se a pessoa é uma VÍTIMA cadastrada
      - Se a pessoa é um AGRESSOR com medida protetiva ativa
    Retorna um dicionário com o resultado da verificação.
    """
    conn = conectar()
    cur = conn.cursor()

    resultado = {
        "cpf": cpf_pessoa,
        "eh_vitima": False,
        "eh_agressor": False,
        "vitima_info": None,
        "agressor_info": None,
        "medidas_ativas": [],
        "alerta": False,
        "mensagem": "",
    }

    # ── Verifica se é vítima ───────────────────────────────────────────────
    cur.execute("""
        SELECT v.id, v.nome
        FROM vitimas v
        WHERE v.cpf = %s
    """, (cpf_pessoa,))
    row_vitima = cur.fetchone()

    if row_vitima:
        resultado["eh_vitima"] = True
        resultado["vitima_info"] = {"id": row_vitima[0], "nome": row_vitima[1]}

    # ── Verifica se é agressor ────────────────────────────────────────────
    cur.execute("""
        SELECT a.id, a.nome
        FROM agressores a
        WHERE a.cpf = %s
    """, (cpf_pessoa,))
    row_agressor = cur.fetchone()

    if row_agressor:
        resultado["eh_agressor"] = True
        resultado["agressor_info"] = {"id": row_agressor[0], "nome": row_agressor[1]}

        # Busca medidas protetivas ativas vinculadas a esse agressor
        cur.execute("""
            SELECT mp.numero_processo, mp.data_emissao, mp.vara,
                   v.nome AS nome_vitima, v.cpf AS cpf_vitima
            FROM medidas_protetivas mp
            JOIN vitimas v ON v.id = mp.vitima_id
            WHERE mp.agressor_id = %s AND mp.ativa = TRUE
        """, (row_agressor[0],))

        medidas = cur.fetchall()
        resultado["medidas_ativas"] = [
            {
                "processo": m[0],
                "data_emissao": m[1],
                "vara": m[2],
                "vitima": m[3],
                "cpf_vitima": m[4],
            }
            for m in medidas
        ]

    cur.close()
    conn.close()

    # ── Define alerta e mensagem ───────────────────────────────────────────
    if resultado["eh_agressor"] and resultado["medidas_ativas"]:
        resultado["alerta"] = True
        vitimas_str = ", ".join(m["vitima"] for m in resultado["medidas_ativas"])
        resultado["mensagem"] = (
            f"ALERTA: {resultado['agressor_info']['nome']} possui medida(s) protetiva(s) "
            f"ativa(s) em favor de: {vitimas_str}"
        )
    elif resultado["eh_vitima"]:
        resultado["mensagem"] = (
            f"INFO: {resultado['vitima_info']['nome']} está cadastrada como vítima."
        )
    else:
        resultado["mensagem"] = "Pessoa sem restrições cadastradas."

    return resultado


def imprimir_resultado_verificacao(resultado):
    print("\n" + "=" * 50)
    print("RESULTADO DA VERIFICAÇÃO")
    print("=" * 50)
    print(f"CPF verificado : {resultado['cpf']}")

    if resultado["alerta"]:
        print("\n🔴 " + resultado["mensagem"])
        print("\nMedidas protetivas ativas:")
        for m in resultado["medidas_ativas"]:
            print(f"  • Processo : {m['processo']}")
            print(f"    Vítima   : {m['vitima']} (CPF: {m['cpf_vitima']})")
            print(f"    Emissão  : {m['data_emissao']}  |  Vara: {m['vara']}")
    elif resultado["eh_vitima"]:
        print(f"\n🟡 {resultado['mensagem']}")
    else:
        print(f"\n🟢 {resultado['mensagem']}")

    print("=" * 50 + "\n")


# ─────────────────────────────────────────────
#  FLUXO PRINCIPAL
# ─────────────────────────────────────────────

if __name__ == "__main__":
    print("Iniciando processamento...\n")

    # Garante que as tabelas existem
    criar_tabelas()

    # ── PASSO 1: Processar Medida Protetiva ───────────────────────────────
    # Troque pelo caminho real da imagem/scan da medida protetiva
    print("─── Processando Medida Protetiva ───")
    dados_mp = extrair_dados_medida_protetiva("medida_nova.jpg")

    vitima_id = salvar_vitima(
        nome=dados_mp["nome_vitima"],
        cpf=dados_mp["cpf_vitima"],
    )
    agressor_id = salvar_agressor(
        nome=dados_mp["nome_agressor"],
        cpf=dados_mp.get("cpf_agressor"),   # CPF do réu (Formato 1)
    )
    salvar_medida_protetiva(
        numero_processo=dados_mp["numero_processo"],
        vitima_id=vitima_id,
        agressor_id=agressor_id,
        data_emissao=dados_mp["data_emissao"],
        vara=dados_mp["vara"],
    )

    # ── PASSO 2: Processar CNH na portaria ────────────────────────────────
    # Troque pelo caminho real da CNH capturada na entrada do evento
    print("\n─── Processando CNH na portaria ───")
    dados_cnh = extrair_dados_cnh("teste_cnh.jpg")

    # ── PASSO 3: Cruzar dados ─────────────────────────────────────────────
    if dados_cnh["cpf"] != "Não encontrado":
        resultado = verificar_conflito_por_cpf(dados_cnh["cpf"])
        imprimir_resultado_verificacao(resultado)
    else:
        print("⚠ CPF não detectado na CNH — verificação manual necessária.")
