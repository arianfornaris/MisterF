/* Spanish copy is intentionally authored for this standalone review prototype.
 * No product routes, inference, account data, or persistence are involved.
 * Each screen has its own renderer; shared fragments express visual patterns.
 */
const app = document.querySelector("#app");
let mode = "learn";
let page = "home";
let selectedType = "quiz";
const icon = (name) => `<i class="bi bi-${name}" aria-hidden="true"></i>`;
const url = (target) => {
  const guest =
    location.hash.includes("guest=1") &&
    ["quiz-attempt", "quiz-evaluating", "quiz-result"].includes(target);
  return `#${mode}/${target}${guest ? "?guest=1" : ""}`;
};
const link = (target, label, classes = "btn btn-primary") =>
  `<a class="${classes}" href="${url(target)}">${label}</a>`;
const badge = (label, tone = "mint") =>
  `<span class="badge pill tone-${tone}">${label}</span>`;
const escapeHTML = (value) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );

function mini(kind) {
  const stages = {
    quiz: `<div class="mini-stage tone-peach"><div class="mini-paper"><small>Choose the right words</small><div class="line"></div><div class="mini-answer">${icon("check-circle-fill")} Could I have a coffee?</div><div class="line short"></div></div></div>`,
    chat: `<div class="mini-stage tone-lilac"><div class="mini-bubbles"><span>How was your weekend?</span><span>I went to the beach!</span></div></div>`,
    roleplay: `<div class="mini-stage tone-lilac"><img class="portrait" src="assets/sofia.png" alt=""><span class="character-quote">Hi! What can I get for you today?</span></div>`,
    guide: `<div class="mini-stage tone-mint"><div class="mini-route"><span>${icon("check-lg")}</span><b></b><span>${icon("chat-dots")}</span><b></b><span>${icon("flag")}</span></div></div>`,
  };
  return stages[kind];
}

function pathCard(kind, title, copy, action, target) {
  return `<div class="col-md-4"><a class="card path-card" href="${url(target)}">${mini(kind)}<div class="card-body"><h3>${title}</h3><p>${copy}</p><span class="arrow">${action} ${icon("arrow-right")}</span></div></a></div>`;
}

function heading(kicker, title, copy, action = "") {
  return `<header class="page-heading"><div><div class="kicker">${kicker}</div><h1>${title}</h1><p>${copy}</p></div>${action}</header>`;
}

function renderLearningHome() {
  return `${heading("Tu espacio para aprender", "Un poco de inglés.<br>Un mundo de posibilidades.", "Hola, Alex. ¿Qué te gustaría poder decir hoy?")}
  <section class="card hero tone-mint">
    <div class="hero-copy"><div class="kicker">Inglés para la vida real</div><h2>Una mesa, por favor.<br>Y un poco de confianza.</h2><p>Entra al restaurante, pide lo que te gusta y practica a tu ritmo con Sofía.</p><div class="d-flex gap-2 mb-3">${badge("Roleplay")}${badge("A2 · Básico")}${badge("≈ 8 min")}</div>${link("chat", `Vamos a practicar ${icon("arrow-right")}`)}</div>
    <div class="hero-scene"><img src="assets/restaurant.png" alt="Un grupo de amigos pide comida en un restaurante"><span class="scene-label">Tu próxima conversación</span><div class="speech">${icon("chat-quote")}<div><small>Hoy podrías decir</small><strong lang="en">“Could we have a table for two?”</strong></div></div></div>
  </section>
  <div class="hero-footer"><span>${icon("headphones")} Lee, escucha y responde a tu ritmo</span><span>${icon("check-circle")} Aquí, equivocarse también es aprender</span></div>
  <div class="section-head"><h2>¿Cómo quieres practicar?</h2>${link("library", "Explorar actividades " + icon("arrow-right"), "")}</div>
  <div class="row g-3">${pathCard("chat", "Habla de lo tuyo", "Tu día, un viaje o esa frase que nunca sabes cómo decir.", "Conversar con Mister F", "conversation")}${pathCard("quiz", "Ponte a prueba", "Pequeños retos para descubrir qué sabes y qué puedes mejorar.", "Probar un quiz", "quiz-detail")}${pathCard("guide", "Paso a paso", "Una práctica guiada para trabajar un objetivo concreto.", "Encontrar mi práctica", "guide-detail")}</div>
  <div class="section-head"><h2>Retoma el hilo</h2></div>
  <section class="card resume"><div class="resume-icon tone-lilac">${icon("chat-dots")}</div><div><small class="text-muted">Tu última conversación</small><h3>Talking about my weekend</h3><p>Estabas practicando cómo contar algo que ya pasó.</p></div>${link("chat", "Continuar " + icon("arrow-right"), "btn btn-outline-secondary")}</section>`;
}

function reportPreview() {
  return `<div class="report-preview"><div class="d-flex justify-content-between align-items-center mb-3"><span class="kicker mb-0">Vista del informe</span>${badge("Ejemplo", "blue")}</div><h3>At the restaurant</h3><p class="small mb-2">8 participaciones completadas</p><div class="preview-row"><span>01 · Ordering politely</span><strong>7 / 8</strong></div><div class="preview-row"><span>02 · Asking for the bill</span><strong>6 / 8</strong></div><div class="preview-row"><span>03 · Making a request</span><span class="tone-peach badge">4 / 8 · Repasar</span></div><div class="preview-summary">${icon("stars")} Una oportunidad: practicar peticiones con “could”.</div></div>`;
}

function renderTeachingHome() {
  return `${heading("Tu espacio para enseñar", "Buenas ideas.<br>Mejores conversaciones.", "Hola, Alex. Dale forma a tu próxima práctica.")}
  <section class="card hero teacher-hero tone-blue"><div class="hero-copy"><div class="kicker">De tu idea a la práctica</div><h2>Tú conoces a tus alumnos.<br>Empieza por ahí.</h2><p>Convierte una situación, un texto o un objetivo en una actividad que tenga sentido para ellos.</p>${link("create", icon("plus-lg") + " Crear una actividad")}<small class="mt-3 text-muted">Quiz, roleplay o guía de práctica</small></div>${reportPreview()}</section>
  <div class="stats"><div class="card stat"><strong>12</strong><span>Actividades<br>en tu biblioteca</span></div><div class="card stat"><strong>24</strong><span>Participaciones<br>esta semana</span></div><div class="card stat"><strong>3</strong><span>Informes recientes<br>para explorar</span></div></div>
  <div class="section-head"><h2>¿Qué quieres crear?</h2><span class="small">Tu objetivo, distintos formatos</span></div>
  <div class="row g-3">${pathCard("quiz", "Un quiz con intención", "Comprueba comprensión, vocabulario y uso del idioma.", "Crear un quiz", "create?type=quiz")}${pathCard("roleplay", "Una situación real", "Un personaje, un contexto y una conversación que practicar.", "Crear un roleplay", "create?type=roleplay")}${pathCard("guide", "Una práctica guiada", "Acompaña a tus alumnos en un objetivo, paso a paso.", "Crear una guía", "create?type=guide")}</div>
  <div class="section-head"><h2>Lo que está pasando</h2>${link("progress", "Ver resultados " + icon("arrow-right"), "")}</div>
  <div class="card table-responsive"><table class="table mb-0"><thead><tr><th>Actividad</th><th>Tipo</th><th>Participaciones</th><th></th></tr></thead><tbody><tr><td>At the restaurant</td><td>${badge("Quiz", "peach")}</td><td>8 completadas</td><td>${link("progress", "Ver informe", "")}</td></tr><tr><td>My first job interview</td><td>${badge("Roleplay", "lilac")}</td><td>6 completadas</td><td>${link("progress", "Ver informe", "")}</td></tr></tbody></table></div>`;
}

const resources = [
  {
    title: "At the restaurant",
    type: "roleplay",
    label: "Roleplay",
    tone: "lilac",
    level: "A2",
    time: "8 min",
    image: "restaurant",
    copy: "Pide tu plato favorito y conversa con Sofía.",
  },
  {
    title: "Small talk, big connections",
    type: "quiz",
    label: "Quiz",
    tone: "peach",
    level: "A2",
    time: "6 min",
    image: "workplace",
    copy: "Rompe el hielo en el trabajo, una frase a la vez.",
  },
  {
    title: "Ready for takeoff",
    type: "guide",
    label: "Guía de práctica",
    tone: "mint",
    level: "A2",
    time: "12 min",
    image: "airport",
    copy: "Prepárate para las conversaciones del aeropuerto.",
  },
  {
    title: "Could you help me?",
    type: "quiz",
    label: "Quiz",
    tone: "peach",
    level: "A2",
    time: "5 min",
    copy: "Pedir ayuda con amabilidad hace la diferencia.",
  },
  {
    title: "A coffee and a conversation",
    type: "roleplay",
    label: "Roleplay",
    tone: "lilac",
    level: "A1",
    time: "7 min",
    copy: "Conoce a Sofía y haz tu primer pedido en inglés.",
  },
  {
    title: "Tell me about your weekend",
    type: "guide",
    label: "Guía de práctica",
    tone: "mint",
    level: "A2",
    time: "10 min",
    copy: "Dale vida al pasado con historias de tu día a día.",
  },
];

function resourceCard(resource) {
  return `<article class="card resource-card" data-resource data-type="${resource.type}" data-title="${resource.title.toLowerCase()}">${resource.image ? `<div class="resource-image"><img src="assets/${resource.image}.png" alt="" loading="lazy">${badge(resource.label, resource.tone)}</div>` : mini(resource.type)}<div class="card-body"><div class="resource-meta"><span>${resource.label}</span><span>${resource.level} · ${resource.time}</span></div><h3>${resource.title}</h3><p>${resource.copy}</p>${link(resource.type + "-detail", mode === "learn" ? "Explorar práctica " + icon("arrow-right") : "Ver actividad " + icon("arrow-right"), "")}</div></article>`;
}

function renderLibrary() {
  const learning = mode === "learn";
  return `${heading(learning ? "Tu biblioteca de posibilidades" : "Tus materiales, a mano", learning ? "El inglés que sí vas a usar." : "Ideas listas para compartir.", learning ? "Situaciones reales. Pequeños retos. Mucho por descubrir." : "Organiza tus actividades y prepara lo que viene.", link("create", icon("plus-lg") + " Crear"))}
  <section class="card library-banner ${learning ? "tone-mint" : "tone-blue"}"><div><div class="kicker mb-2">${learning ? "Una intención para hoy" : "Tu próxima actividad"}</div><h2>${learning ? "“Quiero sentirme más cómodo al hablar.”" : "Empieza con algo que les importe."}</h2><p>${learning ? "Empieza con una conversación corta. Lo demás viene con la práctica." : "Un menú, una entrevista o una conversación en el trabajo pueden ser el punto de partida."}</p></div><div class="mini-route"><span>${icon(learning ? "chat-heart" : "lightbulb")}</span><b></b><span>${icon(learning ? "check-lg" : "ui-checks")}</span></div></section>
  <div class="filter-row"><div class="filters" role="group" aria-label="Filtrar actividades"><button class="filter active" data-filter="all" aria-pressed="true">Todo</button><button class="filter" data-filter="quiz" aria-pressed="false">${icon("ui-checks")} Quizzes</button><button class="filter" data-filter="roleplay" aria-pressed="false">${icon("chat-square-quote")} Roleplays</button><button class="filter" data-filter="guide" aria-pressed="false">${icon("signpost-split")} Guías</button></div><input id="search" class="form-control search" type="search" aria-label="Buscar actividades" placeholder="Buscar una actividad…"></div>
  <div class="resource-grid">${resources.map(resourceCard).join("")}<p id="empty" class="empty-state d-none">No hay actividades con ese nombre. Prueba otra búsqueda.</p></div><p id="resource-count" class="small mt-3" role="status">6 actividades de ejemplo</p>`;
}

function renderCreate() {
  const learning = mode === "learn";
  return `${heading("Un espacio para tus ideas", learning ? "Hazlo tuyo." : "Una buena práctica empieza contigo.", learning ? "Crea una actividad sobre lo que necesitas en tu vida real." : "Cuéntanos el objetivo. Dale tu toque a la propuesta.")}
  <div class="create-layout"><section class="card"><div class="card-body p-lg-4"><h2 class="h5 mb-3">1. Elige cómo practicar</h2><div class="type-grid">${[
    ["quiz", "ui-checks", "Quiz"],
    ["roleplay", "chat-square-quote", "Roleplay"],
    ["guide", "signpost-split", "Guía de práctica"],
  ]
    .map(
      ([type, glyph, label]) =>
        `<button class="type-option ${type === selectedType ? "active" : ""}" data-type-select="${type}" aria-pressed="${type === selectedType}">${icon(glyph)}${label}</button>`,
    )
    .join("")}</div>
  <form id="create-form"><label for="idea" class="form-label h5">2. ¿Qué te gustaría trabajar?</label><p class="small">Piensa en una situación, un tema o algo que quieras poder decir.</p><textarea class="form-control" id="idea" rows="5" required placeholder="Por ejemplo: pedir comida en un restaurante, preguntar por los ingredientes y pedir la cuenta…"></textarea><div class="prompt-examples"><button type="button" data-prompt="Pedir comida en un restaurante y preguntar por los ingredientes">${icon("cup-hot")} En un restaurante</button><button type="button" data-prompt="Presentarme y hablar de mi experiencia en una entrevista de trabajo">${icon("briefcase")} Una entrevista</button><button type="button" data-prompt="Describir síntomas y pedir una cita médica">${icon("heart-pulse")} Una cita médica</button></div><div class="row g-3 mb-4"><div class="col-6"><label class="form-label" for="level">Nivel de inglés</label><select id="level" class="form-select"><option>A1 · Principiante</option><option selected>A2 · Básico</option><option>B1 · Intermedio</option><option>B2 · Intermedio alto</option></select></div><div class="col-6"><label class="form-label" for="file">Material de referencia</label><input type="file" id="file" class="form-control" accept=".txt,.pdf,.docx,image/*"></div></div><button class="btn btn-primary" type="submit">${icon("stars")} Ver propuesta de ejemplo</button><p class="notice">Demo estático: muestra una propuesta predefinida. El archivo solo se selecciona en tu navegador; no se envía ni se procesa.</p></form><div id="generated" class="generated" aria-live="polite"></div></div></section>
  <aside class="card preview-panel tone-${selectedType === "quiz" ? "peach" : selectedType === "roleplay" ? "lilac" : "mint"}"><div class="kicker">Así podría verse</div><h2 class="editorial fs-2">${selectedType === "quiz" ? "Pequeños retos.<br>Grandes descubrimientos." : selectedType === "roleplay" ? "Un personaje.<br>Mil conversaciones." : "Un objetivo.<br>Un paso a la vez."}</h2><p>Un ejemplo del formato que estás eligiendo.</p><div class="large-paper">${selectedType === "quiz" ? `<div class="d-flex justify-content-between mb-3">${badge("Quiz", "peach")}<span class="small">1 de 5</span></div><h3>Make it polite.</h3><p class="small">Choose the best way to order.</p><div class="answer"><span class="number">A</span> I want coffee.</div><div class="answer correct"><span class="number">B</span> Could I have a coffee? ${icon("check-circle")}</div>` : selectedType === "roleplay" ? `${mini("roleplay")}<h3 class="mt-3">Meet Sofía.</h3><p class="small">You are at a café. Order a drink and ask about the menu.</p><div class="answer tone-lilac">“Hi there! What would you like?”</div>` : `<h3>Your next conversation.</h3><p class="small">Práctica guiada: pedir ayuda en inglés.</p><div class="preview-row"><span>01 · Aprende las expresiones</span>${icon("check-circle")}</div><div class="preview-row"><span>02 · Pruébalas en una conversación</span>${icon("chat-dots")}</div><div class="preview-row"><span>03 · Repasa lo aprendido</span>${icon("flag")}</div>`}</div><p class="mb-0">${icon("pencil-square")} La propuesta es un punto de partida. Después podrás revisarla y ajustarla.</p></aside></div>`;
}

function renderProgress() {
  return `${heading("Tu bitácora de aprendizaje", "Mira todo lo que ya puedes decir.", "Cada conversación deja algo. Aquí puedes verlo crecer.")}
  <section class="card progress-hero tone-mint"><div><div class="kicker">Lo que estás construyendo</div><h2>Más confianza para<br>las conversaciones cotidianas.</h2><p>Has practicado cómo pedir comida, hablar de tu día y pedir ayuda. Tus peticiones suenan cada vez más naturales.</p>${link("chat", "Practicar mi siguiente paso " + icon("arrow-right"))}</div><div><div class="growth" role="img" aria-label="Actividades completadas por semana: 2, 3, 3 y 5. Datos de ejemplo."><div style="height:35%"><span>2</span><small>Sem. 1</small></div><div style="height:53%"><span>3</span><small>Sem. 2</small></div><div style="height:53%"><span>3</span><small>Sem. 3</small></div><div style="height:88%"><span>5</span><small>Sem. 4</small></div></div><p class="small text-center mt-3 mb-0">Prácticas completadas · Ejemplo</p></div></section>
  <div class="section-head"><h2>Tu inglés, en movimiento</h2>${badge("A2 · En práctica")}</div><div class="row g-3"><div class="col-md-6"><section class="card learning-note tone-mint"><h3>${icon("check-circle")} Lo que ya te sale mejor</h3><p>Usas expresiones amables para pedir algo y puedes mantener una conversación corta sobre tu día.</p><div class="word-pills"><span>Could I have…?</span><span>I'd like…</span><span>Thank you for…</span></div></section></div><div class="col-md-6"><section class="card learning-note tone-peach"><h3>${icon("signpost-split")} Tu siguiente pequeño paso</h3><p>Cuando cuentas algo que ya pasó, a veces mezclas presente y pasado. Vamos a practicar con tu fin de semana.</p>${link("chat", "Practicar el pasado " + icon("arrow-right"), "btn btn-outline-secondary btn-sm")}</section></div></div>
  <div class="section-head"><h2>Las huellas de tu práctica</h2><span class="small">Últimas actividades</span></div><div class="card">${[
    [
      "chat-dots",
      "lilac",
      "Talking about my weekend",
      "Conversación con Mister F · Expresiones para hablar del pasado",
      "Hoy",
    ],
    [
      "ui-checks",
      "peach",
      "At the restaurant",
      "Quiz · 4 de 5 respuestas correctas",
      "Ayer",
    ],
    [
      "chat-square-quote",
      "mint",
      "A coffee and a conversation",
      "Roleplay · Practicaste pedir algo con amabilidad",
      "Lunes",
    ],
  ]
    .map(
      ([glyph, tone, title, copy, date]) =>
        `<div class="timeline-row"><div class="resume-icon tone-${tone}">${icon(glyph)}</div><div><strong>${title}</strong><p>${copy}</p></div><small>${date}</small></div>`,
    )
    .join("")}</div>`;
}

function renderTeachingReport() {
  return `${heading("Resultados · At the restaurant", "Entender para acompañar.", "Una mirada a cómo funcionó la actividad y qué puedes trabajar después.", link("create", "Crear refuerzo", "btn btn-outline-secondary"))}
  <section class="card library-banner tone-blue"><div><div class="kicker">Una oportunidad para tu próxima clase</div><h2>Las peticiones amables necesitan otra vuelta.</h2><p>4 de 8 participantes tuvieron dificultades con “could”. Un roleplay puede ayudarles a ponerlo en contexto.</p></div></section><div class="stats"><div class="card stat"><strong>8</strong><span>Participaciones<br>completadas</span></div><div class="card stat"><strong>71%</strong><span>Respuestas correctas<br>en este ejemplo</span></div><div class="card stat"><strong>3</strong><span>Preguntas<br>evaluadas</span></div></div>
  <div class="section-head"><h2>¿Dónde conviene detenerse?</h2>${badge("Informe de ejemplo", "blue")}</div><div class="card table-responsive"><table class="table mb-0"><thead><tr><th>Pregunta</th><th>Correctas</th><th>Por mejorar</th><th>Lectura</th></tr></thead><tbody><tr><td>01 · Ordering politely</td><td>7 / 8</td><td>1 / 8</td><td>${badge("Buen punto de partida")}</td></tr><tr><td>02 · Asking for the bill</td><td>6 / 8</td><td>2 / 8</td><td>${badge("Seguir practicando", "blue")}</td></tr><tr><td>03 · Making a request</td><td>4 / 8</td><td>4 / 8</td><td>${badge("Dedicarle un momento", "peach")}</td></tr></tbody></table></div><div class="section-head"><h2>Convierte el resultado en una nueva práctica</h2></div><section class="card resume"><div class="resume-icon tone-lilac">${icon("chat-square-quote")}</div><div><h3>Una conversación en el café</h3><p>Una propuesta para practicar “Could I have…?” en una situación real.</p></div>${link("create?type=roleplay", "Preparar roleplay " + icon("arrow-right"))}</section>`;
}

function renderChat() {
  return `${heading("Práctica · At the restaurant", "Tu mesa está lista.", "Prueba, equivócate, vuelve a intentarlo. Sofía te acompaña.", link("library", "Volver", "btn btn-outline-secondary"))}<div class="chat-layout"><section class="card chat-session"><div class="chat-person"><img src="assets/sofia.png" alt="Sofía"><div><strong>Sofía</strong><p>Tu compañera de roleplay · En el restaurante</p></div><span class="ms-auto">${badge("A2", "lilac")}</span></div><div id="conversation"><div class="chat-bubble tone-lilac"><small>SOFÍA · TU TURNO</small><span lang="en">Hi! Welcome to our restaurant. Would you like a table for two?</span></div><div class="chat-exercise"><p class="small mb-2">${icon("lightbulb")} Un pequeño ensayo antes de responder</p><p class="mb-2" lang="en">Which answer sounds more polite?</p><button class="answer" data-answer="wrong"><span class="number">A</span> Give me a table.</button><button class="answer" data-answer="right"><span class="number">B</span> Yes, please. Could we sit by the window?</button><div id="answer-feedback" aria-live="polite"></div></div></div><form class="chat-compose" id="chat-form"><input id="message" class="form-control" aria-label="Tu respuesta en inglés" placeholder="Escribe tu respuesta en inglés…" required maxlength="500"><button class="btn btn-primary" aria-label="Enviar respuesta">${icon("arrow-up")}</button></form><p class="notice mb-0">Conversación de ejemplo con una respuesta predefinida. No utiliza IA.</p></section><aside class="card context-card"><img src="assets/restaurant.png" alt="Escena de un restaurante"><div class="card-body"><div class="kicker">Tu misión</div><h3>Una cena en inglés</h3><p>Estás cenando con un amigo. Consigue una mesa y pide algo que te guste.</p><hr><p class="fw-semibold text-body">Puedes intentar…</p><ul><li>Pedir una mesa junto a la ventana.</li><li>Preguntar por el plato del día.</li><li>Pedir la cuenta.</li></ul><div class="tone-mint p-3 rounded"><p class="mb-0">${icon("chat-heart")} No necesitas una frase perfecta para empezar.</p></div></div></aside></div>`;
}

function renderAbout() {
  return `${heading("La dirección de diseño", "Más vida. Con intención.", "Una propuesta visual para conversar, explorar y crear.")}
  <div class="row g-3"><div class="col-md-6"><section class="card learning-note tone-mint"><div class="kicker">Estoy aprendiendo</div><h2>Invitar a dar el siguiente paso.</h2><p>Verde suave, escenas de la vida real, personajes y lenguaje cercano. El inicio propone una práctica concreta; la biblioteca invita a explorar; el progreso explica qué ya puedes hacer y qué practicar después.</p>${link("home", "Explorar este modo")}</section></div><div class="col-md-6"><section class="card learning-note tone-blue"><div class="kicker">Estoy enseñando</div><h2>Dar espacio a las buenas ideas.</h2><p>Azul, mockups de materiales e informes y un lenguaje de preparación y acompañamiento. Crear y comprender resultados ocupan el primer plano.</p><a class="btn btn-primary" href="#teach/home">Explorar este modo</a></section></div></div><section class="card mt-4"><div class="card-body"><h2>El color ayuda a entender</h2><p>Melocotón para quizzes, lila para conversaciones y verde para recorridos. Cada formato también tiene nombre, icono y vista previa: la distinción no depende solo del color.</p><h2 class="mt-4">Imágenes que cuentan algo</h2><p>Ilustraciones existentes del proyecto sitúan la práctica en un contexto. Los mockups explican formatos y muestran qué esperar. No hacen falta imágenes en cada tarjeta ni detrás de formularios o textos largos.</p><h2 class="mt-4">Qué estás viendo</h2><p class="mb-0">Demo estático independiente. Todas las actividades, cifras e interacciones son ejemplos. El inicio dedicado, la galería visual, los filtros y el gráfico de progreso son propuestas de producto; requieren validar datos y flujos antes de implementarlos. Los bloques de conversación de este demo son ilustrativos, no una sustitución de los bloques actuales.</p></div></section>`;
}

const renderers = {
  home: () => (mode === "learn" ? renderLearningHome() : renderTeachingHome()),
  library: renderLibrary,
  create: renderCreate,
  progress: () =>
    mode === "learn" ? renderProgress() : renderTeachingReport(),
  chat: renderChat,
  about: renderAbout,
  ...additionalRenderers,
};

function render() {
  const [path, query = ""] = location.hash.slice(1).split("?");
  const [requestedMode, requestedPage] = path.split("/");
  mode = requestedMode === "teach" ? "teach" : "learn";
  page = Object.hasOwn(renderers, requestedPage) ? requestedPage : "home";
  const type = new URLSearchParams(query).get("type");
  selectedType = ["quiz", "roleplay", "guide"].includes(type) ? type : "quiz";
  document.body.classList.toggle("teaching", mode === "teach");
  const learning = mode === "learn";
  const navItems = [
    ["home", "house-door", "Inicio"],
    ["library", "collection", learning ? "Mis prácticas" : "Mis recursos"],
    ["create", "plus-square", "Crear actividad"],
    ["progress", "graph-up-arrow", learning ? "Mi progreso" : "Resultados"],
    ["conversation", "chat-dots", "Conversar"],
    ["media", "images", "Multimedia"],
    ["profiles", "person-circle", "Perfiles"],
    ["settings", "gear", "Ajustes"],
  ];
  const content = renderers[page]();
  const guest = location.hash.includes("guest=1");
  const isPublic = pageInfo[page]?.isPublic || guest;
  document.body.classList.toggle("public-view", Boolean(isPublic));
  app.innerHTML = isPublic
    ? publicShell(content)
    : `
    <div class="shell">
      <aside class="sidebar">
        <a class="brand" href="${url("home")}"><img src="assets/brand.png" alt="">Mister F<span class="dot">.</span></a>
        <div class="mode-label">Este es tu espacio</div>
        <div class="mode-switch" role="group" aria-label="Modo de uso">
          <button class="${learning ? "active" : ""}" data-mode="learn" aria-pressed="${learning}">${icon("compass")} Aprendiendo</button>
          <button class="${!learning ? "active" : ""}" data-mode="teach" aria-pressed="${!learning}">${icon("easel")} Enseñando</button>
        </div>
        <nav aria-label="Navegación principal">${navItems.map(([target, glyph, label], index) => `<a class="nav-link ${index > 4 ? "secondary-nav" : ""} ${page === target ? "active" : ""}" ${page === target ? 'aria-current="page"' : ""} href="${url(target)}">${icon(glyph)}<span>${label}</span></a>`).join("")}</nav>
        <div class="sidebar-note">${icon(learning ? "chat-heart" : "lightbulb")}<p class="fw-semibold mt-2">${learning ? "A tu ritmo. A tu manera." : "Tu experiencia importa."}</p><p class="mb-0">${learning ? "No tienes que saberlo todo para empezar a hablar." : "La IA propone. Tú le das el sentido pedagógico."}</p></div>
        <a class="user" href="${url("profiles")}"><span class="avatar">A</span><div><strong>Alex Morgan</strong><br><small>Perfil de ejemplo</small></div></a>
      </aside>
      <div class="workspace">
        <header class="topbar"><span class="mode-indicator">${icon(learning ? "compass" : "easel")} Estoy ${learning ? "aprendiendo" : "enseñando"}</span><div class="topbar-meta"><span class="demo-label">Propuesta visual · Demo</span><a class="atlas-link" href="${url("pages")}">${icon("grid-3x3-gap")} Todas las páginas</a></div></header>
        <main id="main" class="content" tabindex="-1">${content}<footer class="footer"><span>Mister F · El inglés conecta.</span><a href="${url("design-guide")}">Guía de diseño ${icon("arrow-up-right")}</a></footer></main>
      </div>
    </div>`;
  document.title = `Mister F · ${pageInfo[page]?.title || navItems.find((item) => item[0] === page)?.[2] || "Propuesta"} · ${isPublic ? "Demo público" : learning ? "Aprendiendo" : "Enseñando"}`;
  bindInteractions();
  bindExtendedInteractions();
  if (page === "progress" && learning)
    document
      .querySelector(".page-heading")
      .insertAdjacentHTML("afterend", progressTabs());
  if (page === "library")
    document
      .querySelector(".filter-row")
      .insertAdjacentHTML(
        "beforebegin",
        `<div class="d-flex flex-wrap gap-3 mt-3 small">${link("folder", icon("folder2-open") + " Inglés para la vida diaria", "")}${link("trash", "Papelera", "")}${link("empty", "Ver ejemplo sin actividades", "")}</div>`,
      );
}

function bindInteractions() {
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.onclick = () => {
      location.hash = `${button.dataset.mode}/${page}${location.hash.includes("?") ? "?" + location.hash.split("?")[1] : ""}`;
    };
  });
  document.querySelectorAll("[data-type-select]").forEach((button) =>
    button.addEventListener("click", () => {
      const idea = document.querySelector("#idea").value;
      const level = document.querySelector("#level").value;
      selectedType = button.dataset.typeSelect;
      history.replaceState(null, "", `#${mode}/create?type=${selectedType}`);
      const main = document.querySelector("#main");
      const footer = main.querySelector("footer")?.outerHTML || "";
      main.innerHTML = renderCreate() + footer;
      document.querySelector("#idea").value = idea;
      document.querySelector("#level").value = level;
      bindInteractions();
    }),
  );
  let filter = "all";
  const updateResources = () => {
    const search = document.querySelector("#search").value.toLowerCase().trim();
    let count = 0;
    document.querySelectorAll("[data-resource]").forEach((card) => {
      const visible =
        (filter === "all" || card.dataset.type === filter) &&
        card.dataset.title.includes(search);
      card.hidden = !visible;
      if (visible) count++;
    });
    document.querySelector("#empty").classList.toggle("d-none", count > 0);
    document.querySelector("#resource-count").textContent =
      `${count} ${count === 1 ? "actividad" : "actividades"} de ejemplo`;
  };
  document.querySelectorAll("[data-filter]").forEach((button) =>
    button.addEventListener("click", () => {
      filter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((item) => {
        item.classList.toggle("active", item === button);
        item.setAttribute("aria-pressed", String(item === button));
      });
      updateResources();
    }),
  );
  document.querySelector("#search")?.addEventListener("input", updateResources);
  document.querySelectorAll("[data-prompt]").forEach((button) =>
    button.addEventListener("click", () => {
      document.querySelector("#idea").value = button.dataset.prompt;
      document.querySelector("#idea").focus();
    }),
  );
  document
    .querySelector("#create-form")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      document.querySelector("#generated").innerHTML =
        `<div class="alert tone-mint mb-0"><h3 class="h6">${icon("check-circle")} Tu ejemplo está listo</h3><p class="small mb-2">Formato: ${selectedType === "quiz" ? "Quiz" : selectedType === "roleplay" ? "Roleplay" : "Guía de práctica"} · ${escapeHTML(document.querySelector("#level").value)}</p><p class="small">Tu idea: ${escapeHTML(document.querySelector("#idea").value)}</p><p class="small">Se abre un borrador predefinido del formato elegido; no se genera contenido a partir de tu idea.</p>${link(selectedType + "-edit", "Revisar borrador de ejemplo", "btn btn-primary btn-sm")}</div>`;
      document
        .querySelector("#generated")
        .scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  document.querySelectorAll("[data-answer]").forEach((button) =>
    button.addEventListener("click", () => {
      const right = button.dataset.answer === "right";
      document
        .querySelectorAll("[data-answer]")
        .forEach((item) => item.classList.remove("correct", "incorrect"));
      button.classList.add(right ? "correct" : "incorrect");
      document.querySelector("#answer-feedback").innerHTML =
        `<div class="feedback ${right ? "" : "tone-peach"}">${icon(right ? "check-circle" : "arrow-repeat")} ${right ? "¡Suena muy natural! “Could we…?” convierte tu petición en una pregunta amable." : "Se entiende, pero suena muy directo. Prueba una pregunta con “Could we…?”."}</div>`;
    }),
  );
  document.querySelector("#chat-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.querySelector("#message");
    if (!input.value.trim()) return;
    const conversation = document.querySelector("#conversation");
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble own";
    bubble.textContent = input.value;
    conversation.append(bubble);
    const reply = document.createElement("div");
    reply.className = "chat-bubble tone-lilac";
    reply.innerHTML =
      '<small>SOFÍA · RESPUESTA DE EJEMPLO</small><span lang="en">Of course! Follow me. Here is the menu. Would you like something to drink?</span>';
    conversation.append(reply);
    input.value = "";
    reply.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
}

document.querySelector(".skip").addEventListener("click", (event) => {
  event.preventDefault();
  document.querySelector("#main").focus();
});
window.addEventListener("hashchange", () => {
  render();
  window.scrollTo(0, 0);
  document.querySelector("#main").focus({ preventScroll: true });
});
render();
