@echo off
start "Accord360 Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn app.main:app --reload"
start "Accord360 Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 4 >nul
start http://localhost:5173
