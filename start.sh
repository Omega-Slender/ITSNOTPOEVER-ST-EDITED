#!/bin/bash
cd "$(dirname "$0")"
npm install --no-audit
node index.js
read -p "Press any key to continue . . ." -n1 -s
cd -