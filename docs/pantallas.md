# Pantallas

Extraído del documento técnico v4.1 (sección 4). "Origen" indica de dónde saca los datos
el frontend: el BFF ([`openapi.yaml`](../openapi.yaml)) o CORE directo.

| # | Pantalla | RF | Origen de datos |
| --- | --- | --- | --- |
| 4.1 | Login | RF1 | CORE: `POST /api/v1/auth/login` |
| 4.2 | Home / Dashboard | Transversal | BFF `GET /me`, `GET /calendario`; CORE saldo y notificaciones |
| 4.3 | Inscripción a materias | RF2 | BFF `GET /inscripcion/oferta`, `POST /inscripciones` |
| 4.4 | Historial académico | RF3 | BFF `GET /cursadas` |
| 4.5 | Detalle de cursada | RF3 | BFF `GET /cursadas/{cursoId}` |
| 4.6 | Centro de notificaciones | RF4, RF5, RF6 | CORE: WebSocket y REST de notificaciones |
| 4.7 | Detalle de nota | RF4 | BFF `GET /cursadas/{cursoId}/notas/{notaId}` |
| 4.8 | Sanción de biblioteca | RF5 | Ninguno: redirección al portal de Biblioteca |
| 4.9 | Calendario académico | RF7 | BFF `GET /calendario` |
| 4.10 | Historial de compras | RF8 | BFF `GET /compras`, `GET /compras/{orderId}` |
| 4.11 | Saldo y carga de saldo | RF9 | CORE: wallets |

## 4.1 Login

- Formulario con mail institucional y contraseña.
- Error: mail fuera del dominio `@uade.edu.ar` (validado en el frontend).
- Error: credenciales inválidas.

## 4.2 Home / Dashboard

Pantalla de entrada tras el login. No corresponde a un RF explícito.

- Resumen de saldo.
- Notificaciones sin leer (acceso rápido).
- Próximo evento o examen del calendario.
- Header persistente.

## 4.3 Inscripción a materias

- Materias del plan del alumno, agrupadas por materia, con sus comisiones y estado:
  Inscripto / Con cupo / Sin cupo / Bloqueada por correlativa.
- Acción de inscripción a una comisión, con confirmación.
- Error: correlatividad faltante o sin condición de regularidad.
- Inscripción cerrada: en lugar de la oferta, "El período de inscripción no está abierto"
  con la fecha en que abre (o en que cerró). En desarrollo, un botón la simula.

## 4.4 Historial académico

- Tabla: materia, cuatrimestre, nota obtenida, situación.
- Cursadas en curso diferenciadas, con acceso al detalle de cursada (4.5).

## 4.5 Detalle de cursada — Asistencia y notas

Agregada por la corrección del profesor: la asistencia está ligada al estado de la materia.

- Encabezado: materia, comisión, cuatrimestre y situación actual (Cursando / Regular / Libre).
- Asistencia: clases dictadas, presentes, justificadas, ausentes y porcentaje, con el listado
  de clases por fecha (presente, justificada, ausente o sin registrar) y su comentario.
- Condición por asistencia: el porcentaje contra el mínimo para quedar regular que informa el
  Módulo 2 (hoy 75 %), con alerta cerca del mínimo. El Módulo 2 no informa cuántas faltas
  quedan.
- Estado cuando el alumno quedó libre (por asistencia, según el Módulo 2, o en la materia,
  según el Módulo 9).
- Notas de parciales, recuperatorios, integradores y finales, cada una con acceso al detalle
  de la nota (4.7), y el promedio si viene.
- Si el Módulo 2 no responde: se muestra la cursada sin asistencia ni notas, con aviso.

## 4.6 Centro de notificaciones

- Panel o dropdown con listado, leídas / no leídas.
- Variante visual por `type`: `TEACHER_EXAM_RESULT_PUBLISHED`, `LIBRARY_PENALTY_APPLIED`, `EVENT_REMINDER`.
- Acceso desde la campana del header, en todas las pantallas.
- Un único componente con variantes según `type`.

## 4.7 Detalle — Nota de un examen

Marcada como faltante en la corrección del profesor. Se llega desde una notificación
(deep link) o desde el detalle de cursada.

- Materia y comisión.
- Nombre e instancia (parcial, recuperatorio, integrador o final) y fecha del examen.
- Nota y resultado.
- Docente que cargó la nota (de Backoffice), si se puede obtener. El Módulo 2 no expone
  observaciones.
- Enlace para volver al detalle de cursada.

## 4.8 Detalle — Sanción de biblioteca

Pertenece al Módulo 3. Se mockeó solo para representar el flujo de redirección; no se implementa.

- Motivo (préstamo tardío, con días de atraso).
- Monto de la multa.

## 4.9 Calendario académico

- Vista mensual / semanal con filtros por categoría.
- Distinción visual del origen de cada ítem: Comedor / Eventos / Gestión Académica.
- Error parcial: aviso de que no cargó una categoría, con opción de reintentar.

## 4.10 Historial de compras

- Listado: fecha, sede, cantidad de productos, estado y total, con "ver más" (paginación por cursor, sin total) y filtros por fecha, estado y sede (las sedes salen de `GET /sedes`).
- Detalle: productos con imagen, color y talle si es variante, cantidades, precio unitario histórico, subtotal y total.

## 4.11 Saldo / Carga de saldo

- Saldo actual e historial de movimientos.
- Formulario de carga: monto y medio de pago simulado.
- Confirmación: exitosa / fallida / pendiente.

## 4.12 Elementos transversales

- Header: logo, saldo, campana de notificaciones, acceso a perfil y logout. En todas las
  pantallas autenticadas.
- Estados vacíos: sin materias para inscribirse, sin compras, sin notificaciones.
- Estados de error del Gateway: módulo caído (503), respuesta inválida (502), timeout (504).

## Referencia visual (Figma)

https://www.figma.com/design/4HCz5QGVDwbfWGkPsajwUY/TP-Des-Apps-II---UADE-Portal-de-Alumnos

Es una guía de estilo y de navegación, no una especificación 1:1. Si el Figma y este archivo
difieren en qué se muestra, manda este archivo y el contrato.

Lo que se toma:

- Layout: sidebar fija azul oscuro con logo, datos del alumno, navegación y "Cerrar sesión";
  barra superior con el título de la pantalla y la campana. Reemplaza al header de 4.12.
- Cards blancas sobre fondo gris claro, azul como color primario, chips de estado.
- Colores por categoría del calendario: Exámenes azul, Comedor verde, Eventos naranja.
- Login (4.1), Inicio (4.2), Calendario mensual y semanal (4.9), Cuenta corriente y carga de
  saldo (4.11), Centro de notificaciones en página y en dropdown de la campana (4.6).
- Académico con dos pestañas: Historial (4.4, agrupado por cuatrimestre) e Inscripción (4.3),
  con confirmación y aviso de inscripción registrada.
- "Mis Cursos": se usa como listado de cursadas en curso que lleva al detalle de cursada (4.5).

Lo que el Figma muestra y no se implementa (no está en el contrato):

- Perfil con mail personal, celular, aplazos y años utilizados. El perfil muestra solo `GET /me`.
- Promedio general en Inicio (sería lógica académica propia). Sí se pueden contar materias
  aprobadas y en curso a partir de `GET /cursadas`.
- Docente y aula en "Mis Cursos"; filtro por turno en Inscripción (depende de los horarios,
  pedidos al Módulo 9).
- Accesos rápidos a menú del comedor y biblioteca con datos de esos módulos.

Lo que el Figma no tiene y hay que diseñar con el mismo estilo:

- Detalle de cursada (4.5) y detalle de nota (4.7).
- Historial de compras y su detalle (4.10).
- Estados de comisión Inscripto y Bloqueada, con la correlativa faltante (4.3).
- Rechazo de la inscripción (409) y resultado pendiente o rechazado de la carga de saldo.
- Estados vacíos, de carga y de error del Gateway (falla parcial del calendario, 502/503/504).
