@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando pela primeira vez...
  call npm install
)
:rodar
node agente.js
echo O agente parou. Reiniciando em 10 segundos...
timeout /t 10 >nul
goto rodar
