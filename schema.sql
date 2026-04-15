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
