#!/bin/sh
set -eu
runtime="$HOME/.local/share/komorebi/laya-runtime"
python3 -m venv "$runtime"
"$runtime/bin/python" -m pip install 'laya==0.4.16'
echo 'Laya runtime installed. The multilingual checkpoint downloads on first use.'
