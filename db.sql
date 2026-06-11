CREATE TABLE IF NOT EXISTS contas_vitima (
    id         SERIAL PRIMARY KEY,
    email      VARCHAR(255) UNIQUE NOT NULL,
    senha_hash VARCHAR(64)  NOT NULL,
    criado_em  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pre_cadastros_medida (
    id               SERIAL PRIMARY KEY,
    numero_processo  VARCHAR(50) NOT NULL UNIQUE,
    nome_vitima      VARCHAR(255),
    cpf_vitima       VARCHAR(14),
    nome_agressor    VARCHAR(255),
    cpf_agressor     VARCHAR(14),
    data_emissao     VARCHAR(10),
    vara             VARCHAR(255),
    ativada          BOOLEAN DEFAULT FALSE,
    criado_em        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vitimas (
    id              SERIAL PRIMARY KEY,
    nome            VARCHAR(255) NOT NULL,
    cpf             VARCHAR(14)  UNIQUE,
    data_nascimento VARCHAR(10),
    criado_em       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agressores (
    id        SERIAL PRIMARY KEY,
    nome      VARCHAR(255) NOT NULL,
    cpf       VARCHAR(14),
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medidas_protetivas (
    id               SERIAL PRIMARY KEY,
    numero_processo  VARCHAR(50) NOT NULL UNIQUE,
    vitima_id        INT REFERENCES vitimas(id)    ON DELETE CASCADE,
    agressor_id      INT REFERENCES agressores(id) ON DELETE CASCADE,
    data_emissao     VARCHAR(10),
    vara             VARCHAR(255),
    ativa            BOOLEAN DEFAULT TRUE,
    criado_em        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS presencas (
    id         SERIAL PRIMARY KEY,
    cpf        VARCHAR(14)  NOT NULL,
    nome       VARCHAR(255),
    tipo       VARCHAR(10)  CHECK (tipo IN ('vitima','agressor','outro')) DEFAULT 'outro',
    entrada_em TIMESTAMPTZ  DEFAULT NOW(),
    saida_em   TIMESTAMPTZ
);

-- Garante no máximo UMA presença ativa por CPF por vez
CREATE UNIQUE INDEX IF NOT EXISTS idx_presenca_ativa
    ON presencas(cpf) WHERE saida_em IS NULL;

CREATE TABLE IF NOT EXISTS usuarios_sistema (
    id         SERIAL PRIMARY KEY,
    usuario    VARCHAR(60)  UNIQUE NOT NULL,
    nome       VARCHAR(255) NOT NULL,
    senha_hash VARCHAR(64)  NOT NULL,
    role       VARCHAR(10)  CHECK (role IN ('admin','recepcao')) DEFAULT 'recepcao',
    ativo      BOOLEAN      DEFAULT TRUE,
    criado_em  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auditoria (
    id        SERIAL PRIMARY KEY,
    usuario   VARCHAR(60),
    acao      VARCHAR(60) NOT NULL,
    detalhe   TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alertas (
    id        SERIAL PRIMARY KEY,
    nivel     VARCHAR(20) NOT NULL,
    cpf       VARCHAR(14),
    nome      VARCHAR(255),
    mensagem  TEXT NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);
