@echo off
cd /d "%~dp0"
if not exist config.json (
  copy config.example.json config.json >nul
  echo Foi criado o config.json. Coloque a senha e feche o Bloco de Notas para continuar.
  notepad config.json
)
if not exist node_modules (
  echo Instalando pela primeira vez...
  call npm install
)
:rodar
node agente.js
echo O agente parou. Reiniciando em 10 segundos...
timeout /t 10 >nul
goto rodar
