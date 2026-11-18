---
name: correlation-id
description: Rastrea un correlationId del Portal del Estudiante en los logs del BFF desplegado en Railway y explica por qué falló el pedido (BFF, Gateway de CORE o módulo externo). Usar cuando la persona pasa un "código para reportar", un correlationId o un UUID que vio en un error de la pantalla.
---

# Rastrear un correlationId

El "Código para reportar" de las pantallas de error es el `X-Correlation-Id` del pedido.
El BFF lo usa como `req.id` en cada línea de log (`nestjs-pino`), así que con él se
reconstruye todo lo que pasó en ese pedido.

## Dónde buscar

Se busca en el BFF desplegado en Railway. En local, primero confirmar que no hay nada
corriendo (`docker compose ps`, procesos de node); si el error es local, los logs están en
la terminal del BFF o en `docker compose logs bff`.

| Dato | Valor |
| --- | --- |
| Proyecto de Railway | `uadenet-alumnos` (`722b9287-a068-4f46-b22e-d49152231e75`) |
| Ambiente | `production` (`3600e0f4-285d-4b2f-b466-a1f8799092e1`) |
| Servicio `bff` | `18c65504-348c-43ad-942f-fe7a634be06b` |
| Servicio `web` (nginx del front) | `fd8a0119-1b82-427c-a8f6-a57825662424` |

Si los ids no responden, volver a buscarlos con `list-projects` y `list-services` del MCP
de Railway.

## Pasos

1. **Traer los logs del BFF.** `get-logs` con `serviceId` del `bff`. El `filter` de Railway
   busca en el mensaje, no dentro de los atributos: filtrar por el id suele devolver vacío.
   Dos formas que funcionan:
   - `filter: "\"Respuesta de error del Gateway\""` trae directo lo que respondió CORE.
   - Sin filtro, con `limit` alto y, si hace falta, `startDate`/`endDate` alrededor de la
     hora del error. La salida es grande y se guarda en un archivo: procesarla con `jq`.

   ```bash
   jq -r '.deploy[] | select(tostring|test("<ID>")) | "== " + .timestamp[11:19] + " " + .message + "\n" + ([.attributes[] | select(.key|IN("req","pid","hostname","time","level")|not) | .key + "=" + .value] | join("\n"))' <archivo>
   ```

2. **Reconstruir la secuencia.** En orden: el pedido que recibió el BFF (`req.url`), cada
   llamada al Gateway (`context=GatewayClient`, con `modulo`, `url`, `ms`), la respuesta de
   error del Gateway (`status` y `cuerpo`) y cómo lo tradujo el BFF (`ProblemaFilter`,
   `code` final, `res.statusCode`).

3. **Si no aparece la línea `Respuesta de error del Gateway`,** revisar qué commit está
   desplegado (`list-deployments` del `bff`, campo `meta.commitHash`) y compararlo con
   `git log`. Esa línea es de nivel `debug`: necesita `LOG_LEVEL=debug` en Railway y un
   deploy que incluya el commit que la agrega.

4. **Interpretar** con la tabla de abajo y responder con: qué pantalla y qué pedido, qué
   módulo falló, qué dijo CORE, de quién es el problema y qué hacer.

5. **Si el problema es de CORE o de otro módulo,** dejar listo un mensaje corto para
   mandarles, con la ruta del Gateway, el código de CORE y los correlationIds (incluido el
   primero que falló, no solo el que pasó la persona). No mandarlo: lo manda la persona.

## Cómo leer los errores

Lo que devuelve el Gateway (campo `code` del `cuerpo`):

| `code` de CORE | Status | Qué significa |
| --- | --- | --- |
| `GATEWAY_UPSTREAM_FAILURE` | 502 | El Gateway no pudo conectarse al módulo (caído o URL mal cargada en CORE, p. ej. `DINING_SERVICE_URL`) |
| `GATEWAY_CIRCUIT_OPEN` | 503 | Después de varias fallas, CORE dejó de intentar con ese módulo por un rato y responde al instante. Buscar el primer 502 para saber la causa |
| `UPSTREAM_UNAVAILABLE` | 503 | Módulo caído |
| — | 504 | El módulo tardó más de 10 s |
| `HTTP_401` | 401 | Token ausente o inválido |
| `HTTP_429` (sin confirmar) | 429 | Límite de 100 pedidos por minuto por IP; todo el BFF sale de una sola IP |

Cómo lo traduce el BFF (`apps/bff/src/gateway/gateway.client.ts`): 503 y fallas de
conexión → `UPSTREAM_UNAVAILABLE`; 502 o cuerpo que no es JSON → `UPSTREAM_INVALID`;
504 o timeout propio (`GATEWAY_TIMEOUT_MS`) → timeout; 401 → `AUTH_TOKEN_INVALID`.

Errores propios del BFF, sin llamada al Gateway:

- `GATEWAY_SIGNATURE_INVALID` (403): el pedido no trae una `X-Core-Signature` válida.
  Revisar `CORE_SIGNATURE_SECRET` en Railway contra el que usa CORE, y que el
  `x-core-timestamp` no tenga más de 5 minutos.
- Errores de JWT: revisar `JWKS_URL`, `JWT_ISSUER` (sin `/` final) y `JWT_AUDIENCE`.

Reglas del dominio que explican respuestas que parecen errores:

- **Calendario:** responde 200 si al menos una categoría pedida cargó, e informa las que
  fallaron en `fuentes`. Si el filtro tiene una sola categoría y falla, es 503.
- **Comedor sin `lugar`:** Backoffice (`/sites`) no respondió. No marca la categoría con error.
- **Detalle de cursada:** si el Módulo 2 no responde, sale con `asistencia` y `notas` en
  null y el módulo en `fuentesConError`.
- **Ficha de Backoffice** (`/users/{id}`): si falla, el perfil sale incompleto.

## Límites

- Solo lectura: no cambiar variables, no redesplegar ni reiniciar servicios sin preguntar.
- Los logs traen headers del alumno (`x-user-id`, permisos): no copiarlos en mensajes para
  otros grupos más allá del correlationId.
