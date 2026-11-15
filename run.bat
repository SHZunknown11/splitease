@echo off
rem Starts the API and the web app in two windows. Run "npm install" in server and client first.
start "SplitEase API" cmd /k "cd /d %~dp0server && npm start"
start "SplitEase web" cmd /k "cd /d %~dp0client && npm run dev"
echo Open http://localhost:5173 in your browser.
