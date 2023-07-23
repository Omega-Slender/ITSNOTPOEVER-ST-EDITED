pushd %~dp0
call npm install --no-audit
node index.js
pause
popd
