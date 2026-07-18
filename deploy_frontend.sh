#!/bin/bash
# deploy_frontend.sh

# Move to the directory where this script is located
cd "$(dirname "$0")"

echo "======================================================="
echo "Deploying Next.js Frontend to Google Cloud Run..."
echo "======================================================="

BACKEND_URL="https://sitehub-backend-974580685297.us-central1.run.app"

gcloud run deploy sitehub-frontend --source ./frontend --region us-central1 --allow-unauthenticated --set-build-env-vars="NEXT_PUBLIC_BACKEND_URL=$BACKEND_URL" --set-env-vars="NEXT_PUBLIC_BACKEND_URL=$BACKEND_URL"

echo ""
echo "Frontend Deployment Finished!"
