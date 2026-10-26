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

---

# Planilha automática no PC específico (agente)

Cada registro enviado pelos celulares é acrescentado, em poucos segundos, numa planilha **.xlsx** que fica no PC escolhido.

## Instalação no PC (uma vez)
1. Instale o **Node.js (LTS)** em https://nodejs.org
2. Copie a pasta `agente` para o PC (ex.: `C:\Conferencia\agente`).
3. Edite o `config.json`:
   - `url`: endereço do app no Render
   - `senha`: a mesma `ADMIN_PASSWORD` do Render
   - `arquivo`: onde a planilha será criada (ex.: `C:\\Conferencia\\conferencia_sobras_faltas.xlsx`, com barras duplas)
4. Dê dois cliques em `iniciar.bat` (deixe a janela aberta).

Para iniciar junto com o Windows: `Win + R` → `shell:startup` → coloque um atalho do `iniciar.bat`.

## Regras
- Só o PC com o agente ligado grava na planilha; se ele estiver desligado, os registros ficam guardados no Neon e entram quando ligar.
- Se a planilha estiver **aberta no Excel**, o Windows bloqueia a gravação: os registros esperam e entram quando o arquivo for fechado.
- Registros não são duplicados (cada linha tem um ID na coluna F, oculta — não apague).
- Depois que o registro entrou na planilha, o celular não consegue mais excluí-lo; a exclusão passa a ser feita na planilha/central.
- O botão "Baixar planilha (CSV)" em `/central` continua disponível como cópia de segurança.

## GitHub
A pasta `agente` pode ficar no repositório. O `config.json` (com a senha) **não** vai para o GitHub (está no `.gitignore`); o repositório leva só o `config.example.json`. No PC, o `iniciar.bat` cria o `config.json` a partir do exemplo e abre o Bloco de Notas para você colocar a senha. Se subir pelo site do GitHub (arrastando arquivos), não envie o `config.json`.

## Instalar / criar atalho
- **Celulares:** ao abrir o site aparece o botão "Instalar app (criar atalho)" (Android/Chrome). No iPhone: Compartilhar → "Adicionar à Tela de Início".
- **PC do agente:** dê dois cliques em `agente\instalar.bat`. Ele cria o atalho na Área de Trabalho e na Inicialização do Windows.
