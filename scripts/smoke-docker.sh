#!/usr/bin/env bash
# Smoke test del stack de docker compose. Supone que ya está levantado
# (docker compose up -d --build). Lo corre el CI y se puede correr a mano.
set -euo pipefail

GATEWAY=http://localhost:4000
fallas=0

ok() { echo "  ✔ $1"; }
falla() { echo "  ✘ $1"; fallas=$((fallas + 1)); }

esperar() {
  local url=$1
  shift
  for _ in $(seq 1 60); do
    curl -s -o /dev/null "$@" "$url" 2>/dev/null && return 0
    sleep 2
  done
  echo "No respondió a tiempo: $url"
  docker compose ps -a
  docker compose logs --tail=50
  exit 1
}

echo "Esperando a los servicios…"
esperar "$GATEWAY/health/live"
esperar "$GATEWAY/api/v1/student/health/live"
esperar http://localhost:5173/
esperar http://localhost:4010/me -H 'Authorization: Bearer x'

echo "Chequeos:"

[[ $(curl -s "$GATEWAY/api/v1/student/health/live") == '{"status":"ok"}' ]] &&
  ok "Gateway → BFF (health)" || falla "Gateway → BFF (health)"

token=$(curl -s "$GATEWAY/api/v1/auth/login" -H 'content-type: application/json' \
  -d '{"email":"v.moreno@uade.edu.ar","password":"uade2026"}' |
  sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
[[ -n $token ]] && ok "Login contra el CORE falso" || falla "Login contra el CORE falso"

[[ $(curl -s -o /dev/null -w '%{http_code}' "$GATEWAY/api/v1/student/me" -H 'Authorization: Bearer x') == 401 ]] &&
  ok "El Gateway rechaza un token inválido" || falla "El Gateway rechaza un token inválido"

[[ $(docker compose exec -T bff wget -qO- http://core-falso:4000/.well-known/jwks.json) == *'"kty":"RSA"'* ]] &&
  ok "El BFF alcanza el JWKS" || falla "El BFF alcanza el JWKS"

[[ $(curl -s http://localhost:3000/docs-json) == *'"/calendario"'* ]] &&
  ok "Swagger del BFF desde openapi.yaml" || falla "Swagger del BFF desde openapi.yaml"

[[ $(curl -s http://localhost:5173/calendario) == *'<div id="root">'* ]] &&
  ok "Front (nginx resuelve rutas de la SPA)" || falla "Front (nginx resuelve rutas de la SPA)"

[[ $(curl -s http://localhost:4010/me -H 'Authorization: Bearer x') == *'"alumno-456"'* ]] &&
  ok "Prism devuelve los ejemplos del contrato" || falla "Prism devuelve los ejemplos del contrato"

if ((fallas > 0)); then
  echo "$fallas chequeo(s) fallaron"
  docker compose logs --tail=50
  exit 1
fi
echo "Todo OK"
