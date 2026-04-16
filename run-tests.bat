@echo off
setlocal

echo [1/2] HTML-Testseiten
node tests\run-html-tests.mjs
if errorlevel 1 exit /b %errorlevel%

echo.
echo [2/2] Node-Regressionen
node tests\review-regression.mjs
if errorlevel 1 exit /b %errorlevel%

echo.
echo Alle Tests erfolgreich.
