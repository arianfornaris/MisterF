# Aprendizajes funcionales de la competencia para Mister F

Fecha de referencia: 20 de julio de 2026

Estado: investigación documental y comparación con el producto actual. Pendiente
de pruebas prácticas uniformes y validación con profesores.

Documentos relacionados:

- [Investigación general de la competencia](./investigacion-de-la-competencia.md)
- [Software educativo utilizado por prospectos](./investigacion-de-software-educativo-de-prospectos.md)
- [Roadmap V3](../roadmap/roadmap-v3.md)

## 1. Conclusión ejecutiva

Mister F no necesita copiar el catálogo completo de ningún competidor. Las
mejores ideas observadas forman un sistema más pequeño y coherente:

1. partir del material y objetivo reales del profesor;
2. convertir una fuente en una secuencia de actividades, no en una pregunta
   aislada;
3. combinar práctica controlada con producción libre;
4. evaluar con criterios visibles y permitir intervención del profesor;
5. transformar errores concretos en la siguiente práctica;
6. devolver al profesor una síntesis que cambie lo que hará en la próxima
   clase.

El ejemplo de *fill in the blank* y *multiple choice* aclara por qué hace falta
comparar contra el producto real. Mister F ya soporta completar espacios —con
entrada libre o con opciones— y opción múltiple —con una o varias respuestas—.
También soporta texto abierto, dos ejercicios de traducción o comprensión,
emparejamiento, ordenar palabras y ordenar oraciones. Esas funciones no son
brechas.

Las brechas estructurales más valiosas encontradas son:

- un estímulo compartido —texto, audio, imagen o video— con varias preguntas
  asociadas;
- corrección explícita de errores;
- formación de palabras a partir de una raíz;
- clasificación de elementos en categorías;
- respuesta oral grabada y, después, análisis de pronunciación;
- selección directa dentro de texto o imagen;
- repaso espaciado derivado de errores y vocabulario reales.

No todas pertenecen al MVP. El aprendizaje más importante de Preply, Langua,
Toddle y Speak es que el valor comercial proviene del ciclo entre la actividad,
la evidencia y la próxima intervención. Añadir tipos de ejercicio antes de
completar ese ciclo haría a Mister F más ancho, pero no necesariamente más útil
ni más vendible.

## 2. Qué significa “copiar” en este documento

“Copiar” significa adoptar un patrón de producto o una solución pedagógica y
volver a implementarla de forma independiente para el segmento de Mister F. No
significa copiar código, textos, contenido editorial, marcas, ilustraciones,
prompts privados ni una interfaz pixel por pixel.

La unidad útil de aprendizaje es el problema resuelto. Por ejemplo:

- de Twee: una fuente puede producir varias actividades editables;
- de Wayground y Canvas: varias preguntas pueden compartir un mismo estímulo;
- de Preply y Langua: los errores de una sesión pueden alimentar la práctica
  posterior;
- de Toddle: el profesor configura el objetivo y el nivel de ayuda;
- de Ellii: el material de referencia permanece visible mientras se responde;
- de ELSA y Rosetta Stone: la producción oral requiere una señal de evaluación
  distinta de la gramática escrita.

## 3. Línea base: lo que Mister F ya soporta

El inventario se verificó en los contratos y renderizadores actuales de quiz,
no solamente en documentación histórica.

| Tipo nativo actual | Qué permite |
| --- | --- |
| Texto abierto | Respuesta escrita libre evaluada con IA |
| Traducir al inglés | Producir una traducción natural en inglés |
| Explicar en español | Demostrar comprensión de una oración inglesa cuando el idioma de instrucción lo permite |
| Completar espacios con texto | Escribir una o varias respuestas dentro de una oración |
| Completar espacios con opciones | Elegir una respuesta por espacio |
| Opción múltiple | Selección única o selección múltiple |
| Emparejar | Relacionar elementos de dos listas |
| Ordenar palabras | Reconstruir una oración con fichas |
| Ordenar oraciones | Organizar una secuencia de oraciones |

Mister F también dispone de roleplays como recurso separado. Por ello, una
conversación guiada no tiene que convertirse necesariamente en un nuevo tipo de
pregunta de quiz.

### Tres estados que deben distinguirse

- **Nativo:** el formato tiene contrato, autoría, renderizado, respuesta,
  evaluación y resultado propios.
- **Representable:** se puede crear hoy con un tipo genérico, aunque el autor y
  los reportes no lo identifiquen con un nombre pedagógico específico.
- **Ausente:** requiere una interacción, un medio o una estructura que el
  modelo actual no puede expresar correctamente.

Esta distinción evita convertir cada nombre comercial en una nueva rama del
protocolo.

## 4. Matriz de formatos de ejercicio

| Formato o comportamiento | Referencias visibles | Estado en Mister F | Decisión recomendada |
| --- | --- | --- | --- |
| Respuesta abierta escrita | Twee, Wayground, Ellii, Canvas | Nativo | Mantener; mejorar rúbrica, ejemplos y revisión docente |
| Traducción de oraciones | Twee, Mango, herramientas generales | Nativo y más específico que muchos competidores | Mantener como fortaleza para adultos multilingües |
| Opción múltiple simple | Todos los creadores de quizzes | Nativo | Mantener |
| Selección múltiple | Wayground, Canvas | Nativo | Mantener; conservar crédito parcial cuando sea pedagógicamente correcto |
| Verdadero o falso | Twee, Wayground, Ellii, Off2Class, Canvas | Representable con opción múltiple | Crear una receta de autoría, no un tipo nuevo, salvo que la analítica futura lo justifique |
| Elegir título o resumen | Twee | Representable con opción múltiple | Añadir como receta de generación |
| *Odd one out* | Twee | Representable con opción múltiple | Añadir como receta de vocabulario, no como contrato nuevo |
| Completar espacios escribiendo | Twee, Wayground, Ellii, Off2Class, Canvas | Nativo | Mantener |
| Completar espacios con opciones por espacio | Twee, Wayground, Canvas | Nativo | Mantener |
| Banco común de palabras arrastrables | Twee, Wayground | Parcial; las opciones existen por espacio, pero no hay banco común | Posponer; mejora de interacción, no primera brecha pedagógica |
| Formación de palabras con raíz dada | Twee | Representable de forma torpe con espacio libre; no se identifica ni evalúa como transformación | Candidato posterior al MVP |
| Dos opciones dentro de una oración | Twee | Representable con opciones por espacio | Añadir como receta o variante visual, no tipo nuevo |
| Corrección de errores | Twee, Langua, Grammarly | Representable con texto abierto, pero sin estructura `original → corrección → explicación` | Candidato fuerte posterior al MVP |
| Reescribir usando una palabra o estructura | Twee, Off2Class | Representable con texto abierto y criterios | Mejorar plantilla y rúbrica antes de crear un tipo nuevo |
| Emparejar palabra y definición | Twee, Ellii, Wayground, Canvas | Nativo | Mantener |
| Emparejar mitades de oraciones | Twee | Nativo mediante emparejamiento | Añadir como receta de generación |
| Emparejar palabra e imagen | Twee, Ellii | Ausente porque los pares actuales son texto | Prioridad media; requiere opciones multimedia |
| Clasificar en categorías | Twee, Wayground, Canvas | Ausente | Candidato fuerte posterior al MVP para vocabulario, gramática y sonidos |
| Ordenar palabras | Twee | Nativo | Mantener |
| Ordenar oraciones, eventos o diálogo | Twee, Wayground, Ellii, Off2Class, Canvas | Nativo | Mantener; añadir recetas de historia y diálogo |
| Seleccionar palabras o fragmentos dentro de un texto | Wayground (*hot text*) | Ausente | Prioridad media para lectura y reconocimiento de errores |
| Etiquetar una imagen | Wayground | Ausente | Prioridad media-baja para vocabulario concreto |
| Elegir una zona de una imagen | Wayground y Canvas (*hotspot*) | Ausente | Posponer salvo demanda de un currículo visual |
| Texto o pasaje con varias preguntas | Wayground, Canvas, Ellii | Ausente en quizzes de profesor; existe diseño de comprensión pendiente | Es la extensión arquitectónica más reutilizable |
| Video con pausas y preguntas | Wayground | Ausente | Posponer; primero validar estímulo de texto y luego audio |
| Escuchar y escribir | Ellii, Twee, English Discoveries | Ausente como experiencia ligada a audio | Prioridad media después del estímulo de audio |
| Respuesta de audio | Wayground, Ellii, Off2Class | Ausente en quizzes | Candidato estratégico posterior al MVP |
| Respuesta de video | Wayground | Ausente | Posponer; agrega fricción, almacenamiento y privacidad sin ventaja clara inicial |
| Repetir, comparar voz o practicar sonidos | Rosetta Stone, Mango, ELSA | Ausente | Explorar después de validar respuesta oral; requiere tecnología y evaluación especializadas |
| *Shadowing* | Langua | Ausente | Experimento posterior, especialmente para ritmo e inteligibilidad |
| Conversación por escenario | Rosetta Stone, ELSA, Speak, Praktika, Preply | Nativo como roleplay, no como quiz | Mejorar objetivos, criterios y práctica derivada; no duplicar el recurso |
| Encuesta sin respuesta correcta | Wayground, Kahoot! | Ausente | Baja prioridad para el segmento inicial |
| Nube de palabras | Wayground, Kahoot! | Ausente | Útil en clase grupal, pero no para el ciclo individual inicial |
| Lluvia de ideas y votación entre pares | Kahoot! | Ausente | Posponer hasta que exista evidencia de grupos sincronizados |
| Dibujo o archivo adjunto | Wayground, Canvas | Ausente | No prioritario para la enseñanza inicial de inglés |
| Tarjetas con repetición espaciada | Langua, Rosetta Stone, Duolingo, Mango, Preply | Ausente como sistema estructurado | Prioridad media-alta cuando pueda alimentarse de errores reales |

### Resultado de la matriz

La mayoría de las herramientas de Twee no exige un nuevo tipo técnico en Mister
F. Verdadero/falso, elegir un título, elegir un resumen, encontrar el elemento
diferente y emparejar mitades son recetas pedagógicas sobre contratos ya
existentes.

Los nuevos contratos solo se justifican cuando cambia al menos una de estas
capas:

- la entrada del estudiante;
- los datos que debe conservar la actividad;
- la lógica de evaluación;
- la representación del resultado;
- el análisis que necesita el profesor.

Con ese criterio, corrección de errores, formación de palabras, categorías,
estímulo compartido y audio sí merecen exploración estructural. “Verdadero o
falso” no la merece todavía.

## 5. Qué aprender de cada competidor directo o funcional

### 5.1. Twee

[Twee](https://twee.com/tools) posee el catálogo de autoría lingüística más
útil para esta comparación. Sus herramientas cubren textos por tema y nivel,
diálogos, vocabulario, preguntas abiertas, ABCD, verdadero/falso, distintas
variantes de espacios, corrección de errores, formación de palabras,
clasificación, *odd one out*, reescritura, audio, video e imágenes.

**Qué adaptar**

- una entrada simple con tema, nivel, vocabulario y fuente;
- acciones enfocadas con nombres docentes comprensibles;
- generar varias actividades coherentes a partir del mismo texto o medio;
- permitir editar, regenerar y exportar sin encerrar al profesor;
- mostrar el nivel CEFR y el propósito de cada actividad;
- ofrecer recetas pedagógicas sobre los nueve contratos actuales antes de
  construir nuevos contratos.

**Qué no copiar**

- una cuadrícula de decenas de generadores como objetivo del MVP;
- el mensaje genérico de “crear materiales con IA”, que Twee ya ocupa a bajo
  precio;
- contenido o interfaz propios de Twee.

**Implicación**

Mister F debe ser más profundo después de la respuesta del estudiante, no más
ancho antes de que exista una respuesta.

### 5.2. Wayground —antes Quizizz—

Wayground documenta tipos básicos, video interactivo, pasajes con preguntas,
emparejamiento, selección dentro del texto, reordenamiento, categorías,
arrastrar y soltar, menús desplegables, etiquetado, zonas de imagen, audio,
video, dibujo, encuestas y nubes de palabras
([tipos de pregunta](https://help.wayground.com/support/solutions/articles/158000411419-question-types-explained)).

**Qué adaptar**

- un estímulo de primer nivel con preguntas hijas;
- importar un documento, página, texto o video y conservar su procedencia;
- explicaciones posteriores a la respuesta;
- crédito parcial para respuestas compuestas;
- rúbricas visibles para producción abierta;
- previsualización real como estudiante;
- la posibilidad de cambiar o editar lo generado por IA.

**Qué no copiar**

- matemáticas, gráficos y formatos de exámenes estatales sin relación con
  inglés adulto;
- una estrategia basada en cantidad de tipos o gamificación general;
- video interactivo antes de validar el patrón con texto.

### 5.3. Kahoot!

Kahoot! combina preguntas puntuadas con encuestas, escalas, respuestas
abiertas, nubes de palabras y lluvia de ideas. Su aportación diferencial es la
experiencia social en vivo, no la profundidad lingüística.

**Qué adaptar**

- separar evaluación de participación: no toda respuesta necesita ser
  correcta o incorrecta;
- revelar patrones del grupo para iniciar una discusión;
- permitir modos sin tiempo ni puntos cuando la ansiedad perjudica la práctica.

**Qué no copiar**

- velocidad, clasificación y presión competitiva como comportamiento por
  defecto para adultos inmigrantes;
- construir funciones sincrónicas antes del flujo asincrónico del MVP.

### 5.4. Ellii

Ellii documenta actividades de referencia, diálogo, emparejamiento con imagen,
emparejamiento textual, ver y deletrear, escritura abierta, completar espacios,
verdadero/falso, opción múltiple, ordenar, secuenciar, diccionario visual,
audio, escritura y habla
([tipos de tarea](https://ellii.com/blog/digital-task-type-demos)).

**Qué adaptar**

- mantener el texto, imagen o audio de referencia visible mientras el
  estudiante responde;
- ordenar tareas desde exposición y práctica controlada hasta producción;
- mostrar respuestas sugeridas sin fingir que existe una única redacción
  válida;
- permitir comentarios del profesor y reintentos;
- conservar tiempo, intento, respuesta y puntuación;
- distinguir primera, última y mejor puntuación;
- combinar versión digital con salida imprimible.

**Qué no copiar**

- intentar crear una biblioteca editorial de miles de lecciones;
- depender de contenido curado propio para que el producto tenga valor.

### 5.5. Off2Class

Off2Class organiza lecciones interactivas con comprensión, verdadero/falso,
opción múltiple, emparejamiento, espacios, construcción de oraciones,
secuencias, roleplays, diálogos, correos, debates e informes. Sus tareas admiten
grabaciones de audio y la empresa está desplegando evaluación automática de
escritura y habla
([actividades](https://help.off2class.com/teacher/can-i-customize-lesson-plans),
[tareas](https://help.off2class.com/features/homework)).

**Qué adaptar**

- secuencias cortas con objetivo comunicativo: comprender, practicar y
  producir;
- apoyo gradual que termina en una actividad más libre;
- respuesta oral asincrónica con revisión y ajuste del profesor;
- notas y criterios visibles para que un profesor pueda impartir con poca
  preparación;
- la actividad posterior como parte de la lección, no como apéndice.

**Qué no copiar**

- currículo completo de 45–60 minutos como requisito de entrada;
- aula de videoconferencia o pizarra propia;
- convertir Mister F en un LMS para instituciones.

### 5.6. Toddle AI Tutors

[Toddle AI Tutors](https://www.toddleapp.com/ai-tutors/) permite que el
profesor aporte objetivo y fuentes, establezca reglas de ayuda, idioma y
modalidad, y luego revise las interacciones e ideas derivadas.

**Qué adaptar**

- una configuración docente explícita: objetivo, fuente, límites, nivel de
  ayuda e idioma;
- trazabilidad entre la intención del profesor, lo que hizo el tutor y la
  evidencia final;
- una vista de conversación o razonamiento disponible para auditoría;
- análisis individual y agregado que termina en una decisión docente.

**Qué no copiar**

- controles administrativos K-12 y adopción de todo el colegio;
- una plataforma escolar integral.

### 5.7. Cambridge One y Richmond

Cambridge One y Richmond combinan contenido editorial, asignaciones,
calificaciones, intentos, tiempo, reportes y, en productos compatibles,
adaptación por nivel.

**Qué adaptar**

- etiquetar nivel, habilidad y objetivo de cada actividad;
- mostrar intento, tiempo, puntuación y progreso sin esconder la respuesta;
- permitir que una misma asignación produzca práctica diferente según el
  estudiante;
- mantener compatibilidad con materiales externos y exportaciones sencillas.

**Qué no copiar**

- un currículo editorial general;
- códigos de acceso, distribución escolar o infraestructura institucional;
- afirmar adaptatividad cuando solo existe selección inicial por nivel.

### 5.8. Preply

Preply une clases humanas con **Lesson Insights**, **Daily Exercises** y
**Scenario Practice**. Las prácticas breves toman vocabulario, gramática y
dificultades de la lección; el tutor puede observar progreso y asignar
escenarios
([anuncio de funciones](https://preply.com/en/blog/preply-announces-new-ai-powered-features-to-guide-the-future-of-personalized-learning-in-a-human-ai-world/),
[flujo entre clases](https://preply.com/en/blog/the-future-of-language-learning/)).

**Qué adaptar**

- el encadenamiento `clase → observación → ejercicio diario → próxima clase`;
- mostrar ejemplos específicos de errores, no solo una calificación;
- práctica de menos de cinco minutos;
- escenarios asignados por el tutor y relacionados con la meta del estudiante;
- medir cuánto valor encuentra cada actor: estudiante y profesor.

**Qué no copiar**

- marketplace, videollamada, calendario y pagos;
- competir primero por tutores cuya relación comercial pertenece a Preply.

Preply confirma que el ciclo humano más IA es una categoría competida. La
ventaja de Mister F debe ser ofrecerlo al profesor que conserva sus propios
clientes y materiales.

### 5.9. Langua

[Langua](https://support.languatalk.com/article/152-see-the-latest-updates-on-langua)
combina conversación, importación de contenido, corrección configurable,
informes posteriores, vocabulario guardado, tarjetas con repetición espaciada,
práctica de pronunciación y *shadowing*. Sus tarjetas utilizan modos de
recuerdo, escucha, producción y espacios
([tarjetas](https://support.languatalk.com/article/136-how-do-the-flashcards-work)).

**Qué adaptar**

- controlar cuándo y con qué intensidad interrumpe la corrección;
- convertir palabras y errores de la conversación en varios modos de repaso;
- compartir un informe sencillo con el tutor;
- recomendar una siguiente actividad pequeña, no abrir siempre un chat vacío;
- importar texto o audio del propio estudiante.

**Qué no copiar**

- otro tutor general de autoaprendizaje como centro comercial;
- memoria opaca que no explique qué dato se conservó y por qué.

### 5.10. Duolingo

Duolingo agrupa revisión de errores, vocabulario, historias, escucha, habla,
llamadas de video y ejercicios breves en su espacio de práctica
([formas de practicar](https://blog.duolingo.com/ways-to-practice-in-duolingo/)).

**Qué adaptar**

- entrada directa a “practica tus errores” o “practica esta habilidad”;
- sesiones cortas y repetibles;
- conversación guiada para principiantes y más libre para niveles altos;
- práctica oral sin penalización que permita repetir y pedir ayuda.

**Qué no copiar**

- XP, ligas, rachas y monetización de juego antes de probar retención por valor
  pedagógico;
- un curso general para todos los idiomas.

### 5.11. Speak

Speak describe un ciclo **Learn → Practice → Apply**: presentar lenguaje,
practicarlo con apoyo y usarlo en una interacción de voz. Sus agentes pueden
seguir objetivos, ofrecer pistas y decidir si avanzar
([plataforma de voz](https://www.speak.com/blog/building-speaks-voice-agent-platform)).

**Qué adaptar**

- convertir cada roleplay en una misión con dos o tres objetivos observables;
- mantener estado de objetivo durante la conversación;
- generar práctica posterior desde el objetivo no alcanzado;
- revisar pedagógicamente el contenido generado por IA.

**Qué no copiar**

- voz como única interfaz;
- agentes y animación complejos antes de validar una conversación con objetivos
  en texto.

### 5.12. ELSA Speak

ELSA separa pronunciación, fluidez, gramática y vocabulario; permite escenarios
preparados o creados por el usuario y entrega retroalimentación después del
roleplay. Su evaluación de pronunciación analiza sonidos, acento prosódico e
entonación
([ELSA AI](https://elsaspeak.com/en/ai/),
[retroalimentación de pronunciación](https://elsaspeak.com/en/faqs/how-does-elsas-pronunciation-feedback-work)).

**Qué adaptar**

- separar inteligibilidad y pronunciación de la corrección gramatical;
- mostrar el fragmento exacto que necesita mejora;
- permitir practicar una situación real definida por el estudiante o profesor;
- repetir una producción después de ver una recomendación concreta.

**Qué no copiar**

- prometer puntuación fonética precisa con un modelo general no validado;
- una biblioteca de miles de lecciones de pronunciación.

### 5.13. Praktika

Praktika utiliza avatares, escenarios de trabajo, viaje y vida cotidiana,
retroalimentación inmediata y rutas que se adaptan a nivel, metas y progreso
([Praktika 4.0](https://praktika.ai/blog/praktika-4-0)).

**Qué adaptar**

- ambiente de práctica oral de baja presión;
- escenarios vinculados con una meta real;
- dificultad progresiva basada en desempeño;
- identificar errores recurrentes y dirigir ejercicios posteriores.

**Qué no copiar**

- avatares como sustituto de valor pedagógico;
- una relación parasocial como propuesta central para el segmento inicial.

### 5.14. Rosetta Stone

Rosetta Stone mezcla asociaciones de imagen y palabra, escucha, escritura,
espacios con fichas, conversaciones simuladas y evaluación de pronunciación.
Sus **Chat Missions** usan escenarios con tres objetivos, mientras **Studio**
puede convertir contenido en lectura adaptada, vocabulario, tarjetas y un juego
de emparejamiento
([ruta de aprendizaje](https://www.rosettastone.com/learning-path),
[Chat Missions](https://www.rosettastone.com/chat-missions),
[Studio](https://support.rosettastone.com/sapphire-studio/)).

**Qué adaptar**

- conversación con pocos objetivos explícitos y posibilidad de repetir;
- reconstruir gradualmente una conversación desde sus partes;
- producir varios recursos coherentes a partir de una misma fuente;
- comparar la voz del estudiante con un modelo sin confundir semejanza con
  comprensión total.

**Qué no copiar**

- inmersión obligatoria para todos los niveles;
- una ruta general de autoestudio que compita con la licencia ya usada por un
  prospecto como Grace Place.

### 5.15. Mango Languages

Mango combina conversación, escucha, lectura, repetición, comparación de voz,
notas culturales, significado literal y natural, y un sistema de repaso
adaptativo. También permite consultar y guardar vocabulario dentro de pasajes
([cómo funciona](https://mangolanguages.com/how-it-works/),
[pasajes interactivos](https://mangolanguages.com/product-features/interactive-reading-passages/)).

**Qué adaptar**

- mostrar significado natural y, cuando ayuda, estructura literal;
- relacionar visualmente partes de una frase entre idiomas;
- ayuda contextual sobre una palabra sin abandonar la lectura;
- guardar una palabra o frase para repasarla después;
- reconstruir expresiones desde bloques pequeños hasta uso conversacional.

**Qué no copiar**

- una biblioteca general distribuida por bibliotecas públicas;
- tratar toda traducción literal como explicación pedagógica suficiente.

### 5.16. English Discoveries

English Discoveries combina niveles, práctica de lectura, escucha, escritura y
habla, retroalimentación automática, pruebas y paneles institucionales
([soluciones](https://edusoftlearning.com/learning-solutions/)).

**Qué adaptar**

- informes por habilidad, no solamente por quiz;
- tiempo, finalización, puntuación e intentos;
- combinación de práctica digital y material imprimible;
- personalización del curso sin reconstruir toda la plataforma.

**Qué no copiar**

- implementación institucional de extremo a extremo;
- requerir capacitación o administración pesada para el primer profesor.

## 6. Competidores indirectos y software presente en prospectos

Estas herramientas no justifican nuevos tipos de ejercicio por sí mismas, pero
sí enseñan cómo Mister F debe convivir con el ecosistema real.

| Producto o familia | Trabajo que ya resuelve | Qué aprender o adaptar | Qué no debe construir Mister F ahora |
| --- | --- | --- | --- |
| ChatGPT | Explicación, generación, archivos, voz y conversación flexible | Aceptar entradas abiertas, reducir el trabajo de redactar un buen prompt y convertir la salida en un flujo verificable | Otro chat vacío cuya calidad dependa solamente del modelo |
| Grammarly | Corrección dentro de donde la persona escribe | Retroalimentación en contexto, explicación breve y aceptación selectiva de cambios | Extensión que observe toda la escritura del usuario |
| DeepL Write | Reformulación, corrección, tono y traducción | Comparar alternativas y explicar matices | Traductor o corrector generalista |
| Google Translate | Texto, voz, cámara y conversación con distribución masiva | Ayuda inmediata y multimodal; convertir voluntariamente una dificultad en práctica | Competir por traducción cotidiana |
| Canvas | LMS, asignaciones, quizzes, estímulos, bancos y reportes | Enlace sencillo, exportación, estímulo con preguntas, bancos etiquetados y futuras integraciones | LMS, SSO o LTI durante el MVP |
| Kajabi | Venta, membresía y distribución de cursos | Enlaces estables, agrupación de recursos y una oferta fácil de insertar en un portal | Comercio, email marketing y hosting de cursos |
| Zoom | Clase en vivo | Funcionar junto a la videollamada y producir una actividad posterior compartible | Videoconferencia propia |
| WellnessLiving | Registro, pagos y agenda | No interferir con la operación comercial existente | Agenda, pagos y CRM para academias |
| LiteracyPro | Registro y gestión de programas de alfabetización | Resumen imprimible o exportable, horas y progreso cuando exista demanda | Reemplazo del sistema administrativo |
| CASAS | Evaluación y seguimiento formal de adultos | Separar práctica formativa de medición oficial; usar resultados autorizados como contexto | Imitar una puntuación oficial o afirmar equivalencia |
| Duolingo English Test | Evaluación de dominio para admisión | Actividades breves que mezclan habilidades y criterios claros | Examen de alta consecuencia sin validación psicométrica |
| Superprof | Descubrimiento de tutores | Entender perfil, confianza, especialidad y canal de adquisición | Marketplace antes de tener oferta y retención |
| Preply como marketplace | Descubrimiento, pago, agenda y clase | El tutor independiente necesita una experiencia comparable sin entregar su relación comercial | Marketplace y videollamada |
| Side by Side | Secuencia curricular y situaciones comunicativas adultas | Unidades predecibles, repetición con variación y contextos funcionales | Copiar contenido editorial protegido o crear un libro general |
| USCIS y FLHSMV | Fuente oficial para objetivos concretos | Procedencia, fecha de versión y enlace a la fuente en cada actividad | Presentarse como autoridad oficial o vender el acceso a información gratuita |

## 7. Patrones transversales que Mister F sí debería adoptar

### 7.1. Una fuente, varias actividades coherentes

El profesor debería poder pegar o adjuntar un material una sola vez y pedir una
secuencia como:

1. vocabulario esencial;
2. comprensión controlada;
3. práctica de una estructura;
4. producción abierta;
5. roleplay o tarea oral;
6. repaso posterior derivado de errores.

Twee, Wayground, Rosetta Stone Studio y Langua muestran distintas versiones de
este patrón. Mister F puede diferenciarlo conservando la procedencia y conectando
los resultados con el perfil del estudiante.

### 7.2. Estímulo como objeto reutilizable

Un texto, audio, imagen o video no debería duplicarse dentro de cada pregunta.
Debe existir una relación visible:

```text
fuente o estímulo
├── vocabulario
├── pregunta de comprensión
├── verdadero/falso
├── producción abierta
└── práctica posterior
```

La lectura es el primer medio razonable. Audio, imagen y video pueden reutilizar
la misma arquitectura después. Esto coincide con el diseño de comprensión ya
existente, pero no justifica reabrir automáticamente su alcance en V3.

### 7.3. Objetivos y rúbricas observables

Cada actividad abierta debería responder:

- ¿qué habilidad intenta demostrar el estudiante?;
- ¿qué constituye éxito, éxito parcial y error?;
- ¿qué variaciones son aceptables?;
- ¿qué puede editar el profesor?;
- ¿qué evidencia verá después?

Wayground, Preply, Toddle y Speak muestran que una IA educativa necesita una
estructura de objetivos, no solamente instrucciones largas.

### 7.4. Del error a una práctica distinta

Repetir la misma pregunta no siempre resuelve la dificultad. Un patrón más útil
es:

| Dificultad observada | Siguiente práctica posible |
| --- | --- |
| Forma verbal incorrecta | Formación o corrección de palabra, luego oración nueva |
| Orden de palabras | Ordenar una oración y después producir otra libremente |
| Vocabulario no recordado | Emparejar, espacio, producción y repaso espaciado |
| Comprensión auditiva | Escucha segmentada y dictado breve |
| Pronunciación poco inteligible | Modelo, repetición, comparación y nueva producción |
| Objetivo de roleplay no alcanzado | Microejercicio y repetición del mismo objetivo en otro contexto |

Este patrón reúne las mejores ideas de Langua, Preply, Duolingo, Speak y
Praktika y encaja directamente con la promesa comercial de Mister F.

### 7.5. Profesor en control, pero sin trabajo repetido

El profesor debe poder:

- revisar antes de publicar;
- editar la propuesta de IA;
- ajustar criterios y nivel de ayuda;
- ver evidencia original, no solo un resumen;
- corregir la evaluación cuando sea necesario;
- reutilizar una actividad o secuencia;
- exportar un resumen sin adoptar un LMS.

La IA debe reducir preparación y corrección, no convertir al profesor en
operador de prompts.

## 8. Priorización para el producto

### 8.1. Dentro del MVP V3

No se recomienda añadir nuevos contratos de ejercicio antes de terminar el
ciclo ya definido en V3:

- profesor crea y comparte;
- estudiante responde y recibe evaluación;
- estudiante practica su dificultad;
- profesor ve intentos y un informe para la próxima clase.

Sí pueden incorporarse aprendizajes competitivos sin ampliar materialmente el
alcance:

1. recetas de generación para verdadero/falso, elegir título, elegir resumen,
   *odd one out*, emparejar mitades y reescritura;
2. objetivo y criterio de éxito más visibles en actividades abiertas;
3. resumen con error concreto, evidencia y siguiente acción;
4. previsualización del resultado como estudiante;
5. medición de tiempo ahorrado y uso de la práctica posterior.

La comprensión con estímulo de texto ya figura como objetivo opcional de V3.
Esta investigación aumenta su valor arquitectónico, pero no cambia su condición
de *stretch goal*: no debe retrasar el piloto docente.

### 8.2. Primer bloque posterior al MVP

El orden recomendado para explorar es:

1. **Estímulo de texto con preguntas asociadas.** Es una base reutilizable para
   lectura y, después, audio, imagen y video.
2. **Corrección de errores.** Se alinea con la evidencia que Mister F ya obtiene
   y produce una interacción distinta y explicable.
3. **Clasificación.** Sirve para vocabulario, partes de la oración, tiempos,
   sonidos y registros.
4. **Formación de palabras.** Es barata visualmente y útil para gramática y
   vocabulario, pero requiere evaluación consciente de transformaciones.
5. **Respuesta de audio.** Tiene gran valor estratégico para inglés adulto,
   aunque añade permisos, almacenamiento, costo y revisión de calidad.

Cada candidato debe superar una prueba con profesores antes de implementarse:

- aparece repetidamente en las tareas reales;
- no puede resolverse bien con un tipo actual;
- cambia una decisión del profesor o una dificultad del estudiante;
- su uso esperado justifica complejidad, costo y mantenimiento.

### 8.3. Segundo bloque

- selección dentro de texto;
- palabras e imágenes y etiquetado visual;
- banco compartido arrastrable;
- dictado y comprensión auditiva;
- tarjetas con repetición espaciada;
- *shadowing* y comparación de voz;
- roleplays con objetivos persistentes y repetición dirigida.

### 8.4. Posponer deliberadamente

- video interactivo con preguntas temporizadas;
- respuesta de video;
- nube de palabras, votación y lluvia de ideas;
- gamificación competitiva extensa;
- avatares animados;
- videollamada, agenda, pagos o marketplace;
- LMS, SSO, LTI y administración institucional;
- biblioteca editorial general;
- puntuaciones que pretendan equivaler a CASAS, CEFR, IELTS, TOEFL o Duolingo
  English Test sin validación apropiada.

## 9. Cómo validar sin exceder el presupuesto

El presupuesto aproximado de USD 60 mensuales impide mantener todos los planes
pagados. La prueba debe ser secuencial y responder una pregunta concreta.

### Prueba funcional común

Usar el mismo material breve de una clase de inglés para adultos y pedir en
cada producto:

1. una actividad de vocabulario;
2. una actividad de comprensión;
3. una producción abierta;
4. una práctica oral, cuando exista;
5. una actividad posterior basada en un error real.

Registrar:

- minutos de preparación;
- número de pasos y cambios de herramienta;
- editabilidad;
- calidad lingüística;
- claridad para el estudiante en móvil;
- tipos de evidencia que recibe el profesor;
- capacidad real de practicar un error individual;
- costo incremental por profesor y estudiante.

### Orden sugerido de pruebas

1. Twee, porque es el competidor de autoría más cercano y accesible.
2. Wayground, por estímulos, multimedia y amplitud de interacciones.
3. Ellii u Off2Class, para observar secuencia docente y resultados.
4. Langua, para observar conversación, corrección y repaso.
5. Preply con un tutor que ya reciba las nuevas funciones, si se consigue acceso
   sin comprometer una suscripción larga.
6. Rosetta Stone en Grace Place, mediante observación autorizada, para entender
   el uso real del laboratorio.
7. Toddle, Cambridge o Richmond únicamente mediante demostración institucional.

No hace falta probar Zoom, Kajabi, WellnessLiving, Canvas o CASAS como si fueran
creadores de ejercicios de inglés. Las entrevistas deben descubrir cómo se
insertaría un enlace, qué reporte puede trasladarse y qué aprobación exigiría
cada entorno.

## 10. Decisiones recomendadas

1. **No añadir verdadero/falso ni elegir-resumen como nuevos contratos.** Son
   recetas sobre opción múltiple.
2. **No vender amplitud de ejercicios como ventaja principal.** Twee y
   Wayground ganarán esa comparación durante mucho tiempo.
3. **Usar el estímulo compartido como arquitectura futura común.** Es más
   valioso que implementar medios por separado.
4. **Priorizar corrección de errores sobre interacciones vistosas.** Conecta la
   evaluación con el aprendizaje y con el informe docente.
5. **Tratar voz como una línea estratégica, no como una casilla.** Respuesta
   oral, transcripción, fluidez, pronunciación e inteligibilidad son problemas
   distintos.
6. **Diseñar la práctica posterior como selección pedagógica.** El sistema debe
   elegir una actividad adecuada al error, no generar otra pregunta al azar.
7. **Conservar evidencia y control docente.** Toda automatización importante
   debe permitir inspección y corrección.
8. **Convivir con el software de los prospectos.** Enlace móvil y reporte
   imprimible son más importantes ahora que integraciones profundas.
9. **Probar con tareas reales antes de promover funciones al roadmap.** La
   existencia de una función competidora demuestra posibilidad, no demanda en
   el segmento inicial.

## 11. Limitaciones

- La investigación se apoya en documentación y páginas públicas; las funciones
  pueden variar por plan, país, licencia y fecha.
- No se ejecutó todavía el mismo ejercicio dentro de todos los productos.
- Algunas funciones institucionales solo pueden observarse mediante una
  demostración o cuenta de cliente.
- Los nombres comerciales de actividades no siempre describen estructuras
  distintas. La matriz compara comportamiento, no marketing.
- Las recomendaciones son hipótesis de producto. Deben contrastarse con
  profesores independientes y estudiantes adultos, especialmente en Naples y
  el sur de Florida.
