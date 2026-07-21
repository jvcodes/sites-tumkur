#!/bin/bash
# run_tests.sh
# Runs backend and frontend tests

echo -e "\e[36mRunning Backend API Tests...\e[0m"
python manage.py test api
BACKEND_STATUS=$?

if [ $BACKEND_STATUS -ne 0 ]; then
    echo -e "\e[31mBackend tests failed. Stopping.\e[0m"
    exit $BACKEND_STATUS
fi
echo -e "\e[32mBackend tests passed!\n\e[0m"

echo -e "\e[36mRunning Frontend Tests...\e[0m"
cd frontend || exit 1
npm run test:typecheck
TYPECHECK_STATUS=$?
if [ $TYPECHECK_STATUS -ne 0 ]; then
    echo -e "\e[31mFrontend typecheck failed.\e[0m"
    exit $TYPECHECK_STATUS
fi
npm run test:e2e
FRONTEND_STATUS=$?
cd ..

if [ $FRONTEND_STATUS -ne 0 ]; then
    echo -e "\e[31mFrontend tests failed.\e[0m"
    exit $FRONTEND_STATUS
fi

echo -e "\e[32mAll tests passed successfully!\e[0m"
exit 0
