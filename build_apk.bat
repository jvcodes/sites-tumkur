@echo off
setlocal

echo ========================================================
echo Building TumkurSites Native Android App (Debug APK)
echo ========================================================

REM Set JAVA_HOME from Android Studio if not already set
if not defined JAVA_HOME (
    if exist "C:\Program Files\Android\Android Studio\jbr" (
        set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
    )
)

REM Set ANDROID_HOME if not already set
if not defined ANDROID_HOME (
    if exist "%LOCALAPPDATA%\Android\Sdk" (
        set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
    )
)

echo Using JAVA_HOME: %JAVA_HOME%
echo Using ANDROID_HOME: %ANDROID_HOME%

cd /d "%~dp0frontend"

echo.
echo [1/2] Syncing Capacitor plugins and assets...
call npx cap sync android
if %errorlevel% neq 0 (
    echo Error during Capacitor sync!
    pause
    exit /b %errorlevel%
)

echo.
echo [2/2] Compiling Android APK with Gradle...
cd android
call gradlew.bat assembleDebug
if %errorlevel% neq 0 (
    echo Error during Gradle build!
    pause
    exit /b %errorlevel%
)

echo.
echo ========================================================
echo SUCCESS: APK built successfully!
copy /y app\build\outputs\apk\debug\app-debug.apk "..\..\TumkurSites.apk" >nul
echo Output: TumkurSites.apk (in project root)
echo Full Path: frontend\android\app\build\outputs\apk\debug\app-debug.apk
echo ========================================================
echo.
pause
