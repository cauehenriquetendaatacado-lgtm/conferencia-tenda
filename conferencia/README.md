# Conferência de Sobras e Faltas — Render + Neon

## 1. Neon (banco)
1. Crie um projeto em https://neon.tech
2. Copie a **connection string** (Dashboard → Connect), algo como
   `postgresql://usuario:senha@ep-xxx.neon.tech/neondb?sslmode=require`
3. Não precisa criar tabela: o app cria sozinho na primeira execução.

## 2. GitHub
Suba esta pasta para um repositório (o `.gitignore` já exclui `node_modules` e `.env`).

## 3. Render
1. New → **Web Service** → conecte o repositório (ou New → Blueprint, que lê o `render.yaml`).
2. Build: `npm install` · Start: `npm start`
3. Em **Environment**, crie:
   - `DATABASE_URL` = connection string do Neon
   - `ADMIN_PASSWORD` = senha do PC da central

## Endereços
- `https://SEU-APP.onrender.com/` → quem faz a conferência (celular)
- `https://SEU-APP.onrender.com/central` → **PC específico**: pede senha (usuário: qualquer; senha: `ADMIN_PASSWORD`), mostra todos os registros de todas as pessoas, filtra por data/loja, baixa o CSV e atualiza sozinho a cada 30 s.

## Teste local (opcional)
```
npm install
DATABASE_URL="..." ADMIN_PASSWORD="minhasenha" npm start
```
