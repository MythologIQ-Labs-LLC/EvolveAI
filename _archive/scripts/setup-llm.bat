@echo off
set INSTALL_PATH=%1

:: Install Ollama
if not exist "%INSTALL_PATH%\ollama" (
  curl -L https://ollama.com/download/win -o ollama.exe
  move ollama.exe "%INSTALL_PATH%\ollama.exe"
)

:: Install Docker Desktop silently
start /wait docker-desktop-installer.exe install --quiet

:: Launch Supabase Docker
docker compose -f "%INSTALL_PATH%\supabase\docker-compose.yml" up -d

:: Init DB
psql -h localhost -U postgres -p 54321 -f "%INSTALL_PATH%\schema.sql"
