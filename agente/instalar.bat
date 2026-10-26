@echo off
cd /d "%~dp0"
echo Criando atalhos (Area de Trabalho e Inicializacao do Windows)...
powershell -NoProfile -Command "$s=New-Object -ComObject WScript.Shell; foreach($d in @([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('Startup'))){ $l=$s.CreateShortcut((Join-Path $d 'Agente Conferencia.lnk')); $l.TargetPath='%~dp0iniciar.bat'; $l.WorkingDirectory='%~dp0'; $l.WindowStyle=7; $l.Save() }"
echo.
echo Pronto! O agente vai abrir sozinho quando o Windows iniciar.
echo Para iniciar agora, use o atalho "Agente Conferencia" na Area de Trabalho.
pause
