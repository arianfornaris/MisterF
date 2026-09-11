/* Resource screens: dedicated entrypoints with shared, explicit fragments. */
function renderQuizDetail() {
  return `${resourceHeading("quiz", "Small talk, big connections")}${actionRow(link("quiz-attempt", icon("play-fill") + (mode === "teach" ? " Probar quiz" : " Empezar quiz")), "quiz")}
  <div class="detail-grid"><section><div class="card detail-cover"><img src="assets/workplace.png" alt="Compañeros conversando en una sala de descanso"><div class="card-body"><div class="d-flex gap-2 mb-3">${badge("Quiz", "peach")}${badge("A2", "peach")}${badge("3 preguntas", "peach")}</div><h2 class="editorial fs-2">Rompe el hielo, una frase a la vez.</h2><p>Practica cómo saludar, hacer una pregunta y mantener una conversación breve con tus compañeros.</p></div></div><div class="section-head"><h2>Lo que vas a practicar</h2></div><div class="card p-4"><ol class="spaced-list"><li>Elegir una expresión amable.</li><li>Completar una pregunta cotidiana.</li><li>Responder con tus propias palabras.</li></ol></div></section><aside><div class="card p-4"><h3>Un pequeño reto</h3><p class="small">Lee con calma. Al terminar podrás revisar tus respuestas y seguir practicando lo que te resulte difícil.</p>${link("quiz-attempt", "Comenzar " + icon("arrow-right"))}</div><section class="card p-4 mt-3"><h3>${mode === "teach" ? "Participación" : "Tu última práctica"}</h3><p class="small">${mode === "teach" ? "8 participaciones completadas. Un punto de partida para tu siguiente actividad." : "Una práctica completada · 2 de 3 respuestas correctas."}</p>${link(mode === "teach" ? "quiz-participation" : "quiz-result", mode === "teach" ? "Ver participación" : "Ver mi resultado", "")}</section>${mini("quiz")}</aside></div>`;
}

function renderRoleplayDetail() {
  return `${resourceHeading("roleplay", "At the restaurant")}${actionRow(link("roleplay-attempt", icon("play-fill") + (mode === "teach" ? " Probar roleplay" : " Entrar al restaurante")), "roleplay")}
  <section class="card hero tone-lilac"><div class="hero-copy"><div class="kicker">Tu misión</div><h2>Una cena.<br>Muchas formas de conectar.</h2><p>Consigue una mesa, pregunta por el menú y pide algo que te guste. Sofía será tu camarera.</p><div class="d-flex gap-2">${badge("A2", "lilac")}${badge("≈ 8 min", "lilac")}</div></div><div class="hero-scene"><img src="assets/restaurant.png" alt="Comida y conversación en un restaurante"></div></section>
  <div class="row g-4 mt-1"><div class="col-lg-7"><section class="card p-4 h-100"><h2>Una conversación con propósito</h2><ol class="spaced-list"><li>Pide una mesa para dos personas.</li><li>Pregunta por los ingredientes de un plato.</li><li>Pide la cuenta de forma amable.</li></ol><p class="small mb-0">Puedes usar distintas expresiones. Lo importante es comunicar tu intención.</p></section></div><div class="col-lg-5"><section class="card p-4 h-100"><div class="character-profile"><img src="assets/sofia.png" alt="Retrato de Sofía"><div><h3>Conoce a Sofía</h3><p class="small">Camarera · Cercana y paciente</p><p class="editorial">“Hi! Welcome. A table for two?”</p></div></div></section></div></div><div class="section-head"><h2>${mode === "teach" ? "Para acompañar la práctica" : "Tu recorrido aquí"}</h2>${link(mode === "teach" ? "roleplay-participation" : "roleplay-result", "Ver " + (mode === "teach" ? "participación" : "resultado"), "")}</div>`;
}

function renderGuideDetail() {
  return `${resourceHeading("guide", "Ready for takeoff")}${actionRow(link("guide-session", icon("play-fill") + " Iniciar práctica guiada"), "guide")}
  <div class="detail-grid"><section class="card detail-cover"><img src="assets/airport.png" alt="Viajeros preparándose para pasar el control del aeropuerto"><div class="card-body"><div class="kicker">Inglés que te acompaña</div><h2 class="editorial fs-2">Tu próximo viaje empieza con una conversación.</h2><p>Un tutor te ayuda a practicar las preguntas y expresiones que podrías necesitar en el aeropuerto.</p><div class="d-flex gap-2">${badge("A2")}${badge("Guía de práctica")}${badge("≈ 12 min")}</div></div></section><aside><section class="card p-4"><h3>Así será la práctica</h3><ol class="spaced-list"><li><strong>Prepara tus palabras.</strong><p class="small">Boarding pass, gate, carry-on.</p></li><li><strong>Ensaya una situación.</strong><p class="small">Pregunta dónde está tu puerta de embarque.</p></li><li><strong>Revisa lo aprendido.</strong><p class="small">Recibe sugerencias para continuar.</p></li></ol>${link("guide-report", "Ver informe de ejemplo", "btn btn-outline-secondary")}</section></aside></div>`;
}

function withoutHeading(markup) {
  return markup.replace(/^[\s\S]*?<\/header>/, "");
}
function renderQuizNew() {
  selectedType = "quiz";
  return resourceHeading("quiz", "Nuevo quiz") + withoutHeading(renderCreate());
}
function renderRoleplayNew() {
  selectedType = "roleplay";
  return (
    resourceHeading("roleplay", "Nuevo roleplay") +
    withoutHeading(renderCreate())
  );
}
function renderGuideNew() {
  selectedType = "guide";
  return (
    resourceHeading("guide", "Nueva guía de práctica") +
    withoutHeading(renderCreate())
  );
}

function editorLayout(kind, title, body, preview) {
  return `${resourceHeading(kind, title, "Editando", "library", kind + "-detail")}<div class="editor-toolbar"><span class="small">${icon("pencil-square")} Borrador de ejemplo</span><div class="d-flex gap-2">${link(kind + "-detail", "Ver actividad", "btn btn-outline-secondary btn-sm")}<button class="btn btn-outline-secondary btn-sm" data-bs-toggle="modal" data-bs-target="#revision-modal">${icon("stars")} Modificar con IA</button></div></div><div class="create-layout"><section class="card p-4"><form data-local-form>${body}${localSave()}</form></section><aside class="card p-4 tone-${kind === "quiz" ? "peach" : kind === "roleplay" ? "lilac" : "mint"}"><div class="kicker">Vista previa del formato</div>${preview}<p class="notice">Ejemplo visual. Los campos del formulario se pueden editar; esta vista previa es ilustrativa.</p></aside></div>${revisionModal(kind)}`;
}

function revisionModal(kind) {
  return `<div class="modal fade" id="revision-modal" tabindex="-1" aria-labelledby="revision-title" aria-hidden="true"><div class="modal-dialog modal-dialog-centered modal-lg"><div class="modal-content"><div class="modal-header"><h2 id="revision-title" class="modal-title fs-5">Dale otra vuelta a tu actividad</h2><button class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button></div><div class="modal-body"><label for="revision-prompt" class="form-label">¿Qué quieres ajustar?</label><textarea id="revision-prompt" class="form-control" rows="3" placeholder="Por ejemplo: simplifica el vocabulario y añade una situación más cotidiana."></textarea><p class="notice">Revisión predefinida de ejemplo; no se realiza una petición de IA.</p><div id="revision-preview" class="d-none tone-mint rounded p-3 mt-3"><h3 class="h6">Propuesta para revisar</h3><p class="small mb-0">Objetivo más concreto: practicar tres expresiones para pedir ayuda con amabilidad en una situación cotidiana. El original se mantiene hasta que apliques la propuesta.</p></div></div><div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button><button class="btn btn-primary" data-revision-preview>Ver propuesta de ejemplo</button><button class="btn btn-primary d-none" data-revision-apply>Aplicar al borrador de ejemplo</button></div></div></div></div>`;
}

function renderQuizEditor() {
  return editorLayout(
    "quiz",
    "Small talk, big connections",
    `${field("editor-title", "Título", "Small talk, big connections")}${textField("editor-description", "Descripción", "Practica cómo empezar una conversación cotidiana con tus compañeros.", 3)}<hr><h2 class="h5 mb-3">Bloques del quiz</h2><div id="editor-blocks"><div class="editor-block"><div class="kicker">01 · Selección</div>${textField("question-1", "Pregunta", "Which expression sounds more polite?", 2)}${field("option-a", "Opción A", "Give me a coffee.")}${field("option-b", "Opción B · Correcta", "Could I have a coffee?")}</div></div><button type="button" class="btn btn-outline-secondary btn-sm mb-4" data-add-block>${icon("plus-lg")} Añadir bloque</button>`,
    `${mini("quiz")}<div class="large-paper"><h3>Make it polite.</h3><p class="small">Choose the best answer.</p><div class="answer">Give me a coffee.</div><div class="answer correct">Could I have a coffee?</div></div>`,
  );
}

function renderRoleplayEditor() {
  return editorLayout(
    "roleplay",
    "At the restaurant",
    `${field("editor-title", "Título", "At the restaurant")}${textField("editor-description", "Situación y objetivo", "Estás en un restaurante. Consigue una mesa, pregunta por los ingredientes y pide la cuenta.", 4)}<h2 class="h5 mt-4">Personaje</h2><div class="character-profile mb-3"><img src="assets/sofia.png" alt="Sofía"><div><strong>Sofía</strong><p class="small mb-0">Camarera · Cercana y paciente</p></div></div>${field("character-name", "Nombre", "Sofía")}${textField("character-role", "Papel e instrucciones", "You are a friendly server. Help the learner order food. Ask one question at a time.", 4)}${field("opening-line", "Primer mensaje", "Hi! Welcome. Would you like a table for two?")}`,
    `${mini("roleplay")}<div class="large-paper"><h3>A table for two?</h3><p class="small">Objetivo: pedir una mesa y ordenar con amabilidad.</p><div class="answer">“Hi! Welcome to our restaurant.”</div></div>`,
  );
}

function renderGuideEditor() {
  return editorLayout(
    "guide",
    "Ready for takeoff",
    `${field("editor-title", "Título", "Ready for takeoff")}${textField("editor-description", "Descripción", "Prepárate para las conversaciones del aeropuerto.", 3)}${textField("guide-instructions", "Instrucciones para el tutor", "Ayuda a practicar preguntas para orientarse en un aeropuerto. Presenta vocabulario útil, ensaya una conversación y termina con una revisión breve.", 6)}${textField("guide-context", "Contexto de la práctica", "La persona viaja sola por primera vez y quiere preguntar por su puerta de embarque.", 3)}`,
    `${mini("guide")}<div class="large-paper"><h3>One step at a time.</h3><ol class="spaced-list"><li>Preparar vocabulario</li><li>Ensayar una situación</li><li>Revisar lo aprendido</li></ol></div>`,
  );
}

function renderQuizAttempt() {
  return `${resourceHeading("quiz", "Small talk, big connections", "Practicando", "library", "quiz-detail")}<div class="attempt-wrap"><div class="d-flex justify-content-between align-items-center mb-3">${badge("A2 · 3 preguntas", "peach")}${link("quiz-detail", "Salir del quiz", "btn btn-outline-secondary btn-sm")}</div><div class="tone-peach rounded p-4 mb-4"><h2 class="editorial fs-2">Una conversación empieza con algo pequeño.</h2><p class="mb-0">Lee, elige y prueba con tus propias palabras. Puedes revisar antes de terminar.</p></div><form id="quiz-attempt-form"><section class="card p-4 mb-3"><div class="kicker">01 · Elige una respuesta</div><fieldset><legend class="h5" lang="en">Which request sounds more polite?</legend><label class="answer"><input type="radio" class="form-check-input me-2" name="quiz-one" value="direct" required> Give me a coffee.</label><label class="answer"><input type="radio" class="form-check-input me-2" name="quiz-one" value="polite"> Could I have a coffee?</label></fieldset></section><section class="card p-4 mb-3"><div class="kicker">02 · Completa la pregunta</div>${field("quiz-two", "How ___ your weekend?", "", "text")}<p class="small mb-0">Piensa en algo que ya pasó.</p></section><section class="card p-4 mb-4"><div class="kicker">03 · Tu turno</div>${textField("quiz-three", "Tell a coworker one thing you did last weekend.", "", 3)}</section><button class="btn btn-primary" type="submit">Terminar y revisar ${icon("arrow-right")}</button><p class="notice">El resultado usa tus respuestas de selección y de completar. La respuesta abierta recibe comentarios de ejemplo.</p></form></div>`;
}

function renderQuizEvaluating() {
  return `${resourceHeading("quiz", "Small talk, big connections", "Evaluando", "library", "quiz-detail")}<section class="card state-card"><div class="state-symbol tone-peach">${icon("hourglass-split")}</div><div class="kicker">Un momento para mirar lo aprendido</div><h2 class="editorial fs-2">Tus respuestas cuentan una historia.</h2><p>En el producto, aquí se prepararía la evaluación. En este demo puedes explorar los dos estados siguientes.</p><div class="d-flex justify-content-center flex-wrap gap-2">${link("quiz-result", "Ver resultado de ejemplo")}${link("error", "Ver estado de error", "btn btn-outline-secondary")}</div></section>`;
}

function renderQuizResult() {
  const attempt = demoState.quiz;
  const score = attempt ? Number(attempt.polite) + Number(attempt.past) : 2;
  return `${resourceHeading("quiz", "Una buena forma de empezar.", "Resultado", "library", "quiz-detail")}<section class="card result-banner tone-mint"><div><div class="kicker">Small talk, big connections</div><h2 class="editorial fs-2">Cada intento te da algo para la próxima conversación.</h2><p>${attempt ? "Revisa tus respuestas y sigue practicando." : "Resultado ilustrativo de una práctica anterior."}</p><div class="d-flex flex-wrap gap-2">${link("conversation", "Practicar con el tutor")}${link("quiz-detail", "Volver al quiz", "btn btn-outline-secondary")}</div></div><div class="result-number"><strong>${score}/2</strong><span>respuestas cerradas correctas</span></div></section><div class="section-head"><h2>Revisemos juntos</h2></div><div class="card p-4 mb-3"><h3>${icon(attempt && !attempt.polite ? "arrow-repeat" : "check-circle")} Una petición amable</h3><p class="editorial fs-4">“Could I have a coffee?”</p><p class="small mb-0">“Could I have…?” permite pedir algo con amabilidad.</p></div><div class="card p-4 mb-3"><h3>${icon(attempt && !attempt.past ? "arrow-repeat" : "check-circle")} Hablar del pasado</h3><p class="editorial fs-4">“How was your weekend?”</p><p class="small mb-0">Usamos “was” porque el fin de semana ya pasó.</p></div><div class="card p-4"><h3>${icon("chat-dots")} Tu respuesta abierta</h3><p>${escapeHTML(attempt?.writing || "I went to the beach with my family.")}</p><p class="small mb-0">Comentario de ejemplo, sin evaluación de IA: intenta añadir un detalle sobre dónde estuviste o con quién.</p></div>`;
}

function renderRoleplayAttempt() {
  return `${resourceHeading("roleplay", "At the restaurant", "Practicando", "library", "roleplay-detail")}<div class="d-flex flex-wrap gap-2 mb-3">${badge(mode === "teach" ? "Prueba del autor" : "Tu conversación", "lilac")}${link("roleplay-result", "Finalizar y ver ejemplo de resultado", "btn btn-outline-secondary btn-sm")}</div>${renderChat().replace(/^[\s\S]*?<div class="chat-layout">/, '<div class="chat-layout">')}`;
}

function renderRoleplayResult() {
  return `${resourceHeading("roleplay", "Pediste tu mesa. Y algo más.", "Resultado", "library", "roleplay-detail")}<section class="card result-banner tone-lilac"><div><div class="kicker">At the restaurant · Ejemplo</div><h2 class="editorial fs-2">Hiciste que la conversación avanzara.</h2><p>Pediste una mesa y preguntaste por el menú. Tus peticiones fueron claras y amables.</p><div class="d-flex flex-wrap gap-2">${link("conversation", "Seguir practicando")}${link("roleplay-detail", "Volver al roleplay", "btn btn-outline-secondary")}</div></div><img class="result-portrait" src="assets/sofia.png" alt="Sofía"></section><div class="row g-3 mt-2"><div class="col-md-6">${featureNote("mint", "check-circle", "Lo que funcionó", "Usaste “Could we…?” para pedir una mesa. También agradeciste la ayuda de Sofía.")}</div><div class="col-md-6">${featureNote("peach", "signpost-split", "Tu siguiente paso", "Practica una pregunta para pedir recomendaciones: “What would you recommend?”")}</div></div><div class="section-head"><h2>Un momento de la conversación</h2></div><section class="card p-4"><p class="small">TÚ</p><p class="editorial fs-4">“Could we sit by the window?”</p><div class="tone-mint rounded p-3 small">${icon("check-circle")} Tu intención se entiende y la pregunta suena amable.</div></section>`;
}

function participationSummary(kind, title, focus) {
  return `${resourceHeading(kind, title, "Participación", "library", kind + "-detail")}<section class="card library-banner tone-blue"><div><div class="kicker">Una lectura para acompañar</div><h2>${focus}</h2><p>Datos y resumen de ejemplo. Úsalos para explorar cómo se presentaría la información.</p></div></section><div class="stats"><div class="card stat"><strong>8</strong><span>Participaciones<br>completadas</span></div><div class="card stat"><strong>2</strong><span>En curso</span></div><div class="card stat"><strong>10</strong><span>Participaciones<br>en total</span></div></div><div class="section-head"><h2>Participaciones recientes</h2>${link(kind + "-new", "Crear refuerzo", "btn btn-outline-secondary btn-sm")}</div><div class="card table-responsive"><table class="table mb-0"><thead><tr><th>Perfil de ejemplo</th><th>Actividad</th><th>Estado</th><th>Detalle</th></tr></thead><tbody>${["Alex", "Sam", "Jordan", "Taylor"].map((name, index) => `<tr><td>${name}</td><td>${title}</td><td>${badge(index === 3 ? "En curso" : "Completada", index === 3 ? "blue" : "mint")}</td><td>${index === 3 ? "—" : link(kind === "guide" ? "guide-report" : kind + "-result", "Ver resultado", "")}</td></tr>`).join("")}</tbody></table></div>`;
}
function renderQuizParticipation() {
  return participationSummary(
    "quiz",
    "Small talk, big connections",
    "Las preguntas amables merecen otra práctica.",
  );
}
function renderRoleplayParticipation() {
  return participationSummary(
    "roleplay",
    "At the restaurant",
    "Pedir algo resulta más fácil que pedir una recomendación.",
  );
}
function renderGuideParticipation() {
  return participationSummary(
    "guide",
    "Ready for takeoff",
    "El vocabulario ya aparece en conversaciones.",
  );
}

function tutorSession(title, opening, origin, finish) {
  return `${heading("Conversación con Mister F", title, "Un espacio para probar tus ideas en inglés.")}${tabs(
    [
      ["Conversación", page],
      ["Resumen", finish],
    ],
    page,
  )}<div class="chat-layout"><section class="card chat-session"><div class="chat-person"><img src="assets/brand.png" alt=""><div><strong>Mister F</strong><p>${origin}</p></div></div><div id="tutor-messages" aria-live="polite"><div class="chat-bubble tone-mint"><small>MISTER F · EJEMPLO</small>${opening}</div></div><div class="d-flex flex-wrap gap-2 mt-4"><button class="filter" data-tutor-suggestion="Could you help me find my gate?">Pedir ayuda</button><button class="filter" data-tutor-suggestion="I went to the beach last weekend.">Contar mi fin de semana</button></div><form id="tutor-form" class="chat-compose"><input class="form-control" id="tutor-input" aria-label="Mensaje para Mister F" placeholder="Escribe en inglés…" required maxlength="500"><button class="btn btn-primary" aria-label="Enviar mensaje">${icon("arrow-up")}</button></form><p class="notice">Respuestas predefinidas. Sin IA ni guardado.</p>${link(finish, "Finalizar y ver resumen", "btn btn-outline-secondary btn-sm")}</section><aside class="card p-4 tone-mint"><div class="kicker">A tu ritmo</div><h3>Una frase es suficiente para empezar.</h3><p class="small">Si no sabes una palabra, intenta explicarla con las que ya conoces.</p>${mini("chat")}</aside></div>`;
}
function renderGuideSession() {
  return (
    resourceHeading(
      "guide",
      "Ready for takeoff",
      "Práctica",
      "library",
      "guide-detail",
    ) +
    withoutHeading(
      tutorSession(
        "Un paso más cerca de tu puerta.",
        "Vamos a ensayar una pregunta útil. You are at the airport. How would you ask someone where your gate is?",
        "Guía · Ready for takeoff",
        "guide-report",
      ),
    )
  );
}
function renderTutorConversation() {
  return tutorSession(
    "¿De qué hablamos hoy?",
    "Hi, Alex! Tell me one thing about your day. It can be something small.",
    "Tu tutor de inglés",
    "conversation-summary",
  );
}

function summaryBody(title, context) {
  return `${heading(context, title, "Resumen ilustrativo de tu práctica.")}<div class="d-flex flex-wrap gap-2 mb-4">${link("conversation", "Practicar lo que sigue")}${link("create", "Crear una actividad", "btn btn-outline-secondary")}</div><section class="card p-4 mb-4"><h2 class="editorial fs-2">Encontraste las palabras para pedir ayuda.</h2><p>Usaste una pregunta amable, aclaraste lo que necesitabas y agradeciste la respuesta.</p><blockquote class="tone-mint rounded p-4 mb-0 editorial fs-4">“Could you help me find my gate?”</blockquote></section><div class="row g-3"><div class="col-md-6">${featureNote("mint", "check-circle", "Fortalezas", "Tus preguntas tienen una intención clara. “Could you help me…?” es una expresión que puedes usar en muchas situaciones.")}</div><div class="col-md-6">${featureNote("peach", "arrow-right", "Próximo paso", "Intenta hacer una segunda pregunta para confirmar: “Is it on the second floor?”")}</div></div>`;
}
function renderGuideReport() {
  return (
    resourceHeading(
      "guide",
      "Ready for takeoff",
      "Informe",
      "library",
      "guide-detail",
    ) +
    withoutHeading(
      summaryBody(
        "Ya tienes una pregunta para tu próximo viaje.",
        "Guía de práctica",
      ),
    )
  );
}
function renderConversationSummary() {
  return (
    tabs(
      [
        ["Conversación", "conversation"],
        ["Resumen", "conversation-summary"],
      ],
      "conversation-summary",
    ) + summaryBody("Una conversación que deja huella.", "Tu tutor · Resumen")
  );
}

function progressTabs() {
  return tabs(
    [
      ["General", "progress"],
      ["Vocabulario", "vocabulary"],
      ["Bitácora", "activity-log"],
    ],
    page,
  );
}
function renderVocabulary() {
  return `${heading("Tu progreso", "Palabras que ya son parte de tu historia.", "Expresiones que aparecieron en tus prácticas.")}${progressTabs()}<div class="resource-grid">${[
    [
      "Could I have…?",
      "Para pedir algo con amabilidad.",
      "Could I have a glass of water?",
    ],
    ["Boarding pass", "Tu tarjeta de embarque.", "Here is my boarding pass."],
    ["By the window", "Junto a la ventana.", "Could we sit by the window?"],
    [
      "Last weekend",
      "Para hablar del fin de semana pasado.",
      "I went to the beach last weekend.",
    ],
    [
      "Recommend",
      "Pedir o dar una recomendación.",
      "What would you recommend?",
    ],
    [
      "On the second floor",
      "Para indicar dónde está algo.",
      "The café is on the second floor.",
    ],
  ]
    .map(
      ([word, meaning, example]) =>
        `<article class="card p-4"><div class="kicker">En contexto</div><h2 class="editorial fs-3">${word}</h2><p class="small">${meaning}</p><div class="tone-mint rounded p-3 small">${example}</div></article>`,
    )
    .join("")}</div>`;
}
function renderActivityLog() {
  return `${heading("Tu progreso", "Cada práctica deja una huella.", "Vuelve a tus conversaciones, intentos y resultados.")}${progressTabs()}<div class="card">${[
    [
      "chat-dots",
      "Conversación con Mister F",
      "conversation-summary",
      "Hoy · 10:30",
    ],
    ["ui-checks", "Small talk, big connections", "quiz-result", "Ayer · 18:15"],
    [
      "chat-square-quote",
      "At the restaurant",
      "roleplay-result",
      "Lunes · 09:10",
    ],
    ["signpost-split", "Ready for takeoff", "guide-report", "Domingo · 11:40"],
  ]
    .map(
      ([glyph, title, target, date]) =>
        `<div class="timeline-row"><div class="resume-icon tone-mint">${icon(glyph)}</div><div><strong>${title}</strong><p>${date}</p></div>${link(target, "Ver resultado", "btn btn-outline-secondary btn-sm ms-auto")}</div>`,
    )
    .join("")}</div>`;
}

function renderFolder() {
  return `${heading(icon("folder2-open") + " Tus recursos", "Inglés para la vida diaria", "Un lugar para las situaciones que quieres practicar.")}${crumbs([["Recursos", "library"], ["Inglés para la vida diaria"]])}<div class="d-flex gap-2 mb-4">${link("create", "Crear en esta colección")}<button class="btn btn-outline-secondary" data-bs-toggle="modal" data-bs-target="#share-modal">Compartir ejemplo</button></div><div class="resource-grid">${resources.slice(0, 3).map(resourceCard).join("")}</div>${shareModal()}`;
}

function renderSharedQuiz() {
  return `<div class="public-resource">${heading("Quiz compartido · Invitado", "Una pequeña práctica.<br>Una nueva conversación.", "Te invitaron a practicar Small talk, big connections.")}<section class="card detail-cover"><img src="assets/workplace.png" alt="Compañeros conversando"><div class="card-body"><div class="d-flex gap-2 mb-3">${badge("Quiz", "peach")}${badge("A2", "peach")}${badge("3 preguntas", "peach")}</div><h2>¿Listo para romper el hielo?</h2><p>Resuelve el quiz y revisa tus respuestas al terminar.</p><p class="small tone-blue rounded p-3">${icon("eye")} Ejemplo de aviso: quien comparte una actividad puede recibir tus resultados cuando esa opción está habilitada.</p>${link("quiz-attempt?guest=1", "Empezar como invitado")}<p class="notice mb-0">Recorrido simulado. No se recopilan ni se comparten resultados.</p></div></section></div>`;
}
function renderSharedResource() {
  return `<div class="public-resource">${heading("Recurso compartido", "Tu próxima conversación te espera.", "Una guía para practicar las situaciones de un viaje.")}${mini("guide")}<section class="card p-4 mt-3"><h2 class="editorial fs-2">Ready for takeoff</h2><p>Un tutor te acompaña para pedir ayuda y orientarte en el aeropuerto.</p><div class="d-flex gap-2 flex-wrap">${link("login", "Entrar para continuar")}${link("register", "Crear una cuenta", "btn btn-outline-secondary")}</div></section></div>`;
}

function trashContent(area) {
  return `${heading("Archivo · " + (area === "media" ? "Multimedia" : "Recursos"), "A veces, una idea merece otra oportunidad.", "Elementos archivados de ejemplo. Puedes simular su restauración.")}${crumbs([[area === "media" ? "Multimedia" : "Recursos", area === "media" ? "media" : "library"], ["Papelera"]])}<div class="card" id="trash-list">${["My first conversation", "A day at work"].map((title) => `<div class="timeline-row" data-trash-row><div class="resume-icon tone-peach">${icon("archive")}</div><div><strong>${title}</strong><p>Archivado · Ejemplo</p></div><button class="btn btn-outline-secondary btn-sm ms-auto" data-restore>Restaurar ejemplo</button></div>`).join("")}</div><p id="restore-feedback" class="small mt-3" role="status"></p>`;
}
function renderResourceTrash() {
  return trashContent("resources");
}
function renderEmptyLibrary() {
  return `${heading("Tus recursos", "Aquí empieza tu colección.", "Todavía no hay actividades en esta vista de ejemplo.")}<section class="card state-card">${mini("guide")}<h2 class="editorial fs-2 mt-3">La primera idea puede ser algo cotidiano.</h2><p>Un café, una entrevista o una pregunta que siempre has querido hacer.</p>${link("create", "Crear mi primera actividad")}</section>`;
}
function renderErrorState() {
  return `${heading("Estado de ejemplo", "No pudimos completar este paso.", "Tus respuestas merecen otra oportunidad.")}<section class="card state-card"><div class="state-symbol tone-peach">${icon("arrow-repeat")}</div><h2 class="editorial fs-2">Vamos a intentarlo de nuevo.</h2><p>En este ejemplo, la evaluación no se completó. Puedes volver a las respuestas o explorar el resultado.</p><div class="d-flex justify-content-center flex-wrap gap-2">${link("quiz-evaluating", "Reintentar ejemplo")}${link("quiz-attempt", "Volver al quiz", "btn btn-outline-secondary")}</div></section>`;
}

const demoState = { quiz: null };
function bindResourceInteractions() {
  document
    .querySelector("#quiz-attempt-form")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      demoState.quiz = {
        polite: new FormData(event.target).get("quiz-one") === "polite",
        past:
          document.querySelector("#quiz-two").value.trim().toLowerCase() ===
          "was",
        writing: document.querySelector("#quiz-three").value,
      };
      location.hash = `${mode}/quiz-evaluating${location.hash.includes("guest=1") ? "?guest=1" : ""}`;
    });
  document.querySelector("[data-add-block]")?.addEventListener("click", () => {
    const count = document.querySelectorAll(".editor-block").length + 1;
    document
      .querySelector("#editor-blocks")
      .insertAdjacentHTML(
        "beforeend",
        `<div class="editor-block">${textField("question-" + count, "Bloque " + count + " · Respuesta abierta", "What did you do last weekend?", 3)}</div>`,
      );
  });
  document
    .querySelector("[data-revision-preview]")
    ?.addEventListener("click", (event) => {
      document.querySelector("#revision-preview").classList.remove("d-none");
      document
        .querySelector("[data-revision-apply]")
        .classList.remove("d-none");
      event.target.classList.add("d-none");
    });
  document
    .querySelector("[data-revision-apply]")
    ?.addEventListener("click", () => {
      document.querySelector("#editor-description").value =
        "Practica tres expresiones para pedir ayuda con amabilidad en una situación cotidiana.";
      bootstrap.Modal.getInstance(
        document.querySelector("#revision-modal"),
      ).hide();
      document.querySelector(".local-feedback").textContent =
        "Propuesta aplicada al formulario de ejemplo. No se ha guardado en el sitio.";
    });
  document.querySelectorAll("[data-tutor-suggestion]").forEach((button) =>
    button.addEventListener("click", () => {
      document.querySelector("#tutor-input").value =
        button.dataset.tutorSuggestion;
    }),
  );
  document.querySelector("#tutor-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.querySelector("#tutor-input");
    const messages = document.querySelector("#tutor-messages");
    messages.insertAdjacentHTML(
      "beforeend",
      `<div class="chat-bubble own">${escapeHTML(input.value)}</div><div class="chat-bubble tone-mint"><small>MISTER F · RESPUESTA PREDEFINIDA</small>Thanks for trying! Let's practice one useful phrase: “Could you help me, please?”</div>`,
    );
    input.value = "";
  });
  document.querySelectorAll("[data-restore]").forEach((button) =>
    button.addEventListener("click", () => {
      button.closest("[data-trash-row]").remove();
      document.querySelector("#restore-feedback").textContent =
        "Restauración simulada. El elemento desaparece de esta vista; no se modifican recursos reales.";
    }),
  );
}
