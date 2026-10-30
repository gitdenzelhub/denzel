@echo off
rem Reads the follower count from Instagram, updates the site and publishes it.
cd /d "%~dp0"
where python >nul 2>nul
if %errorlevel%==0 (python tools\update_followers.py) else (py tools\update_followers.py)
pause
