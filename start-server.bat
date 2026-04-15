@echo off
echo Starte Entwicklungsserver auf http://localhost:3333
echo Tests: http://localhost:3333/tests/test_parser.html
echo Tests: http://localhost:3333/tests/test_abgleich.html
echo Strg+C zum Beenden
python -m http.server 3333 --directory "%~dp0"
pause
