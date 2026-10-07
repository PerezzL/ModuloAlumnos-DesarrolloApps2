# Guía de la demo

Guion para mostrar el Portal del Estudiante de punta a punta en la segunda entrega: los 9
requisitos funcionales, una falla parcial y una notificación en tiempo real, todo contra el
CORE falso. Dura unos 20 minutos; los pasos marcados como *opcional* se saltean si falta tiempo.

Esta guía es un recorrido. El catálogo completo de casos, usuarios y fallas está en
[`pruebas.md`](pruebas.md); cómo instalar, en [`instalacion.md`](instalacion.md).

## Qué se demuestra

| Paso | Requisito | Qué se ve |
| --- | --- | --- |
| 1 | — | Arquitectura: los tres caminos (BFF, CORE directo, tiempo real) |
| 2 | RF1 | Login, dominio inválido, cuenta suspendida, sesión que sobrevive a la recarga |
| 3 | RF1 | Home y perfil con datos de Backoffice |
| 4 | RF7 | Calendario unificado y **falla parcial** con un módulo apagado |
| 5 | RF2 | Oferta con estados, correlativa faltante, sin cupo, inscripción y rechazo |
| 6 | RF3 | Historial, detalle de cursada con asistencia, faltas restantes y notas; Docente caído |
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

### 1. Arquitectura en un minuto

Qué contar, sin pantalla o con el diagrama de [`arquitectura.md`](arquitectura.md):

- El portal **no es dueño de datos**: consulta en vivo a los módulos 2, 4, 5, 6, 8 y 9.
- El navegador solo conoce el **Gateway de CORE**. Hay tres caminos:
  1. Lo que agrega o traduce el **BFF** (calendario, inscripción, historial, compras).
  2. Lo que es de **CORE directo** (login, saldo, notificaciones).
  3. **Tiempo real**: socket.io de CORE para las notificaciones.
- Hoy, en lugar de CORE y de los módulos, corre el **CORE falso**, que sirve las mismas
  fixtures que usan los tests. Pasar a lo real es cambiar URLs, no código.

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
   todo el día), eventos inscriptos (Jornada de Desarrollo de Software el 12) y la mesa
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

Ir a **Académico**. Es la oferta del 1° cuatrimestre de 2027, armada por el BFF cruzando
cursos, correlatividades e historial.

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
   inscripción: **"Ya estás inscripto"** (`YA_INSCRIPTO`, devuelto por el Módulo 9).
4. Remarcar: el portal no guarda la inscripción, la comanda al Módulo 9 y refleja el
   resultado; el POST nunca se reintenta solo.

### 6. Historial y detalle de cursada (RF3)

1. Ir a **Mis Cursos**: arriba las cursadas en curso (ahora incluye Sistemas Operativos),
   abajo el historial con materia, cuatrimestre, nota y situación. Filtrar por período.
2. Abrir **Bases de Datos I**: 5 de 8 clases (62,5 %), listado por fecha y **alerta: le
   queda 1 falta** antes de quedar libre.
3. Abrir **Desarrollo de Aplicaciones I**: asistencia completa, sin indicador (el Módulo 2
   no informa límite) y notas parciales: 1er parcial 4 (desaprobado), recuperatorio pendiente.
4. Abrir el **1er parcial**: detalle de la nota con docente y observaciones.
5. *Opcional:* alumno libre. Desde Mis Cursos solo enlazan las cursadas en curso, así que
   se entra por URL: http://localhost:5173/alumnos/cursos/curso-ayed-2025-2-a. Se ve
   "Quedaste libre" en lugar del indicador.
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

Aclarar: todo lo del Módulo 2 es una suposición nuestra, porque todavía no publicó contrato.
El impacto de cuando lo publique queda en su adaptador y su fixture.

### 7. Notificaciones en tiempo real (RF4, RF5, RF6)

1. Mostrar la campana: 3 notificaciones, 2 sin leer. Abrir el centro de notificaciones.
2. Con el portal a la vista, **disparar una nota** desde la terminal:

   ```bash
   curl -X POST localhost:4000/__falso/notificaciones -H 'content-type: application/json' -d '{"tipo":"EXAM_RESULT_PUBLISHED"}'
   ```

   Llega **sin recargar**: sube el contador y aparece el aviso.
3. Tocar la nota → **detalle de la nota** de Bases de Datos I (nota 7). Remarcar que la
   notificación solo trae el `actionUrl`; el detalle se pide al Módulo 2 por el BFF.
4. Tocar la **sanción de biblioteca** → avisa que sale del portal y abre el portal de
   Biblioteca (RF5). Tocar el **recordatorio de evento** → portal de Eventos (RF6).
   En la demo, esas URLs son de ejemplo (`*.uadenet.example`) y no cargan: lo que se
   muestra es la redirección.
5. Marcar todas como leídas: el contador baja a cero.
6. *Opcional:* cerrar la pestaña, disparar otra notificación y volver a abrir el portal:
   aparece igual, porque al conectar se pide el listado por REST (el socket acelera, no
   garantiza).

### 8. Historial de compras (RF8)

- Ir a **Compras**: 3 compras, dos completadas (Monserrat y Recoleta) y una cancelada.
- Filtrar por estado.
- Abrir una: productos, cantidades, precio unitario y total, con los precios del momento
  de la compra.

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
