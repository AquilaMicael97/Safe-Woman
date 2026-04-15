# 🛡️ Safe Woman  
**Proteção inteligente para mulheres em tempo real**

---

## 📌 Sobre o Projeto

O **Safe Woman** é um sistema baseado em Inteligência Artificial que utiliza visão computacional e reconhecimento de documentos para aumentar a segurança de mulheres em ambientes públicos, como eventos, bares e casas noturnas.

O sistema identifica automaticamente informações de documentos como CNH e medidas protetivas, cruzando dados em tempo real para detectar possíveis situações de risco entre vítimas e agressores.

---

## 🎯 Objetivo

Prevenir situações de violência, utilizando tecnologia para apoiar a aplicação da **Lei Maria da Penha**.

---

## 🧠 Tecnologias Utilizadas

### 💻 Linguagem
- Python 3.13

### ⚙️ Backend
- FastAPI — criação da API REST  
- Uvicorn — servidor ASGI  
- Pydantic — validação de dados  
- python-multipart — upload de arquivos  

### 🗄️ Banco de Dados
- PostgreSQL — armazenamento dos dados  
- psycopg2 — conexão com o banco  

### 🤖 Inteligência Artificial / OCR
- Google Cloud Vision API — extração de texto (OCR)  

### 🌐 Frontend
- HTML5  
- CSS3 (Flexbox, Grid, animações)  
- JavaScript (ES6+ / fetch API)  

### 🏗️ Arquitetura
- SPA (Single Page Application)  
- API REST (JSON)  
- Autenticação por Token (admin)  

---

## ⚙️ Como Funciona

1. 📷 Captura da imagem do documento  
2. 🧠 Detecção dos campos (nome, CPF, etc.)  
3. 🔍 Extração de texto (OCR)  
4. 💾 Armazenamento no banco de dados  
5. ⚠️ Verificação de conflito (vítima x agressor)  
6. 🚨 Geração de alerta em tempo real  

---

## 💡 Aplicações

- Casas noturnas  
- Eventos  
- Segurança pública  
- Controle de acesso  

---

## 🚧 Status

🚀 Em desenvolvimento (MVP para Projeto Integrador II)

---

## 🌍 Impacto Social

O **Safe Woman** transforma tecnologia em prevenção, criando ambientes mais seguros para mulheres antes que o risco aconteça.

---

## 🔐 Configuração

⚠️ Este projeto utiliza credenciais externas (API OCR).

Crie um arquivo `.env` ou utilize variáveis de ambiente com suas chaves:

```env
GOOGLE_APPLICATION_CREDENTIALS=./chave.json