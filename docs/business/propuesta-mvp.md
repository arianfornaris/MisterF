# Propuesta de MVP: el ciclo del piloto docente

Fecha de referencia: 18 de julio de 2026

Estado: aprobada por el fundador el 18 de julio de 2026 y aplicada a los
roadmaps técnicos en la misma fecha — el roadmap V3 quedó reenfocado como el
MVP del piloto docente. Registro de decisión técnica:
[Roadmap V3/V4 MVP Adjustment Proposal](../roadmap/roadmap-v3-v4-mvp-adjustment-proposal.md).

Actualización del 18 de julio de 2026: tras discusión con el fundador se
incorporó la decisión de diseño sobre la visibilidad de resultados — permiso a
nivel de recurso (el dueño del quiz), divulgación al inicio del intento como
consentimiento, sin perfiles por rol ni dashboards nuevos en el MVP. La visión
completa de aulas, paquetes y organizaciones quedó capturada como norte de
producto en [Classrooms](../features/classrooms.md), fuera del MVP.

## 1. Propósito

La documentación de negocio ya tomó las decisiones estratégicas clave:

- el foco inicial aprobado son **profesores y tutores independientes que
  enseñan inglés a adultos inmigrantes**, comenzando por el sur de Florida
  ([Roadmap del negocio](./negocio-roadmap.md), sección 5);
- la promesa a validar es: **“Convierte cada tarea y dificultad real en
  práctica guiada, y llega a la próxima clase sabiendo dónde necesita ayuda
  cada estudiante”** ([Investigación de la competencia](./investigacion-de-la-competencia.md),
  sección 13);
- la diferenciación es ser una **capa ligera de continuidad** alrededor del
  material real del profesor, sin LMS escolar ni currículo editorial;
- el plan de 90 días exige llegar a un **piloto con 3 a 5 profesores reales**
  (Fases 2 a 4 del roadmap del negocio).

Lo que falta es definir qué producto mínimo hace posible ese piloto. Esta
propuesta define ese MVP: el conjunto más pequeño de capacidades que permite a
un profesor real ejecutar el ciclo completo prometido, y a Arian medirlo, sin
construir nada que el piloto no necesite.

## 2. Definición del MVP

> **El MVP de Mister F es el ciclo completo del piloto docente:** el profesor
> crea una actividad con su propio material y la comparte por un enlace; el
> estudiante adulto la completa, recibe evaluación inmediata y practica sus
> dificultades; y el profesor ve, antes de su próxima clase, quién la hizo,
> cómo le fue y qué conviene repasar.

El criterio de corte es estricto: una funcionalidad pertenece al MVP solamente
si el piloto de la Fase 4 no puede ejecutarse o medirse sin ella. Todo lo demás
se pospone, aunque esté a medio construir.

## 3. Estado actual del ciclo, paso por paso

La plataforma ya cubre la mayor parte del ciclo. La brecha crítica está en el
paso 5: hoy **el profesor no puede ver ningún resultado de sus estudiantes**.

| # | Paso del ciclo | Estado | Brecha |
| --- | --- | --- | --- |
| 1 | El profesor crea la actividad (quiz) con IA a partir de su material | Casi listo | Las operaciones de modificación con IA por pestaña/bloque están completas en código (roadmap V3, 1.3); falta el QA en vivo. No existe edición manual: corregir una errata exige gastar una inferencia. |
| 2 | El profesor comparte un enlace, sin infraestructura escolar | Listo | Ninguna relevante. Los enlaces compartidos e intentos de invitados ya funcionan. |
| 3 | El estudiante completa la tarea y recibe evaluación inmediata | Listo con condición | La evaluación exige cuenta y consume créditos del propio estudiante. Para el piloto hace falta una política de créditos definida (ver sección 5.C). |
| 4 | El estudiante practica sus dificultades con el tutor | Listo | La conversación de seguimiento a partir del resultado ya existe. |
| 5 | El profesor recibe evidencia para la próxima clase | **No existe** | No hay vista de intentos, ni resultados por estudiante, ni síntesis de dificultades. Es el corazón de la promesa aprobada y la única parte del ciclo totalmente ausente. |
| 6 | Arian mide el embudo del piloto | Parcial | Existen eventos de progreso del estudiante, pero hay que verificar que el embudo del piloto (invitado → inicia → completa → revisa → practica → el profesor consulta el reporte) sea medible, aunque sea con consultas manuales. |

## 4. Qué incluye el MVP

En orden de importancia:

### A. Visibilidad de resultados para el dueño del quiz

Decidido el 18 de julio de 2026: **sin perfiles de profesor ni dashboards
nuevos**. El permiso es del recurso: quien creó y compartió el quiz ve los
intentos de ese quiz, dentro de la propia página del quiz (una sección
"Resultados" con la lista de intentos — quién, cuándo, completado o no,
resultado general — y el detalle de cada intento evaluado). Los intentos de
prueba del propio dueño (`Probar`) quedan excluidos de esa lista. Es la
condición mínima para que la promesa deje de ser una frase.

**Flag de feedback al compartir (decidido el 20 de julio de 2026).** Al
compartir, el dueño elige si quiere recibir los resultados de quienes
completen la actividad. El flag vive en el enlace compartido (no en el quiz),
de modo que un mismo quiz puede tener un enlace con feedback para su clase y
otro sin feedback compartido como simple contenido. Cada intento congela el
estado del flag al comenzar: activarlo después nunca expone intentos hechos
sin aviso. Para el flujo del profesor viene activado por defecto.

**Modelo de consentimiento: divulgación al inicio.** Cuando el enlace
recolecta resultados, el estudiante ve un aviso claro — antes de responder —
de que quien compartió la actividad verá sus respuestas y su evaluación;
comenzar el intento constituye el consentimiento. Si el flag está apagado no
hay recolección y no hace falta aviso. Piloto solo con adultos. Se descartó el
opt-in por estudiante para el resultado de la tarea, porque un reporte con
huecos rompe la promesa al profesor.

La **práctica posterior** sí es territorio del estudiante: compartirla con el
profesor será una acción voluntaria ("Compartir mi práctica con el profesor")
y queda fuera del MVP como fase posterior.

Ampliación del 18 de julio de 2026: el MVP incluye también una vista agregada
**"Compartido por mí"** — una página con los recursos que el usuario ha
compartido (quizzes, guías de práctica y roleplays, cuyo compartir ya
existe), cuántos intentos tiene cada uno y quiénes los practicaron, como
punto de entrada del guía. Sin roles ni entidades nuevas, esta misma
primitiva (compartir → practicar → el resultado vuelve a quien compartió)
sirve al profesor con sus estudiantes, al tutor privado y a un padre con
cuenta propia; el caso padre-hijo funciona hoy con perfiles múltiples dentro
de la cuenta del padre. El MVP devuelve resultados solo de quizzes, pero las
piezas transversales (aviso de consentimiento, vista agregada, rutas) se
construyen genéricas por tipo de recurso, porque el mismo ciclo se extiende
a roleplays y guías en la siguiente iteración — la regla es que la
divulgación sigue a la asignación, no al tipo de recurso. La fórmula completa
está en [Classrooms](../features/classrooms.md).

### B. El reporte para la próxima clase

Una síntesis por quiz, accionable en minutos: qué preguntas fallaron más, qué
dificultades se repiten, qué estudiantes necesitan ayuda y con qué, y quiénes
continuaron practicando. Primera versión: agregación determinista de los
resultados ya persistidos, con un resumen opcional generado por IA (con cargo a
los créditos del profesor). No necesita dashboards ni gráficas; una página
clara es suficiente para el piloto.

### C. Política de créditos del piloto

Sin infraestructura nueva: el panel `superadmin` ya permite ajustar el límite
de créditos por usuario, de modo que Arian puede habilitar manualmente a los
profesores y estudiantes del piloto. Lo que falta es la política escrita:
límites por participante, duración, qué pasa al agotarse, y el costo máximo
total del piloto para que quepa en el presupuesto de USD 60
([Presupuesto inicial](./presupuesto-inicial.md)). La medición del costo real
de IA por ciclo completo forma parte del piloto (alimenta el margen de
contribución de la Fase 5).

### D. QA en vivo de la autoría de quizzes

Las cuatro operaciones de modificación con IA (General, Bloques, por bloque,
agregar bloque) están completas en código con 181 pruebas verdes; falta el
recorrido manual con sesión real e inferencia real. Es la última milla del
paso 1 del ciclo.

### E. Edición manual mínima para el profesor

Recomendado con alcance reducido: permitir corregir texto directamente al menos
en los tipos de ítem más comunes, sin gastar inferencias. Un profesor piloto
encontrará erratas; obligarlo a pagar una inferencia y esperar una vista previa
por cada corrección menor daña la confianza en la herramienta. Si el costo de
implementación amenaza el calendario, puede reducirse aún más (por ejemplo,
solo instrucciones y enunciados), pero no debería eliminarse del todo.

### F. Instrumentación del embudo

Verificar que cada paso del embudo del piloto queda registrado y es consultable
(aunque sea con SQL manual). Sin esto, el piloto termina y no se puede
responder a los indicadores de la Fase 4 del roadmap del negocio.

### Opcional (colchón, no compromiso)

- **Comprensión de lectura (Fase 1 del roadmap V3):** reutiliza el pipeline de
  quizzes, es barata, y daría a los profesores un tipo de actividad más. Entra
  solo si el resto del MVP está terminado.

## 5. Qué queda explícitamente fuera del MVP

Nada de esta lista es un juicio de valor; es disciplina de foco
([Contexto del fundador](./contexto-del-fundador.md), sección 6.1).

- comprensión auditiva y de imágenes (fases 2 y 3 de comprensión);
- el resto de la biblioteca de medios de escena (bloque `scene_media` en el
  tutor, derivación de recursos, flujo paso a paso, control de voces);
- mensajes de voz en roleplays;
- estandarización CEFR de toda la aplicación;
- aulas, rosters, paquetes de actividades, organizaciones, paneles
  institucionales o cualquier capa de LMS (visión capturada en
  [Classrooms](../features/classrooms.md));
- créditos regalados entre cuentas y cuentas gestionadas (cuenta master con
  sub-cuentas y sus créditos) — etapas 4 y 5 de la escalera en
  [Classrooms](../features/classrooms.md), decididas el 18 de julio de 2026
  para otra iteración;
- perfiles diferenciados de profesor y estudiante, y homes o dashboards por
  rol;
- landing page pública de producto (se retoma al iniciar la captación de
  profesores, no bloquea la mecánica del piloto);
- envío voluntario del reporte de práctica del estudiante al profesor (fase
  posterior al MVP);
- retorno de resultados de roleplays (evaluación + transcripción del intento)
  y de guías de práctica (reporte finalizado de la sesión, no el chat crudo)
  — primera extensión candidata tras el MVP, sobre la superficie genérica que
  el MVP deja construida;
- programa de referidos automatizado (sigue el plan de validación manual de
  [Programa de referidos y creadores](./programa-de-referidos-y-creadores.md));
- marketplace o economía de creadores;
- menores de edad;
- publicidad pagada o landing pages elaboradas;
- generalización de andamiaje de traducción a otros idiomas de apoyo.

## 6. Criterios de éxito del MVP

El MVP está terminado cuando, en producción:

1. Arian puede incorporar a un profesor en menos de 30 minutos, con una guía
   escrita;
2. el profesor crea y comparte su primera actividad con su propio material en
   una sola sesión;
3. un estudiante adulto la completa desde el teléfono, recibe evaluación y
   puede iniciar práctica de seguimiento;
4. el profesor consulta el reporte y puede decir qué haría distinto en su
   próxima clase;
5. cada paso anterior queda medido, y el costo de IA del ciclo completo es
   conocido;
6. todo ocurre dentro del presupuesto operativo actual.

Estos criterios habilitan directamente los indicadores ya definidos en la
Fase 4 del [Roadmap del negocio](./negocio-roadmap.md). El éxito del *piloto*
(uso repetido, disposición a pagar) se mide allí; este documento solo define
cuándo el producto está listo para intentarlo.

## 7. Riesgos de esta propuesta

- **El reporte revela datos del estudiante al profesor.** Mitigación: el
  modelo de divulgación al inicio (el aviso se ve antes de responder y
  comenzar es el consentimiento), piloto solo con adultos, práctica posterior
  compartida solo por opt-in, y revisión de los términos antes de incorporar
  profesores ajenos a la familia.
- **El costo de IA del piloto se descontrola.** Mitigación: límites por
  usuario vía superadmin, tope total del piloto definido por escrito antes de
  empezar.
- **La edición manual crece sin control (nueve tipos de ítem).** Mitigación:
  alcance explícitamente reducido a los tipos más comunes; el resto sigue en
  el backlog.
- **Construir el reporte antes de las entrevistas de la Fase 2.** El reporte es
  parte de la promesa aprobada, así que el riesgo es bajo, pero las entrevistas
  pueden cambiar su contenido ideal. Mitigación: primera versión determinista y
  barata; no invertir en sofisticación hasta ver profesores usándolo.

## 8. Decisiones que corresponden al fundador

1. Aprobar o ajustar esta definición de MVP.
2. Decidir si la comprensión de lectura entra como opcional o se pospone por
   completo.
3. Fijar la política de créditos del piloto: montos, tope total y duración.
4. Decidir si el piloto será gratuito, con depósito o condicionado a
   compromisos de participación (decisión ya listada en el roadmap del
   negocio, sección 9).
5. Aprobar el texto de divulgación al estudiante sobre la visibilidad de sus
   resultados.
