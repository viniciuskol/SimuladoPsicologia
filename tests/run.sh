#!/bin/sh
# Roda toda a bateria: tests/run.sh
# Os módulos de study/shared/ são .js de navegador. O script os copia como .mjs para um
# diretório temporário, junto com os testes, e roda lá: nada é gravado no projeto.
set -eu
root="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

for f in "$root"/study/shared/*.js; do
  cp "$f" "$tmp/$(basename "$f" .js).mjs"
done
cp "$root"/tests/*.mjs "$tmp/"

cd "$tmp"
STUDY_DATA="$root/study/data" TZ=America/Sao_Paulo node --test ./*.test.mjs
