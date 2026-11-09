# Organización del equipo

Documento interno: cómo se organiza el trabajo en el repo. No forma parte de la entrega
(está marcado `export-ignore` en `.gitattributes`). Las reglas técnicas están en
[`AGENTS.md`](../AGENTS.md).

Documentos de trabajo relacionados (tampoco van en la entrega):

| Archivo | Para qué |
| --- | --- |
| [`plan.md`](plan.md) | Decisiones tomadas, pasos de armado y pendientes |
| [`demo-guide.md`](demo-guide.md) | Guion de la demo de la segunda entrega |
| [`integracion-real.md`](integracion-real.md) | Qué tocar cuando un módulo confirma su contrato y cómo conectar al CORE real |
| [`core/CORE_INTEGRACION.md`](core/CORE_INTEGRACION.md) | Contrato de integración de CORE (auth, notificaciones, saldo, Gateway) |

## Tablero de Trello

Tablero: https://trello.com/b/zenfbiBW/uadenet-alumnos

Trello es un reflejo del trabajo, no lo dirige: sirve para mostrar cómo se organiza el
equipo y para ver qué falta. Se sincroniza al cerrar cada bloque, no tarea por tarea.

Cada tarjeta lleva la épica entre corchetes y un código (`T` tarea técnica, `H` historia,
`E` entrega) que se cita en los commits. El color de la etiqueta es el riesgo del contrato:
verde firme, amarillo provisional, rojo supuesto.

- **Al planear un bloque:** leer las tarjetas que incluye. Sus criterios de aceptación son
  la especificación de cada tarea.
- **Al cerrar un bloque:** mover sus tarjetas a "En revisión (PR abierto)", comentar el link
  del PR y lo que haya surgido, y crear en "Backlog" las tarjetas de trabajo nuevo.
- **Si un módulo externo confirma o cambia algo:** comentarlo en su tarjeta de
  "Esperando a otros módulos" además de actualizar [`integraciones.md`](integraciones.md).

Si tenés acceso a Trello desde tu herramienta, hacé la sincronización. Si no, avisale a la
persona para que la haga a mano; no la des por hecha.

Límites:

- No mover tarjetas a "Terminado": lo hace una persona después de revisar el PR.
- No modificar la historia ni los criterios de aceptación de una tarjeta. Si parecen
  incorrectos o incompletos, comentarlo y preguntar.
- No archivar ni borrar tarjetas, ni reordenar el Backlog.
- "Terminado" significa que funciona contra el CORE falso. La conexión al módulo real se
  sigue en las tarjetas de "Integración real".

## Forma de trabajo

- Se trabaja por bloques grandes (ver [`plan.md`](plan.md)). Un plan por bloque, revisado con la
  persona antes de arrancar; después se avanza sin frenar entre tarjetas.
- Una rama `bloque/<nombre>` y un PR por bloque. Adentro, un commit por tarjeta con su código
  en el título (`T07: guard JWT`). Se mergea sin squash.
- Si el bloque anterior todavía no está mergeado, la rama nueva sale de la rama de ese bloque
  y su PR apunta a ella (no a `main`). Si el bloque anterior recibe cambios, se traen con
  `git merge`. Cuando se mergea a `main`, se cambia la base del PR nuevo a `main`.
- Cuando un módulo externo confirma o cambia algo, qué archivos y decisiones toca cada módulo: [`integracion-real.md`](integracion-real.md).
- Las reglas técnicas (las que sí van en la entrega) siguen en [`AGENTS.md`](../AGENTS.md).
