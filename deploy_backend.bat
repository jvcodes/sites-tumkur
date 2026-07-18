@echo off
echo =======================================================
echo Deploying Django Backend to Google Cloud Run...
echo =======================================================

:: Move to the directory where this script is located (the project root)
cd /d "%~dp0"

:: We don't need to specify the secrets here because Google Cloud Run 
:: automatically remembers the secrets from your previous deployment!
gcloud run deploy sitehub-backend --source . --region us-central1 --allow-unauthenticated

echo.
echo Backend Deployment Finished!
pause
