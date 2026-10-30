@echo off
rem Opens the website editor in your browser. Leave this window open while editing.
cd /d "%~dp0"
where python >nul 2>nul
if %errorlevel%==0 (python tools\editor.py) else (py tools\editor.py)
if errorlevel 1 pause
