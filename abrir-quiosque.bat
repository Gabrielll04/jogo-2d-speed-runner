@echo off
REM ===========================================================================
REM  STARDUST RUNNER - abre o jogo em modo fliperama (Windows)
REM
REM  A flag --autoplay-policy=no-user-gesture-required e o que faz a musica
REM  tocar sozinha no attract. Sem ela o navegador segura o audio ate alguem
REM  apertar uma tecla, e a maquina fica muda esperando - que e justamente o
REM  contrario do que um fliperama tem que fazer.
REM
REM  Rode o server.js antes, numa outra janela:  node server.js
REM ===========================================================================

set ENDERECO=http://localhost:3000/
if not "%~1"=="" set ENDERECO=%~1

set FLAGS=--kiosk --autoplay-policy=no-user-gesture-required --disable-features=Translate --noerrdialogs --disable-session-crashed-bubble

set CHROME="%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist %CHROME% goto abrir
set CHROME="%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist %CHROME% goto abrir
set CHROME="%LocalAppData%\Google\Chrome\Application\chrome.exe"
if exist %CHROME% goto abrir

echo Chrome nao encontrado, tentando o Edge...
set CHROME="%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if exist %CHROME% goto abrir
set CHROME="%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if exist %CHROME% goto abrir

echo.
echo Nenhum navegador encontrado nos caminhos padrao.
echo Abra o Chrome na mao com:
echo    chrome.exe --kiosk --autoplay-policy=no-user-gesture-required %ENDERECO%
echo.
pause
exit /b 1

:abrir
echo Abrindo %ENDERECO% em modo fliperama...
start "" %CHROME% %FLAGS% %ENDERECO%
