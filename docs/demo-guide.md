# Guía de la demo

Guion para mostrar el Portal del Estudiante de punta a punta en la segunda entrega: los 9
requisitos funcionales, una falla parcial y una notificación en tiempo real, todo contra el
CORE falso. Dura unos 25 minutos; los pasos marcados como *opcional* se saltean si falta tiempo.

Esta guía es un recorrido. El catálogo completo de casos, usuarios y fallas está en
[`pruebas.md`](pruebas.md); cómo instalar, en [`instalacion.md`](instalacion.md).

## Qué se demuestra

| Paso | Requisito | Qué se ve |
| --- | --- | --- |
| 1 | — | Arquitectura (los tres caminos, seguridad, resiliencia) y tecnologías elegidas |
| 2 | RF1 | Login, dominio inválido, cuenta suspendida, sesión que sobrevive a la recarga |
| 3 | RF1 | Home y perfil con datos de Backoffice |
| 4 | RF7 | Calendario unificado y **falla parcial** con un módulo apagado |
| 5 | RF2 | Oferta con estados, correlativa faltante, sin cupo, inscripción y rechazo |
| 6 | RF3 | Historial, detalle de cursada con asistencia, condición y notas; Docente caído |
| 7 | RF4, RF5, RF6 | **Notificación en tiempo real** y destino de cada tipo |
| 8 | RF8 | Historial y detalle de compras |
| 9 | RF9 | Saldo y carga aprobada, rechazada y pendiente |
| 10 | — | Detrás de escena: contrato, Swagger, correlation id, tests y CI |

## Antes de la demo

### El día anterior

- [ ] En una máquina limpia (o después de `docker compose down --rmi local -v`), clonar el
      repo y correr `docker compose up --build`. Tiene que levantar sin pasos extra.
- [ ] Recorrer esta guía completa una vez y anotar lo que no salga como dice.
- [ ] Revisar la fecha: los datos están armados alrededor del 4 de octubre de 2026 y la
      inscripción al 1° cuatrimestre de 2027 cierra el 19/12/2026 (ver [`pruebas.md`](pruebas.md), sección 5).

### Diez minutos antes

```bash
docker compose up --build
```

```bash
curl -X POST localhost:4000/__falso/reset
```

Dejar abierto:

- **Navegador, ventana normal:** http://localhost:5173, sin sesión iniciada.
- **Navegador, segunda pestaña:** vacía, para el caso de "ya inscripto".
- **Terminal:** con los comandos de esta guía a mano (se pueden copiar de acá).
- *Opcional:* `docker compose logs -f bff` en otra terminal, para el paso 10.

Si algo queda en un estado raro durante la demo, `POST /__falso/reset` vuelve todo a los
datos iniciales (inscripciones, notificaciones, saldo y fallas), sin reiniciar nada.

## El recorrido

### 1. Arquitectura y tecnologías

Unos 5 minutos, antes de abrir el portal. Se apoya en el diagrama de
[`arquitectura.md`](arquitectura.md) ("Cómo viaja un pedido"); el detalle y las alternativas
descartadas también están ahí, por si preguntan.

#### 1.1 Qué es el Módulo 1

- Un **Frontend (SPA) + BFF** (Backend For Frontend). El portal **no es dueño de datos
  académicos**: consulta en vivo a Docente (2), Comedor (4), Tienda (5), Eventos (6),
  Backoffice (8) y Gestión Académica (9), y usa de CORE el login, el saldo y las notificaciones.
- No persiste inscripciones, historial, calendario ni compras. Solo cachea en memoria, con
  TTL, datos que casi no cambian (correlatividades, nombres de asignatura), y ningún pedido
  depende de que estén cacheados.

#### 1.2 Los tres caminos

El navegador solo conoce **la URL del Gateway de CORE**; nunca llama al BFF directo.

| Camino | Qué pasa por ahí | Recorrido |
| --- | --- | --- |
| 1. BFF | Calendario, oferta e inscripción, historial y detalle de cursada, compras, perfil | Front → Gateway → BFF → Gateway → módulos |
| 2. CORE directo | Login, refresh, logout, saldo, listado de notificaciones | Front → Gateway → CORE |
| 3. Tiempo real | Notificaciones nuevas | CORE → Front, por socket.io |

Qué remarcar de cada uno:

- **Camino 1:** el Gateway aparece dos veces, como entrada hacia el BFF y como salida hacia
  los módulos. El BFF llama en paralelo, traduce cada respuesta con un **adaptador por
  módulo** y devuelve un único JSON con la forma del [`openapi.yaml`](../openapi.yaml).
  Ejemplo: el calendario junta Comedor, Eventos y Gestión Académica en un solo pedido.
- **Camino 2:** son contratos de CORE que el front usa tal cual. Pasarlos por el BFF solo
  sumaría un salto sin agregar nada.
- **Camino 3:** el socket es una aceleración, no una garantía. Al conectar o reconectar el
  front pide el listado por REST, así no se pierde nada si estuvo desconectado.

#### 1.3 Identidad y seguridad

- El alumno se identifica **solo por el token**. El Gateway inyecta `X-User-Id`; el id nunca
  viaja en la URL ni en el body, así que no se puede pedir el historial de otro.
- El BFF **valida el JWT otra vez** (RS256 contra el JWKS de CORE: firma, issuer, audience,
  expiración). Es defensa en profundidad, pedida por CORE.
- En el front el `accessToken` vive **solo en memoria**; al recargar se renueva con la cookie
  de refresh de CORE (HttpOnly). Los refresh se serializan porque el token rota en cada uso.

#### 1.4 Resiliencia

- Errores en `application/problem+json` con un `code` estable, que el front traduce a un
  mensaje propio.
- El BFF maneja explícitamente las respuestas del Gateway: 503 (módulo caído), 502
  (respuesta inválida) y 504 (timeout de 10 s). Corta antes, a los 8 s, para poder decir
  qué módulo tardó.
- **Falla parcial en lugar de pantalla en blanco:** el calendario responde con lo que pudo
  cargar y el detalle de cursada se ve aunque el Módulo 2 esté caído. Se muestra en vivo en
  los pasos 4 y 6.
- El POST de inscripción **no se reintenta solo**; las cargas de saldo llevan un
  `Idempotency-Key` por intento para no cobrar dos veces.

#### 1.5 Tecnologías y por qué

El criterio común: **un solo lenguaje (TypeScript) y un solo contrato (`openapi.yaml`) de
punta a punta**.

| Capa | Tecnología | Por qué |
| --- | --- | --- |
| Contrato | OpenAPI 3.0 + Swagger UI | Se escribe primero; de ahí salen los tipos del front y del BFF (`openapi-typescript`) y los tests validan las respuestas contra él |
| Frontend | React + Vite + TypeScript | Todo está detrás del login: alcanza una SPA, sin renderizado en servidor. Vite da recarga rápida y genera archivos estáticos |
| Datos y ruteo (front) | TanStack Query + React Router + `openapi-fetch` | Caché, reintentos y estados de carga/error resueltos; llamadas tipadas desde el contrato |
| UI | Tailwind CSS + shadcn/ui | Componentes accesibles que quedan en el repo y se adaptan sin pelear con una librería |
| Tiempo real | `socket.io-client` | Lo impone CORE; el portal no levanta servidor propio de WebSocket ni consume RabbitMQ |
| BFF | NestJS (Node + TypeScript) | Es entrada y salida, no cómputo: el modelo asincrónico de Node resuelve las llamadas en paralelo. Un módulo de Nest por módulo externo, y lugares fijos para lo transversal: guard del JWT, filtro de problem+json, middleware del correlation id |
| HTTP, logs, config (BFF) | `fetch` nativo, `nestjs-pino`, zod, `jose` | Sin dependencias de más; logs estructurados con `X-Correlation-Id`; la config se valida al arrancar y falla temprano |
| Tests | Vitest | Adaptadores probados con fixtures (JSON del módulo externo → modelo propio) y e2e del BFF contra el contrato |
| Entorno | npm workspaces + Docker Compose | Un repo con web, BFF, CORE falso y tipos; `docker compose up` levanta todo igual en cualquier máquina |

Descartados, en una línea cada uno: **Spring Boot** (dos lenguajes y dos generadores de
tipos para un BFF sin lógica propia), **Express o Fastify solos** (la estructura quedaría a
criterio de cada uno) y **Next.js** (su fuerte es el renderizado en servidor y las rutas de
API, que duplicarían el BFF).

#### 1.6 Qué corre hoy en la demo

- En lugar de CORE y los módulos corre el **CORE falso** (`apps/core-falso`): hace de
  Gateway, auth (con claves RS256 propias y JWKS), notificaciones por socket.io, saldo y
  módulos externos. La topología es la misma que en producción.
- Los datos salen de **fixtures**: archivos JSON en `packages/fixtures/<modulo>/` con una
  respuesta de ejemplo de cada módulo externo (por ejemplo, las reservas de comedor de
  Valentina). Cada fixture se usa en dos lugares: el CORE falso la devuelve cuando el BFF le
  pide algo a ese módulo, y el test del adaptador se la pasa como entrada para verificar que
  la traduce bien al modelo del contrato. Al ser el mismo archivo, lo que se ve en la demo y
  lo que prueban los tests no se pueden desalinear.
- Las fixtures cuya forma el módulo dueño no confirmó se llaman `*.provisional.json`: son
  suposición nuestra (por ejemplo, todas las de Gestión Académica). Las de Docente, Comedor,
  Tienda, Eventos y el saldo de CORE ya siguen el contrato confirmado de cada módulo.
- Permite **simular fallas en caliente** (`/__falso/fallas`) y disparar notificaciones; es
  lo que se usa en los pasos 4, 6 y 7.
- Pasar a lo real es **cambiar variables de entorno** (Gateway, JWKS, issuer, audience,
  WebSocket) y, por cada módulo que confirme su contrato, ajustar su fixture y su adaptador.
  El resto del BFF y el front no se tocan.

### 2. Login y sesión (RF1)

| Hacer | Qué se espera | Qué remarcar |
| --- | --- | --- |
| Escribir `alguien@gmail.com` y salir del campo | Error de dominio, sin llamar a CORE | Validación en el front |
| `suspendido@uade.edu.ar` / `uade2026` | Mensaje de cuenta suspendida (403) | Cada error de CORE tiene su mensaje |
| `v.moreno@uade.edu.ar` / `uade2026` | Entra al Home | |
| Recargar la página (F5) | Sigue con la sesión | El token vive solo en memoria; al recargar se renueva con la cookie de refresh de CORE |

### 3. Home y perfil (RF1)

- En el Home: resumen de saldo, notificaciones sin leer y lo próximo del calendario.
- Ir a **Perfil**: Valentina Moreno, legajo 1123456, Ingeniería en Informática.
- Remarcar: el BFF combina la identidad del token con los datos de Backoffice (Módulo 8).
  El id del alumno sale del token, nunca de la URL.

### 4. Calendario y falla parcial (RF7)

1. Ir a **Calendario**, octubre de 2026. Se ven las tres categorías: comedor (5, 8 y 14,
   con hora y sede), eventos inscriptos (Jornada de Desarrollo de Software el 12) y la mesa
   especial de exámenes del 19 al 23. La Semana de la Ingeniería empezó en septiembre y
   aparece igual.
2. Filtrar por una categoría y volver a todas.
3. **Apagar el Comedor** desde la terminal:

   ```bash
   curl -X PUT localhost:4000/__falso/fallas/dining -H 'content-type: application/json' -d '{"tipo":"caido"}'
   ```

4. Reintentar o recargar el calendario: **sigue funcionando** con eventos y exámenes, y avisa
   que el comedor no está disponible.
5. Remarcar: el BFF llama a los tres módulos en paralelo; responde 200 con lo que cargó y
   solo es error si fallan los tres.
6. Volver a encenderlo:

   ```bash
   curl -X DELETE localhost:4000/__falso/fallas/dining
   ```

*Opcional:* con `{"tipo":"lento"}` en `events`, el calendario tarda 10 s y sale sin eventos
(timeout del Gateway).

### 5. Inscripción (RF2)

Ir a **Académico**. Es la oferta del 1° cuatrimestre de 2027, armada por el BFF cruzando los
cursos del período con las materias del plan, las correlatividades y el historial.

| Mostrar | Qué se espera |
| --- | --- |
| Desarrollo de Aplicaciones II | Bloqueada: le falta regularizar Desarrollo de Aplicaciones I |
| Bases de Datos II | Bloqueada: le falta aprobar Bases de Datos I |
| Algoritmos y Estructuras de Datos (A) | Sin cupo (40/40) |
| Algoritmos y Estructuras de Datos (B) | Disponible: la recursa porque quedó libre en 2025 |
| Día, horario y sede de cada comisión | Visibles en cada comisión |

Inscribirse:

1. Abrir **Académico también en la segunda pestaña**.
2. En la primera, inscribirse en **Sistemas Operativos (A)**: confirmación, el cupo pasa de
   10 a 11.
3. En la segunda pestaña (que todavía muestra el estado viejo), intentar la misma
   inscripción: **"No pudimos inscribirte"** con el motivo que devuelve el Módulo 9 ("El
   alumno ya está inscripto en la asignatura"). El Módulo 9 solo da códigos genéricos, así
   que el portal muestra su motivo tal cual.
4. Remarcar: el portal no guarda la inscripción, la comanda al Módulo 9 y refleja el
   resultado; el POST nunca se reintenta solo.

### 6. Historial y detalle de cursada (RF3)

1. Ir a **Mis Cursos**: arriba las cursadas en curso (ahora incluye Sistemas Operativos),
   abajo el historial con materia, cuatrimestre, nota y situación. Filtrar por período. La
   nota final sale de las actas del Módulo 2; la situación, del Módulo 9.
2. Abrir **Bases de Datos I**: 75 % de asistencia con una falta justificada, listado por
   fecha y **alerta: cerca del mínimo** de 75 % que informa el Módulo 2. Notas: Parcial 1,
   TP1 (integrador) y Parcial 2 pendiente, con el promedio.
3. Abrir **Desarrollo de Aplicaciones I**: asistencia completa ("al día") y notas: Parcial 1
   desaprobado, recuperatorio aprobado y una exposición oral ausente. El TP cancelado no
   aparece.
4. Abrir el **Recuperatorio Parcial 1**: detalle de la nota con el docente que la cargó
   (el nombre sale de Backoffice).
5. *Opcional:* alumno libre. Desde Mis Cursos solo enlazan las cursadas en curso, así que
   se entra por URL: http://localhost:5173/alumnos/cursos/1003. Se ve
   "Quedaste libre".
6. **Apagar Docente** (Módulo 2):

   ```bash
   curl -X PUT localhost:4000/__falso/fallas/teacher -H 'content-type: application/json' -d '{"tipo":"caido"}'
   ```

   Recargar el detalle de Bases de Datos I: **la cursada se ve igual** (materia, comisión,
   situación), con un aviso y botón de reintento en asistencia y en notas.

   ```bash
   curl -X DELETE localhost:4000/__falso/fallas/teacher
   ```

   Reintentar desde la pantalla: vuelven asistencia y notas.

Aclarar: el Módulo 2 publicó su contrato y agregó las rutas por alumno a pedido nuestro,
para que el portal no reciba los datos del resto de la comisión.

### 7. Notificaciones en tiempo real (RF4, RF5, RF6)

1. Mostrar la campana: 3 notificaciones, 2 sin leer. Abrir el centro de notificaciones.
2. Con el portal a la vista, **disparar una nota** desde la terminal:

   ```bash
   curl -X POST localhost:4000/__falso/notificaciones -H 'content-type: application/json' -d '{"tipo":"TEACHER_EXAM_RESULT_PUBLISHED"}'
   ```

   Llega **sin recargar**: sube el contador y aparece el aviso.
3. Tocar la nota → **detalle de la nota** (recuperatorio de Desarrollo de Aplicaciones I,
   nota 8). Remarcar que la notificación solo trae el `actionUrl`; el detalle se pide al
   Módulo 2 por el BFF.
4. Tocar la **sanción de biblioteca** → avisa que sale del portal y abre el portal de
   Biblioteca (RF5). Tocar el **recordatorio de evento** → portal de Eventos (RF6).
   En la demo, esas URLs son de ejemplo (`*.uadenet.example`) y no cargan: lo que se
   muestra es la redirección.
5. Marcar todas como leídas: el contador baja a cero.
6. *Opcional:* cerrar la pestaña, disparar otra notificación y volver a abrir el portal:
   aparece igual, porque al conectar se pide el listado por REST (el socket acelera, no
   garantiza).

### 8. Historial de compras (RF8)

- Ir a **Compras**: 3 compras, dos completadas (Sede Monserrat y Sede Recoleta) y una fallida.
- Filtrar por estado o por sede.
- Abrir la del buzo: imagen, color y talle, cantidades, precio unitario, subtotal y total,
  con los precios del momento de la compra.

### 9. Saldo (RF9)

Ir a **Cuenta Corriente**: $ 13.500,00 y 7 movimientos.

| Hacer | Qué se espera |
| --- | --- |
| Cargar $ 1.000 con **Tarjeta de prueba** | Aprobada: el saldo sube y el movimiento aparece primero |
| Cargar con **Tarjeta de prueba rechazada** | Mensaje de rechazo, el saldo no cambia |
| Cargar con **Pago diferido de prueba** | Queda pendiente, el saldo no cambia |

Remarcar: cada intento lleva su propio `Idempotency-Key`, así un reintento por error de red
no cobra dos veces. La lógica del saldo es de CORE; el portal solo la usa.

### 10. Detrás de escena

Elegir según el tiempo y el público:

- **Contrato primero:** [`openapi.yaml`](../openapi.yaml) es la fuente de verdad; los tipos del front y del BFF
  se generan desde ahí. Swagger UI del BFF en http://localhost:3000/docs.
- **Trazabilidad:** en `docker compose logs bff`, cada pedido lleva su `X-Correlation-Id`,
  que se propaga a todas las llamadas a otros módulos.
- **Calidad:** `npm run verify` (tipos, ESLint, lint del contrato y tests) corre en cada PR;
  las respuestas del BFF se validan contra el contrato en los tests.
- **Integraciones:** [`integraciones.md`](integraciones.md) dice qué está confirmado y qué es suposición; las
  fixtures `*.provisional.json` marcan lo no confirmado.

Cerrar con **Cerrar sesión** y volver atrás con el navegador: pide login y no muestra datos.

## Si algo sale mal

| Problema | Qué hacer |
| --- | --- |
| Datos en un estado raro (inscripciones, saldo, fallas que quedaron puestas) | `curl -X POST localhost:4000/__falso/reset` y recargar |
| Una pantalla queda con error después de quitar una falla | Reintentar desde la pantalla o recargar |
| La notificación no llega por el socket | Recargar: al conectar se piden por REST |
| La inscripción figura cerrada | La fecha de la máquina pasó del 19/12/2026: ajustar las fixtures ([`pruebas.md`](pruebas.md), sección 5) |
| Docker no levanta en la máquina de la demo | Plan B con Node: `npm install`, `cp .env.example .env`, `npm run dev` (ver [`instalacion.md`](instalacion.md)) |

## Preguntas que pueden hacer

- **¿Qué pasa cuando los módulos reales estén listos?** Se cambian las variables de entorno
  (`GATEWAY_URL`, JWKS, issuer, prefijos) y, por cada módulo que confirme su contrato, se
  ajustan su fixture y su adaptador. El resto del BFF y el front no se tocan.
- **¿Por qué un BFF?** Para agregar y traducir en un solo lugar (calendario, oferta con
  correlatividades) y que el front solo vea modelos propios. Ver [`arquitectura.md`](arquitectura.md).
- **¿Por qué las notificaciones y el saldo no pasan por el BFF?** Son contratos de CORE que
  el front consume directo; pasar por el BFF solo agregaría un salto.
- **¿Qué falta?** La integración real (ver [`integraciones.md`](integraciones.md), "Lo más urgente") y el
  despliegue, que depende de que CORE defina el dominio de los portales.
