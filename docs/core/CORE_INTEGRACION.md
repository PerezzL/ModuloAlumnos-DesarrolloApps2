# CORE — Contrato de integración para los módulos de UADEnet

**Trabajo Práctico Obligatorio — Desarrollo de Aplicaciones II — 2.º cuatrimestre 2026**
**Versión del contrato:** `v1` · **Fecha:** 2026-08-05 · **Estado:** vigente para las tres entregas

Este documento es lo único que necesitás leer para integrar tu módulo con CORE. Contiene todas las firmas: endpoints, headers, bodies, respuestas, códigos de error y eventos. El diseño completo y su justificación están en `CORE_SPEC.md`; acá está sólo lo que se usa.

**Regla de compatibilidad:** dentro de `v1` podemos agregar campos opcionales, nunca renombrar ni cambiar la semántica de uno existente. Cualquier cambio incompatible crea `v2` y se avisa con al menos una semana de anticipación. Si algo de este documento te bloquea, escribinos antes de improvisar una solución local.

---

## Índice

1. [Lo mínimo que tenés que saber](#1-lo-mínimo-que-tenés-que-saber)
2. [Convenciones comunes](#2-convenciones-comunes)
3. [Autenticación de usuarios](#3-autenticación-de-usuarios)
4. [Autenticación de tu servicio](#4-autenticación-de-tu-servicio)
5. [Cómo recibís la identidad del usuario](#5-cómo-recibís-la-identidad-del-usuario)
6. [Gateway: cómo se llega a tu módulo](#6-gateway-cómo-se-llega-a-tu-módulo)
7. [Saldo: cobrar, acreditar y devolver](#7-saldo-cobrar-acreditar-y-devolver)
8. [Notificaciones](#8-notificaciones)
9. [Eventos: publicar](#9-eventos-publicar)
10. [Eventos: consumir](#10-eventos-consumir)
11. [Catálogo de eventos](#11-catálogo-de-eventos)
12. [Checklist por módulo](#12-checklist-por-módulo)
13. [Errores y cómo reaccionar](#13-errores-y-cómo-reaccionar)
14. [Checklist de integración](#14-checklist-de-integración)

---

## 1. Lo mínimo que tenés que saber

Cinco reglas que resuelven el 90 % de las dudas:

1. **El `userId` lo genera Backoffice.** Es un UUID v4 y es la clave con la que todos referenciamos personas. No inventes tu propio id de usuario ni referencies gente por email o legajo.
2. **Tu portal nunca llama a tu backend directo.** Todo entra por el gateway de CORE: `https://core/api/v1/{tu-modulo}/...`.
3. **Tu backend nunca llama a CORE con el token del usuario.** Para `/internal/v1/*` usás tu propio token de servicio.
4. **Todo lo que mueve plata necesita `Idempotency-Key` y una `externalReference` estable.** Si no la mandás, vas a cobrar dos veces.
5. **Si consumís RabbitMQ, implementá deduplicación por `eventId`.** El broker puede reentregarte el mismo mensaje.

---

## 2. Convenciones comunes

| Tema | Regla |
|---|---|
| Base URL pública | `/api/v1/...` — la usan los portales con el token del usuario |
| Base URL interna | `/internal/v1/...` — la usa tu backend con token de servicio; no se expone a Internet |
| Formato | JSON UTF-8, claves en `camelCase` |
| IDs | UUID v4 como string |
| Fechas | ISO 8601 en UTC: `2026-08-05T18:25:43.511Z` |
| Dinero | String decimal con dos decimales + moneda aparte: `{ "amount": "1250.00", "currency": "ARS" }`. **Nunca float.** |
| Paginación | `?cursor=<opaco>&limit=20`, máximo 100. Respuesta: `{ "items": [], "nextCursor": null }` |
| Swagger | `GET /docs` · OpenAPI JSON en `/docs-json` |

### Headers

| Header | Cuándo | Detalle |
|---|---|---|
| `Authorization: Bearer <jwt>` | Siempre, salvo login, refresh, health y JWKS | Token de usuario o de servicio según el caso |
| `X-Correlation-Id` | Siempre que puedas | Si no lo mandás, CORE lo genera. **Propagalo en todas tus llamadas y eventos**: es lo que nos permite reconstruir una operación completa cuando algo falla |
| `Idempotency-Key` | Obligatorio en escrituras financieras y publicación de eventos | UUID v4 que generás vos, uno por intento lógico. Los reintentos del *mismo* intento repiten la key |
| `X-Service-Name` | En llamadas de servicio | Debe coincidir con tu token |

---

## 3. Autenticación de usuarios

Lo consume el frontend de tu portal. No implementes login propio.

> **Nota:** para el TP no hay SSO institucional (no tenemos credenciales del IdP de la universidad). El login es email + contraseña contra la ficha que provee Backoffice.

### `POST /api/v1/auth/login`

```json
{ "email": "jperez@uade.edu.ar", "password": "..." }
```

`200`:

```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6...",
  "expiresIn": 900,
  "user": {
    "id": "ba310c57-a684-4dbf-a4a4-905fcfbefa08",
    "email": "jperez@uade.edu.ar",
    "roles": ["STUDENT"],
    "permissions": ["wallet:read:self", "wallet:credit:self"],
    "status": "ACTIVE"
  }
}
```

Además setea el refresh token en una cookie `HttpOnly`, `Secure`, `SameSite=Lax`. **El frontend no ve ni guarda el refresh token**; el access token va en memoria, nunca en `localStorage`.

Errores: `401 AUTH_INVALID_CREDENTIALS` (genérico a propósito, no decimos si falló el email o la contraseña), `403 AUTH_IDENTITY_SUSPENDED`, `429 RATE_LIMITED`.

### Resto de la API de auth

| Método y ruta | Request | Respuesta |
|---|---|---|
| `POST /api/v1/auth/refresh` | cookie de refresh | `200 { accessToken, expiresIn }` + cookie rotada |
| `POST /api/v1/auth/logout` | Bearer o cookie | `204` |
| `GET /api/v1/auth/me` | Bearer | `200 { id, email, roles, permissions, status }` |
| `POST /api/v1/auth/activate` | `{ token, password }` | `204` |
| `POST /api/v1/auth/password/forgot` | `{ email }` | `202` siempre |
| `POST /api/v1/auth/password/reset` | `{ token, password }` | `204` |

El refresh token **rota en cada uso**: el anterior queda inválido de inmediato. Si tu portal dispara varios refresh en paralelo, vas a invalidarte la sesión sola — serializá esa llamada.

`GET /auth/me` devuelve datos de autorización, **no es un directorio de personas**. Si necesitás nombre, apellido, legajo o carrera para mostrar en pantalla, pedíselos a Backoffice o proyectalos desde `backoffice.user.upserted.v1`.

---

## 4. Autenticación de tu servicio

Para todo lo que sea backend-a-backend con CORE (`/internal/v1/*`) necesitás un token de servicio. Cada módulo tiene su `clientId` y `clientSecret` propios: **no hay una API key global compartida**. Pedínos las credenciales y guardalas como variable de entorno o secreto, nunca en Git.

### `POST /internal/v1/service-auth/token`

```json
{ "clientId": "library-service", "clientSecret": "..." }
```

`200`:

```json
{ "accessToken": "eyJ...", "expiresIn": 900, "tokenType": "Bearer" }
```

El token trae `sub=service:library`, `service=library` y tus scopes. Cacheálo hasta poco antes de `exp`; no pidas uno nuevo en cada request.

**No uses el token del usuario para llamar a `/internal/v1/*` y no uses tu token de servicio para operar en nombre de un usuario.** Son dos identidades distintas y el gateway las trata distinto.

### Validar tokens de usuario en tu módulo

El gateway ya validó el token antes de llegar a vos, pero **validalo igual** (defensa en profundidad):

1. Descargá las claves públicas de `GET /.well-known/jwks.json` y cacheálas.
2. Verificá firma RS256, `iss`, `aud` y `exp` **localmente**. No llames a CORE por cada request.
3. Refrescá el JWKS sólo si aparece un `kid` que no conocés.

Claims disponibles: `iss`, `aud`, `sub` (el `userId`), `sid`, `email`, `roles`, `permissions`, `iat`, `exp`, `jti`.

Existe `POST /internal/v1/auth/introspect` con body `{ "token": "..." }` que devuelve `{ active, sub?, roles?, permissions?, exp? }`, pero **es sólo para operaciones sensibles o irreversibles** donde no podés tolerar la ventana de 15 minutos del access token. Si lo llamás en cada request, todo el sistema pasa a depender de la latencia de CORE.

---

## 5. Cómo recibís la identidad del usuario

Cuando un request llega a tu módulo por el gateway, ya viene con la identidad verificada en headers:

| Header | Contenido |
|---|---|
| `X-User-Id` | UUID del usuario autenticado |
| `X-User-Roles` | Lista separada por comas: `STUDENT,LIBRARIAN` |
| `X-User-Permissions` | Lista separada por comas |
| `X-Correlation-Id` | UUID a propagar |

Dos advertencias importantes:

- El gateway **borra** cualquier header `X-User-*` que venga de afuera antes de inyectar los suyos, así que nadie los puede falsificar desde Internet.
- Aun así, **tu módulo no debe ser accesible directamente desde fuera de la red interna**. Si lo fuera, cualquiera podría mandarte un `X-User-Id` arbitrario. Por eso validás también el JWT.

**Nunca confíes en un `userId` que venga en el body o el query string.** La identidad sale del token o de `X-User-Id`, nunca de lo que mande el cliente.

---

## 6. Gateway: cómo se llega a tu módulo

| Tu módulo | Prefijo externo | Variable de entorno | Se reescribe a |
|---|---|---|---|
| Portal del Estudiante | `/api/v1/student/*` | `STUDENT_SERVICE_URL` | `/api/v1/*` |
| Portal del Docente | `/api/v1/teacher/*` | `TEACHER_SERVICE_URL` | `/api/v1/*` |
| Biblioteca | `/api/v1/library/*` | `LIBRARY_SERVICE_URL` | `/api/v1/*` |
| Comedor | `/api/v1/dining/*` | `DINING_SERVICE_URL` | `/api/v1/*` |
| Tienda | `/api/v1/store/*` | `STORE_SERVICE_URL` | `/api/v1/*` |
| Eventos | `/api/v1/events/*` | `EVENTS_SERVICE_URL` | `/api/v1/*` |
| Analítica | `/api/v1/analytics/*` | `ANALYTICS_SERVICE_URL` | `/api/v1/*` |
| Backoffice | `/api/v1/backoffice/*` | `BACKOFFICE_SERVICE_URL` | `/api/v1/*` |
| Gestión Académica | `/api/v1/academic/*` | `ACADEMIC_SERVICE_URL` | `/api/v1/*` |

Ejemplo: el portal pide `GET https://core/api/v1/library/books?q=algoritmos` y tu backend recibe `GET /api/v1/books?q=algoritmos`.

Qué garantiza el gateway:

- **No transforma tu respuesta.** Path, query, body y status code pasan tal cual.
- **Timeout de 10 s** por defecto. Si un endpoint tuyo necesita más (carga de archivos, reportes), avisanos y lo configuramos.
- **No reintenta** `POST`, `PATCH` ni `DELETE`. Sí puede reintentar una vez un `GET`/`HEAD` que falle por conexión.
- Si tu módulo está caído devuelve `503 UPSTREAM_UNAVAILABLE`; si responde algo inválido, `502`; si se pasa del timeout, `504`.

Qué esperamos de vos:

- Devolvé errores en `application/problem+json` con la misma forma de la sección 13. Como no transformamos respuestas, la consistencia del sistema depende de que todos usemos el mismo formato.
- Exponé `GET /health/live` y `GET /health/ready`.
- Propagá `X-Correlation-Id` en tus logs y en cualquier llamada que hagas.

---

## 7. Saldo: cobrar, acreditar y devolver

Esta es la parte donde un error cuesta plata, así que leela entera.

### 7.1 Conceptos base

- Cada usuario tiene **una wallet en ARS**. El saldo **nunca puede quedar negativo**.
- No existe forma de "setear" un saldo. Todo movimiento es un `CREDIT`, un `DEBIT` o un `REVERSAL`.
- Cada transacción lleva un `concept` obligatorio que dice *por qué* se movió la plata. Es lo que le permite a Analítica armar el dashboard financiero.

| `concept` | `type` | Quién lo usa |
|---|---|---|
| `TOP_UP` | `CREDIT` | CORE (carga desde el portal) |
| `PAYROLL` | `CREDIT` | Backoffice (sueldos) |
| `SCHOLARSHIP` | `CREDIT` | Backoffice (becas) |
| `ADJUSTMENT` | `CREDIT`/`DEBIT` | Backoffice (corrección auditada) |
| `LIBRARY_FINE` | `DEBIT` | Biblioteca |
| `DINING_RESERVATION` | `DEBIT` | Comedor |
| `STORE_PURCHASE` | `DEBIT` | Tienda |
| `EVENT_REGISTRATION` | `DEBIT` | Eventos |
| `REFUND` | `REVERSAL` | El módulo que cobró |

### 7.2 Las dos claves que te protegen del doble cobro

Son distintas y necesitás las dos:

**`Idempotency-Key`** (header) — protege contra el reintento de la misma llamada HTTP. Si tu request se cortó por timeout y no sabés si llegó, reintentá con **la misma key**: si ya se procesó, te devolvemos la respuesta original sin cobrar de nuevo.

**`externalReference`** (body) — protege contra cobrar dos veces el mismo hecho de negocio, aunque sea desde llamadas totalmente distintas. Es un string estable derivado de tu entidad:

| Módulo | Formato |
|---|---|
| Biblioteca | `penalty/{penaltyId}` |
| Comedor | `reservation/{reservationId}` |
| Tienda | `purchase/{purchaseId}` |
| Eventos | `registration/{registrationId}` |
| Backoffice (sueldo) | `payroll/{periodo}/user/{userId}` |

**Nunca uses un timestamp, un random o un contador local como `externalReference`.** Tiene que ser derivable de tu entidad, para que si reintentás dentro de una semana produzca exactamente el mismo string.

### 7.3 Cobrar

```http
POST /internal/v1/wallets/{userId}/debits
Authorization: Bearer <service-token>
Idempotency-Key: d707d34d-724f-43d7-a0a4-a6ac3930a601
X-Correlation-Id: f501201b-00bc-4200-99e0-6883500854f1
Content-Type: application/json

{
  "amount": "3500.00",
  "currency": "ARS",
  "concept": "STORE_PURCHASE",
  "sourceModule": "store",
  "externalReference": "purchase/93b28f67-e111-4a0d-b857-fdd015c4d3f1",
  "description": "Compra en Tienda del Campus",
  "metadata": { "purchaseId": "93b28f67-e111-4a0d-b857-fdd015c4d3f1" }
}
```

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `amount` | string decimal | sí | > 0, dos decimales |
| `currency` | string | sí | `ARS` |
| `concept` | enum | sí | Del catálogo de 7.1, coherente con tu módulo |
| `sourceModule` | string | sí | Debe coincidir con tu token de servicio |
| `externalReference` | string | sí | Estable y derivable de tu entidad |
| `description` | string | no | Se muestra al usuario en sus movimientos |
| `metadata` | object | no | Lo que necesites para reconciliar |

`201`:

```json
{
  "transactionId": "386865f7-c8aa-4aba-a374-ec9e6f8a6300",
  "status": "POSTED",
  "type": "DEBIT",
  "concept": "STORE_PURCHASE",
  "amount": "3500.00",
  "currency": "ARS",
  "balanceAfter": "12750.00",
  "externalReference": "purchase/93b28f67-e111-4a0d-b857-fdd015c4d3f1",
  "createdAt": "2026-08-05T18:25:43.511Z"
}
```

**Guardá el `transactionId` junto a tu entidad.** Lo vas a necesitar para revertir y para reconciliar.

Errores:

| Código | Qué significa | Qué hacés |
|---|---|---|
| `422 WALLET_INSUFFICIENT_FUNDS` | No hay saldo | No reintentar. Es una respuesta de negocio válida: informá al usuario |
| `409 DUPLICATE_REFERENCE` | Ya cobraste ese hecho | **No reintentes con otra referencia.** La respuesta trae el `transactionId` existente: adoptalo |
| `409 IDEMPOTENCY_CONFLICT` | Misma key, body distinto | Bug tuyo: estás reusando una key para otra operación |
| `403 FORBIDDEN` | `sourceModule` no coincide con tu token | No podés cobrar en nombre de otro módulo |
| `404 WALLET_NOT_FOUND` | El `userId` no existe en CORE | Verificá que Backoffice haya provisionado la identidad |

### 7.4 Acreditar

Sólo Backoffice y finanzas. Mismo formato, `concept` de tipo crédito:

```http
POST /internal/v1/wallets/{userId}/credits
Idempotency-Key: 6b0f4a11-2c33-4a58-9f0b-77b21c3e5a90

{
  "amount": "480000.00",
  "currency": "ARS",
  "concept": "PAYROLL",
  "sourceModule": "backoffice",
  "externalReference": "payroll/2026-08/user/ba310c57-a684-4dbf-a4a4-905fcfbefa08",
  "description": "Liquidación de sueldo agosto 2026",
  "metadata": { "period": "2026-08" }
}
```

`201` con la misma forma que el débito, `type: "CREDIT"`. Un crédito no falla por saldo.

### 7.5 Devolver

```http
POST /internal/v1/wallet-transactions/{transactionId}/reversals
Idempotency-Key: b1d9e5c0-7f42-4b8e-a0d1-3c9e77f24b6a

{
  "reason": "Usuario se presentó a la reserva"
}
```

| Campo | Obligatorio | Notas |
|---|---|---|
| `reason` | sí | Queda en auditoría |
| `amount` | **no** | Si lo omitís se revierte el total. Recomendado omitirlo |
| `externalReference` | no | Sólo para reversas parciales múltiples |
| `metadata` | no | — |

`201`:

```json
{
  "transactionId": "0c3b6d21-9a44-4f7d-b2e8-15ac9f3d7e60",
  "originalTransactionId": "386865f7-c8aa-4aba-a374-ec9e6f8a6300",
  "status": "POSTED",
  "type": "REVERSAL",
  "concept": "REFUND",
  "amount": "3500.00",
  "currency": "ARS",
  "balanceAfter": "16250.00",
  "createdAt": "2026-08-05T19:02:11.004Z"
}
```

Reglas:

- La original tiene que estar en `POSTED`.
- Si ya fue revertida: `409 ALREADY_REVERSED`, con el `transactionId` de la reversa existente. **Tratalo como éxito**, no como error.
- Sólo puede revertir el módulo que cobró, o finanzas.
- Revertir un crédito debita, y ahí sí puede dar `422` por saldo insuficiente.

### 7.6 Consultar y reconciliar

| Endpoint | Quién | Para qué |
|---|---|---|
| `GET /api/v1/wallets/me` | Portal, token de usuario | Saldo propio |
| `GET /api/v1/wallets/me/transactions?type=&from=&to=&cursor=&limit=` | Portal | Movimientos propios |
| `POST /api/v1/wallets/me/top-ups` | Portal | Carga de saldo |
| `GET /internal/v1/wallet-transactions/by-reference?sourceModule=store&externalReference=purchase/abc` | Tu backend | **Reconciliación tras timeout** |
| `GET /internal/v1/wallet-transactions/{transactionId}` | Tu backend | Detalle |
| `GET /internal/v1/wallets/{userId}` | Backoffice/finanzas (`wallet:read:any`) | Saldo de un tercero |
| `GET /internal/v1/wallets/aggregates?groupBy=concept&from=&to=` | Analítica/finanzas | Balances y gastos agregados |

**Si un débito te da timeout, no reintentes a ciegas:** consultá `by-reference` primero. Si la transacción existe, el cobro ocurrió y la respuesta se perdió en la red.

Carga de saldo desde el portal (`POST /api/v1/wallets/me/top-ups`, con `Idempotency-Key`):

```json
{ "amount": "5000.00", "currency": "ARS", "paymentMethodToken": "mock-approved" }
```

En el TP el token puede ser `mock-approved` o `mock-rejected`; no se aceptan números de tarjeta. Devuelve `201` si se aprueba, `202` con estado `PENDING` si el proveedor resuelve asincrónicamente, o `422 WALLET_TOPUP_REJECTED` si rechaza.

Los agregados devuelven totales por concepto y el saldo total en circulación, **sin ningún identificador de persona**:

```json
{
  "range": { "from": "2026-08-01", "to": "2026-08-31" },
  "currency": "ARS",
  "outstandingBalance": "8452300.00",
  "walletCount": 1834,
  "groups": [
    { "key": "STORE_PURCHASE", "type": "DEBIT", "count": 942, "total": "1847500.00" },
    { "key": "PAYROLL", "type": "CREDIT", "count": 210, "total": "10080000.00" }
  ]
}
```

---

## 8. Notificaciones

### 8.1 Cómo se genera una notificación

**En la mayoría de los casos no llamás a ningún endpoint.** Publicás tu evento de dominio y CORE deriva la notificación:

| Publicás | CORE crea | Le llega a |
|---|---|---|
| `teacher.exam-result.published.v1` | `EXAM_RESULT_PUBLISHED` | El estudiante |
| `library.penalty.applied.v1` | `LIBRARY_PENALTY_APPLIED` | El estudiante sancionado |
| `events.reminder.requested.v1` | `EVENT_REMINDER` | El inscripto |

Si necesitás una notificación que no derive de un evento del catálogo:

```http
POST /internal/v1/notifications
Authorization: Bearer <service-token>

{
  "userId": "ba310c57-a684-4dbf-a4a4-905fcfbefa08",
  "type": "EVENT_REMINDER",
  "title": "Tu evento comienza en una semana",
  "message": "Jornada de Ingeniería — 12 de agosto, 18:00",
  "actionUrl": "/events/65a783d1-d407-442d-8d09-a6d2abfe9321",
  "sourceModule": "events",
  "sourceReference": "event/65a783d1-d407-442d-8d09-a6d2abfe9321/reminder/7d",
  "expiresAt": "2026-08-12T22:00:00.000Z"
}
```

`sourceReference` es tu clave anti-duplicado: si tu scheduler se reinicia y vuelve a pedir el mismo recordatorio, la notificación no se duplica. `actionUrl` debe ser **relativa** o pertenecer a la allowlist de portales.

### 8.2 Cómo las lee el portal

| Endpoint | Resultado |
|---|---|
| `GET /api/v1/notifications?read=&type=&cursor=&limit=` | Las propias, paginadas |
| `GET /api/v1/notifications/unread-count` | `{ "count": 3 }` |
| `PATCH /api/v1/notifications/{id}` con `{ "read": true }` | Marcar leída |
| `POST /api/v1/notifications/read-all` | `204` |

### 8.3 Tiempo real

```js
const socket = io("https://core/notifications", {
  auth: { token: accessToken }
});

socket.on("notification.created", (n) => {
  // n tiene la misma forma que un item de GET /api/v1/notifications
});
```

- Namespace: `/notifications`. Autenticación en el handshake con el access token.
- CORE te une a la room `user:{sub}` derivada del token. **Cualquier `userId` que mande el cliente se ignora.**
- **Al reconectar, llamá a `GET /api/v1/notifications`.** El WebSocket es una aceleración, no una garantía de entrega: si el socket estaba caído cuando llegó la notificación, sólo la vas a ver por REST. La notificación siempre se persiste antes de emitirse.

---

## 9. Eventos: publicar

### 9.1 El envelope

Todos los eventos tienen la misma estructura. `data` es lo único que cambia según el tipo:

```json
{
  "specVersion": "1.0",
  "eventId": "e3d28114-e52e-4db9-afeb-03399bcb27e7",
  "eventType": "library.penalty.applied.v1",
  "source": "library",
  "occurredAt": "2026-08-05T18:25:43.511Z",
  "subject": "user/ba310c57-a684-4dbf-a4a4-905fcfbefa08",
  "correlationId": "f501201b-00bc-4200-99e0-6883500854f1",
  "causationId": null,
  "actor": { "type": "service", "id": "library-service" },
  "data": {
    "userId": "ba310c57-a684-4dbf-a4a4-905fcfbefa08",
    "loanId": "c8ed9311-6a6b-40c6-a798-5066d290c13c",
    "daysLate": 8,
    "amount": "2500.00",
    "currency": "ARS"
  }
}
```

| Campo | Regla |
|---|---|
| `eventId` | UUID v4 que generás vos, único global. Es la clave de deduplicación de todos los consumidores |
| `eventType` | Exactamente como figura en el catálogo, con sufijo de versión |
| `source` | Tu módulo. Debe coincidir con tu token: no podés publicar como otro |
| `occurredAt` | Cuándo pasó **el hecho de negocio**, no cuándo publicaste |
| `subject` | Entidad principal, formato `tipo/id` |
| `correlationId` | El que venías propagando |
| `causationId` | `eventId` del evento que disparó éste, si aplica |
| `data` | Valida contra el JSON Schema de `contracts/events/` |

**Nunca metas en `data` contraseñas, tokens, datos de tarjeta ni información personal que el consumidor no necesite.**

### 9.2 Publicar

```http
POST /internal/v1/events
Authorization: Bearer <service-token>
Idempotency-Key: e3d28114-e52e-4db9-afeb-03399bcb27e7
Content-Type: application/json

<envelope>
```

Usá el mismo `eventId` como `Idempotency-Key`.

`202`:

```json
{ "eventId": "e3d28114-e52e-4db9-afeb-03399bcb27e7", "status": "ACCEPTED" }
```

`ACCEPTED` significa que CORE lo persistió de forma durable y **se compromete a publicarlo** aunque se reinicie en el próximo milisegundo (patrón outbox). No significa que ya llegó a los consumidores.

Errores: `400 EVENT_SCHEMA_INVALID` con el detalle de validación, `403 EVENT_SOURCE_MISMATCH` si el `source` no es tuyo, `409` si el `eventId` ya existe con otro contenido.

### 9.3 Consultar el estado

| Endpoint | Quién | Para qué |
|---|---|---|
| `GET /internal/v1/events/{eventId}` | El dueño o IT | Estado: `ACCEPTED` / `PUBLISHED` / `FAILED` |
| `GET /internal/v1/events?type=&source=&status=&from=&to=` | IT | Búsqueda paginada |
| `POST /internal/v1/events/{eventId}/replay` | IT | Reentrega auditada. **No es un hecho de negocio nuevo** |
| `GET /internal/v1/event-bus/dlq` | IT | Mensajes muertos |
| `POST /internal/v1/event-bus/dlq/{messageId}/retry` | IT | Reintento manual |

---

## 10. Eventos: consumir

### 10.1 Pedir tu cola

No declares exchanges, queues ni bindings desde tu código, aunque tu cliente AMQP te deje: si declarás con durabilidad o argumentos distintos a los nuestros, RabbitMQ devuelve `PRECONDITION_FAILED` y rompe a todos los consumidores de ese recurso. Las credenciales que te damos no incluyen permiso de configuración, justamente para evitarlo.

Para pedir una cola, abrí un PR sobre `contracts/topology.yaml`:

```yaml
queues:
  - name: analytics.all-events.v1     # formato {modulo}.{proposito}.v1
    durable: true
    owner: analytics
    bindings:
      - exchange: uadenet.events.v1
        routingKeys: ["#"]
    deadLetter: uadenet.dlx.v1
    maxRetries: 3
```

Si el pedido incluye un `eventType` nuevo, agregá en el mismo PR su JSON Schema en `contracts/events/` y la entrada en AsyncAPI. Respondemos en 48 h hábiles. Al mergear, la topología se aplica sola en el próximo arranque del worker.

### 10.2 Bindings y routing keys

**La routing key es idéntica al `eventType`.** El formato `{source}.{entidad}.{acción}.v{n}` te permite bindear con comodines:

| Patrón | Recibís |
|---|---|
| `library.penalty.applied.v1` | Sólo ese evento |
| `teacher.#` | Todo lo que publique el Portal del Docente |
| `*.reservation.*.v1` | Reservas de cualquier módulo |
| `#` | Absolutamente todo (lo que usa Analítica) |

Cada módulo tiene **su propia cola**. Nunca compartas cola con otro módulo: si lo hacés, cada mensaje le llega a uno solo de los dos.

### 10.3 Cómo procesar un mensaje

Este es el algoritmo, y no es opcional:

1. Consumí con `prefetch` acotado (10–50) y **ack manual**.
2. Validá el envelope contra el schema.
3. Insertá el `eventId` en tu tabla inbox con índice único **y ejecutá tu efecto en la misma transacción de base de datos**.
4. Si el `eventId` ya estaba: es una reentrega. Hacé ack **sin repetir el efecto**.
5. Error transitorio (tu DB caída, timeout): nack. El mensaje va a retry con backoff de 10 s, 1 min y 10 min.
6. Después de 3 intentos, o si es un error permanente o el schema es inválido: va a la DLQ con `failureReason`, `failedAt` y `attempt`.

Tabla inbox mínima:

```sql
CREATE TABLE inbox_messages (
  event_id     UUID PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  result       TEXT
);
```

**No hagas ack antes de procesar**, y **no hagas ack de un error para que no moleste**: si algo falla, dejá que vaya a la DLQ. Un mensaje "desaparecido" en producción es mucho peor que uno visible en la DLQ.

### 10.4 Si no podés consumir RabbitMQ

Existe entrega por webhook como compatibilidad, no como bus alternativo:

- `POST /internal/v1/subscriptions` con `{ eventType, callbackUrl }` (la URL debe estar en allowlist).
- CORE verifica intención con `GET callbackUrl?topic=...&challenge=...`; devolvé el `challenge` en el body.
- Entregamos con `POST callbackUrl`, headers `X-UADEnet-Event-Id` y `X-UADEnet-Signature: sha256=<hmac>` calculado sobre los bytes crudos del body. **Validá la firma comparando en tiempo constante.**
- Reintentamos ante timeout, `5xx` y `429`. Cualquier `2xx` confirma la entrega.

---

## 11. Catálogo de eventos

| Evento | Lo publica | Lo consumen | `data` |
|---|---|---|---|
| `backoffice.user.upserted.v1` | Backoffice | CORE Auth, Analítica | `userId, email, status, roles, permissions` |
| `backoffice.user.disabled.v1` | Backoffice | CORE Auth | `userId, reason` |
| `backoffice.rate.changed.v1` | Backoffice | Biblioteca, Comedor, Eventos | `rateType, amount, currency, effectiveFrom` |
| `backoffice.location.upserted.v1` | Backoffice | Biblioteca, Comedor, Eventos, Académica | `locationId, siteId, name, capacity, status` |
| `teacher.exam-result.published.v1` | Portal Docente | CORE Notif., Académica, Analítica | `studentId, courseId, subjectId, examId, grade, result, publishedAt` |
| `teacher.attendance.recorded.v1` | Portal Docente | Académica, Analítica | `studentId, courseId, classDate, present` |
| `library.penalty.applied.v1` | Biblioteca | CORE Notif., Analítica | `userId, loanId, daysLate, amount, currency` |
| `dining.reservation.created.v1` | Comedor | Analítica, calendario de portales | `reservationId, userId, siteId, slotAt, amount, currency` |
| `dining.reservation.cancelled.v1` | Comedor | Analítica, calendario de portales | `reservationId, userId, slotAt, cancelledAt` |
| `dining.attendance.recorded.v1` | Comedor | Analítica | `reservationId, userId, attendedAt` |
| `store.purchase.completed.v1` | Tienda | Analítica | `purchaseId, userId, total, currency, items[]` |
| `events.event.created.v1` | Eventos | Analítica, calendario de portales | `eventId, title, locationId, startAt, endAt, capacity, price, currency` |
| `events.registration.completed.v1` | Eventos | Analítica | `eventId, registrationId, userId, amount, currency` |
| `events.reminder.requested.v1` | Eventos | CORE Notif. | `eventId, userId, title, startAt, detailsUrl` |
| `events.attendance.recorded.v1` | Eventos | Analítica | `eventId, userId, present, checkedAt` |
| `academic.exam-scheduled.v1` | Gestión Académica | calendario de portales | `examId, subjectId, startAt, endAt, siteId, locationId` |
| `academic.term-defined.v1` | Gestión Académica | calendario de portales, Analítica | `termId, startDate, endDate` |
| `core.wallet.transaction-posted.v1` | CORE | módulo originante, Analítica | `transactionId, userId, type, concept, amount, currency, sourceModule, externalReference, status` |
| `core.wallet.transaction-rejected.v1` | CORE | módulo originante, Analítica | `userId, type, concept, amount, currency, sourceModule, externalReference, reasonCode` |
| `core.wallet.transaction-reversed.v1` | CORE | módulo originante, Analítica | `transactionId, originalTransactionId, userId, concept, amount, currency` |
| `core.notification.created.v1` | CORE | Analítica (opcional) | `notificationId, userId, type, sourceModule, createdAt` |

**Sobre el calendario académico:** el backend de cada portal arma su propia vista de calendario consumiendo los eventos de Comedor, Eventos y Académica. CORE no expone un endpoint de calendario agregado — la composición de esa vista es negocio del portal.

**Sobre el historial de compras:** no se enruta `store.purchase.completed.v1` a los portales. El historial se consulta con un `GET` a Tienda por el gateway, que es la fuente de verdad y ya conoce cancelaciones y devoluciones.

---

## 12. Checklist por módulo

### Portal del Estudiante

- Login, refresh, logout, `me`.
- `GET /api/v1/wallets/me` y `/transactions`; `POST /api/v1/wallets/me/top-ups` para la carga de saldo.
- `GET /api/v1/notifications` + WebSocket para las notificaciones en tiempo real de examen, sanción y evento próximo.
- Historial de compras: `GET /api/v1/store/...` por gateway.
- Calendario: tu backend consume eventos de Comedor, Eventos y Académica.
- **No publicás eventos desde el navegador.**

### Portal del Docente

- Todo lo personal igual que Estudiante (auth, saldo, notificaciones).
- Tu backend publica `teacher.exam-result.published.v1` y `teacher.attendance.recorded.v1`.
- **No llames a notificaciones para avisar la nota**: CORE la deriva del evento. Si hacés las dos cosas, el estudiante recibe dos avisos.

### Biblioteca

- Consumís `backoffice.rate.changed.v1` filtrando `rateType=LIBRARY_LATE_FEE` para saber el monto vigente.
- Orden recomendado: creás la sanción → pedís el débito `LIBRARY_FINE` con `externalReference=penalty/{penaltyId}` → guardás el `transactionId` → publicás `library.penalty.applied.v1`.
- **Si no hay saldo (`422`), la deuda es tuya.** CORE no deja el saldo en negativo. Guardá la sanción como impaga y reintentá cuando el usuario cargue saldo.
- CORE le manda la notificación al estudiante con link a tu portal. Vos conservás préstamo, vencimiento, sanción y deuda.

### Comedor

- Consumís `backoffice.rate.changed.v1` con `rateType=DINING_RESERVATION`.
- Al reservar: débito con `externalReference=reservation/{reservationId}`. **Guardá el `transactionId`.**
- Al presentarse el usuario: `POST /internal/v1/wallet-transactions/{transactionId}/reversals` **sin `amount`** — restituye el total exacto, que es lo que pide el enunciado.
- Un segundo check-in devuelve `409 ALREADY_REVERSED`: tratalo como éxito.
- Publicás reserva, cancelación y asistencia.

### Tienda

- Débito con `externalReference=purchase/{purchaseId}`, `concept=STORE_PURCHASE`.
- Publicás `store.purchase.completed.v1` **sólo después** de confirmar stock y cobro.
- Si el stock falla después de cobrar, revertí con el `transactionId`.
- El historial de compras lo servís vos por gateway.

### Eventos

- Toda la validación de negocio es tuya: superposición de locación, cupo máximo, doble inscripción del usuario, método de comprobación de asistencia. CORE no valida nada de eso.
- Inscripción paga: débito con `concept=EVENT_REGISTRATION`, `externalReference=registration/{registrationId}`. Si después no podés confirmar el cupo, revertí.
- **El scheduler de "faltan 7 días" es tuyo.** Cuando toca, publicás `events.reminder.requested.v1` y CORE entrega la notificación.
- Publicás creación, inscripción y asistencia para Analítica y calendario.

### Analítica

- Tu cola `analytics.all-events.v1` bindeada a `#`: recibís todo.
- **Implementá inbox obligatoriamente**: con binding `#` vas a ver reentregas.
- Balances y gastos administrativos (incluidos salarios): `GET /internal/v1/wallets/aggregates`, agrupando por `concept`.
- Facturación de comedor por sede: de `dining.reservation.created.v1`, que lleva `siteId`. CORE no conoce sedes.
- Productos más vendidos: de `store.purchase.completed.v1`.
- **No consultás wallets usuario por usuario** y no recibís credenciales ni el texto de las notificaciones.

### Backoffice

- Provisionás identidades: `PUT /internal/v1/identities/{userId}` (vos generás el UUID) o publicando `backoffice.user.upserted.v1`. **Elegí un camino y usá siempre el mismo**, no los dos para el mismo comando.
- Cambio de estado: `PATCH /internal/v1/identities/{userId}/status` con `{ "status": "ACTIVE" | "SUSPENDED" | "DISABLED" }`.
- Publicás tarifas (`backoffice.rate.changed.v1`) y sedes/ubicaciones.
- Sueldos: `POST /internal/v1/wallets/{userId}/credits` con `concept=PAYROLL`.
- **Nunca almacenás hashes de contraseña ni podés fijar un saldo directamente.**

### Gestión Académica

- Consumís `teacher.attendance.recorded.v1` y `teacher.exam-result.published.v1` para el motor de regularidad.
- Publicás `academic.exam-scheduled.v1` y `academic.term-defined.v1` para los calendarios.
- Tus endpoints administrativos pasan por gateway con permisos académicos.

---

## 13. Errores y cómo reaccionar

Todos los errores de CORE usan `application/problem+json`:

```json
{
  "type": "https://uadenet.local/errors/insufficient-funds",
  "title": "Saldo insuficiente",
  "status": 422,
  "code": "WALLET_INSUFFICIENT_FUNDS",
  "detail": "La cuenta no posee saldo suficiente para la operación.",
  "instance": "/internal/v1/wallets/ba310c57.../debits",
  "correlationId": "1da97d42-0c5a-4b77-8820-304e747f62d2"
}
```

**Programá contra `code`, no contra `detail`.** El texto puede cambiar; el código no.

| Status | Significado | ¿Reintentar? |
|---|---|---|
| `400` | Contrato inválido | No: arreglá el request |
| `401` | Token ausente, vencido o inválido | Sí, después de refrescar |
| `403` | Autenticado pero sin permiso | No |
| `404` | No existe | No |
| `409` | Conflicto de idempotencia o referencia duplicada | No: leé el `transactionId`/`eventId` que viene en la respuesta |
| `422` | Regla de negocio (saldo insuficiente, reversa inválida) | No: es una respuesta válida, manejala |
| `429` | Rate limit | Sí, con backoff, respetando `Retry-After` |
| `502` / `504` | Upstream inválido o timeout | Sólo si tu operación es idempotente |
| `503` | Upstream caído o circuit breaker abierto | Sí, con backoff |

Cuando reportes un problema, **mandanos el `correlationId`**: con eso rastreamos la operación completa a través del gateway, la base y los eventos.

---

## 14. Checklist de integración

Antes de decir que tu módulo está integrado:

- [ ] Validás el JWT localmente con JWKS, además de confiar en el gateway.
- [ ] Cacheás las claves públicas y no llamás a `introspect` en cada request.
- [ ] Tenés tu `clientId`/`clientSecret` de servicio en variables de entorno, fuera de Git.
- [ ] Propagás `X-Correlation-Id` en llamadas, eventos y logs.
- [ ] Toda escritura financiera manda `Idempotency-Key` y una `externalReference` estable derivada de tu entidad.
- [ ] Guardás el `transactionId` de CORE junto a tu entidad de negocio.
- [ ] Manejás `422 WALLET_INSUFFICIENT_FUNDS` como caso de negocio, no como error inesperado.
- [ ] Manejás `409 DUPLICATE_REFERENCE` y `409 ALREADY_REVERSED` adoptando la transacción existente.
- [ ] Ante timeout consultás `by-reference` antes de reintentar.
- [ ] Si consumís RabbitMQ, tenés tabla inbox con índice único por `eventId`.
- [ ] Hacés ack sólo después de persistir, y dejás que los errores lleguen a la DLQ.
- [ ] Tus eventos validan contra su JSON Schema y no llevan datos sensibles.
- [ ] Devolvés errores en `application/problem+json`.
- [ ] Exponés `/health/live` y `/health/ready`.
- [ ] Tu OpenAPI está publicado y actualizado.

---

**Contacto:** equipo CORE. Los contratos formales están en `contracts/openapi.yaml`, `contracts/asyncapi.yaml` y `contracts/events/*.schema.json`. Hay una colección de Postman con todos los flujos de este documento.
