🛡️ Safe Woman
Proteção inteligente para mulheres em tempo real

📌 Sobre o Projeto
O Safe Woman é um sistema baseado em Inteligência Artificial que utiliza visão computacional e reconhecimento de documentos para aumentar a segurança de mulheres em ambientes públicos, como eventos, bares e casas noturnas.

O sistema identifica automaticamente informações de documentos como CNH e medidas protetivas, cruzando dados em tempo real para detectar possíveis situações de risco entre vítimas e agressores.

🎯 Objetivo
Prevenir situações de violência, utilizando tecnologia para apoiar a aplicação da Lei Maria da Penha.

🧠 Tecnologias Utilizadas
Linguagem
Python 3.13 — linguagem principal do backend

Backend
FastAPI — framework web para criação da API REST Uvicorn — servidor ASGI para rodar a aplicação FastAPI Pydantic — validação de dados e modelos de requisição python-multipart — suporte a upload de arquivos (fotos de CNH e documentos)

Banco de Dados
PostgreSQL — banco de dados relacional para armazenar vítimas, agressores, medidas protetivas e presenças psycopg2 — biblioteca Python para conexão com o PostgreSQL Inteligência Artificial / OCR Google Cloud Vision API — serviço de OCR (reconhecimento óptico de caracteres) usado para extrair texto das fotos de CNH e Medidas Protetivas

Frontend
HTML5 — estrutura das páginas CSS3 — estilização (variáveis CSS, gradientes, flexbox, grid, animações) JavaScript (Vanilla ES6+) — lógica do cliente, consumo da API via fetch, manipulação do DOM

Arquitetura
SPA (Single Page Application) — a interface funciona como app de página única, sem recarregamento API REST — comunicação entre frontend e backend via JSON Autenticação por Token — painel admin protegido com tokens gerados via secrets do Python

⚙️ Como Funciona
📷 Captura da imagem do documento
🧠 Detecção dos campos (nome, CPF, etc.)
🔍 Extração de texto (OCR)
💾 Armazenamento no banco de dados
⚠️ Verificação de conflito (vítima x agressor)
🚨 Geração de alerta em tempo real
💡 Aplicações
Casas noturnas
Eventos
Segurança pública
Controle de acesso
🚧 Status
🚀 Em desenvolvimento (MVP para Projeto Integrador II)

🌍 Impacto Social
O Safe Woman transforma tecnologia em prevenção, criando ambientes mais seguros para mulheres antes que o risco aconteça.