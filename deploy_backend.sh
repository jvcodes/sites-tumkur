#!/bin/bash
# deploy_backend.sh

# Move to the directory where this script is located
cd "$(dirname "$0")"

echo "======================================================="
echo "Deploying Django Backend to Google Cloud Run..."
echo "======================================================="

gcloud run deploy sitehub-backend --source . --region us-central1 --allow-unauthenticated

echo ""
echo "Backend Deployment Finished!"
