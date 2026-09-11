/* Route inventory and shared presentation primitives for the extended demo.
 * Each registry entry owns a dedicated renderer, even when it shares fragments.
 */
const pageCatalog = [
  ["pages", "Todas las páginas", "Diseño", renderPageIndex],
  ["design-guide", "Guía de diseño", "Diseño", renderDesignGuide],
  ["landing", "Landing público", "Acceso", renderPublicLanding, true],
  ["login", "Iniciar sesión", "Acceso", renderLogin, true],
  ["register", "Crear cuenta", "Acceso", renderRegister, true],
  ["forgot-password", "Recuperar acceso", "Acceso", renderForgotPassword, true],
  ["verify-email", "Verificar correo", "Acceso", renderVerifyEmail, true],
  [
    "reset-password",
    "Restablecer contraseña",
    "Acceso",
    renderResetPassword,
    true,
  ],
  ["onboarding", "Primeros pasos", "Acceso", renderOnboarding, true],
  ["folder", "Carpeta de recursos", "Recursos", renderFolder],
  ["quiz-detail", "Detalle de quiz", "Quizzes", renderQuizDetail],
  ["quiz-new", "Crear quiz", "Quizzes", renderQuizNew],
  ["quiz-edit", "Editar quiz", "Quizzes", renderQuizEditor],
  ["quiz-attempt", "Resolver quiz", "Quizzes", renderQuizAttempt],
  ["quiz-evaluating", "Evaluando respuestas", "Quizzes", renderQuizEvaluating],
  ["quiz-result", "Resultado de quiz", "Quizzes", renderQuizResult],
  [
    "quiz-participation",
    "Participación del quiz",
    "Quizzes",
    renderQuizParticipation,
  ],
  ["quiz-shared", "Quiz compartido", "Compartidos", renderSharedQuiz, true],
  ["shared", "Recurso compartido", "Compartidos", renderSharedResource, true],
  ["roleplay-detail", "Detalle de roleplay", "Roleplays", renderRoleplayDetail],
  ["roleplay-new", "Crear roleplay", "Roleplays", renderRoleplayNew],
  ["roleplay-edit", "Editar roleplay", "Roleplays", renderRoleplayEditor],
  [
    "roleplay-attempt",
    "Practicar roleplay",
    "Roleplays",
    renderRoleplayAttempt,
  ],
  [
    "roleplay-result",
    "Resultado de roleplay",
    "Roleplays",
    renderRoleplayResult,
  ],
  [
    "roleplay-participation",
    "Participación del roleplay",
    "Roleplays",
    renderRoleplayParticipation,
  ],
  ["guide-detail", "Detalle de guía", "Guías", renderGuideDetail],
  ["guide-new", "Crear guía", "Guías", renderGuideNew],
  ["guide-edit", "Editar guía", "Guías", renderGuideEditor],
  ["guide-session", "Práctica guiada", "Guías", renderGuideSession],
  ["guide-report", "Informe de práctica", "Guías", renderGuideReport],
  [
    "guide-participation",
    "Participación de la guía",
    "Guías",
    renderGuideParticipation,
  ],
  [
    "conversation",
    "Conversación con el tutor",
    "Aprendizaje",
    renderTutorConversation,
  ],
  [
    "conversation-summary",
    "Resumen de conversación",
    "Aprendizaje",
    renderConversationSummary,
  ],
  ["vocabulary", "Vocabulario", "Aprendizaje", renderVocabulary],
  ["activity-log", "Bitácora", "Aprendizaje", renderActivityLog],
  ["media", "Biblioteca multimedia", "Multimedia", renderMediaLibrary],
  ["media-detail", "Detalle multimedia", "Multimedia", renderMediaDetail],
  ["media-new", "Crear escena", "Multimedia", renderMediaNew],
  ["media-edit", "Editar escena", "Multimedia", renderMediaEditor],
  [
    "media-variation",
    "Variación de escena",
    "Multimedia",
    renderMediaVariation,
  ],
  ["media-trash", "Papelera multimedia", "Multimedia", renderMediaTrash],
  ["profiles", "Mis perfiles", "Cuenta", renderProfiles],
  ["profile-new", "Nuevo perfil", "Cuenta", renderProfileNew],
  ["profile-edit", "Editar perfil", "Cuenta", renderProfileEdit],
  ["settings", "Ajustes", "Cuenta", renderSettings],
  ["password", "Cambiar contraseña", "Cuenta", renderPassword],
  ["credits", "Créditos", "Cuenta", renderCredits],
  ["trash", "Papelera de recursos", "Recursos", renderResourceTrash],
  ["empty", "Biblioteca vacía", "Estados", renderEmptyLibrary],
  ["error", "No se pudo completar", "Estados", renderErrorState],
  ["admin", "Administración", "Gestión", renderAdmin],
  ["privacy", "Privacidad", "Legal", renderPrivacy, true],
  ["terms", "Términos", "Legal", renderTerms, true],
];

const additionalRenderers = Object.fromEntries(
  pageCatalog.map(([id, , , renderer]) => [id, renderer]),
);
const pageInfo = Object.fromEntries(
  pageCatalog.map(([id, title, group, , isPublic = false]) => [
    id,
    { title, group, isPublic },
  ]),
);

function crumbs(items) {
  return `<nav aria-label="Ruta de navegación" class="mb-4"><ol class="breadcrumb small mb-0">${items.map(([label, target]) => `<li class="breadcrumb-item ${target ? "" : "active"}" ${target ? "" : 'aria-current="page"'}>${target ? link(target, label, "") : label}</li>`).join("")}</ol></nav>`;
}

function resourceHeading(
  kind,
  title,
  context = "",
  root = "library",
  parent = "",
) {
  const names = {
    quiz: ["ui-checks", "Quiz"],
    roleplay: ["chat-square-quote", "Roleplay"],
    guide: ["signpost-split", "Guía de práctica"],
    media: ["image", "Multimedia"],
  };
  const [glyph, name] = names[kind];
  const guest = location.hash.includes("guest=1");
  return `${heading(icon(glyph) + " " + name + (context ? " · " + context : ""), title, "")}${guest ? '<p class="small mb-4">Vista de invitado · Práctica de ejemplo</p>' : crumbs([[root === "media" ? "Multimedia" : "Recursos", root], ...(parent ? [[title, parent], [context]] : [[context || title]])])}`;
}

function actionRow(primary, kind) {
  return `<div class="d-flex flex-wrap gap-2 mb-4">${primary}<div class="dropdown"><button class="btn btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">Opciones</button><ul class="dropdown-menu"><li>${link(kind + "-edit", icon("pencil") + " Editar", "dropdown-item")}</li><li><button class="dropdown-item" data-bs-toggle="modal" data-bs-target="#share-modal">${icon("share")} Compartir ejemplo</button></li><li>${link(kind + "-participation", icon("people") + " Participación", "dropdown-item")}</li><li><hr class="dropdown-divider"></li><li>${link("trash", icon("archive") + " Ver papelera de ejemplo", "dropdown-item")}</li></ul></div></div>${shareModal()}`;
}

function shareModal() {
  return `<div class="modal fade" id="share-modal" tabindex="-1" aria-labelledby="share-title" aria-hidden="true"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h2 class="modal-title fs-5" id="share-title">Una práctica para compartir</h2><button class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button></div><div class="modal-body"><div class="tone-blue rounded p-3 mb-3">${icon("people")} Invita a alguien a practicar a su ritmo.</div><label for="share-url" class="form-label">Enlace de ejemplo, solo en este equipo</label><input class="form-control" id="share-url" readonly value="${escapeHTML(location.href.split("#")[0] + "#learn/quiz-shared")}"><p class="small mt-3 mb-0">Este demo no publica recursos ni cambia permisos.</p></div><div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button><button class="btn btn-primary" data-preview-share>Ver como invitado</button></div></div></div></div>`;
}

function tabs(items, current) {
  return `<nav aria-label="Secciones" class="mb-4"><ul class="nav nav-pills gap-1">${items.map(([label, target]) => `<li class="nav-item"><a class="nav-link ${target === current ? "active" : ""}" ${target === current ? 'aria-current="page"' : ""} href="${url(target)}">${label}</a></li>`).join("")}</ul></nav>`;
}

function field(id, label, value = "", type = "text") {
  return `<div class="mb-3"><label class="form-label" for="${id}">${label}</label><input id="${id}" class="form-control" type="${type}" value="${escapeHTML(value)}" required></div>`;
}

function textField(id, label, value, rows = 4) {
  return `<div class="mb-3"><label class="form-label" for="${id}">${label}</label><textarea id="${id}" class="form-control" rows="${rows}" required>${escapeHTML(value)}</textarea></div>`;
}

function localSave(label = "Guardar ejemplo") {
  return `<button class="btn btn-primary" type="submit">${icon("check2")} ${label}</button><div class="local-feedback small mt-3" role="status"></div>`;
}

function featureNote(tone, glyph, title, copy) {
  return `<section class="card learning-note tone-${tone}"><h3>${icon(glyph)} ${title}</h3><p class="mb-0">${copy}</p></section>`;
}

function renderPageIndex() {
  const initial = [
    ["home", "Inicio", "Esenciales"],
    ["library", "Biblioteca", "Esenciales"],
    ["create", "Crear actividad", "Esenciales"],
    ["progress", "Progreso / resultados", "Esenciales"],
    ["about", "Dirección visual", "Diseño"],
  ];
  const entries = [...initial, ...pageCatalog.filter(([id]) => id !== "pages")];
  const groups = [...new Set(entries.map((item) => item[2]))];
  return `${heading("Atlas del demo · " + entries.length + " pantallas", "Cada página, una misma experiencia.", "Recorre las pantallas y cambia de modo para comparar el enfoque.")}
  <section class="card library-banner tone-blue mb-4"><div><div class="kicker">Continuidad del diseño</div><h2>Una guía para el próximo agente.</h2><p>Paleta, componentes, patrones de página y criterios para seguir diseñando.</p></div>${link("design-guide", "Leer las pautas " + icon("arrow-right"))}</section>
  <label for="page-search" class="form-label">Encontrar una pantalla</label><input class="form-control mb-4" id="page-search" type="search" placeholder="Quiz, perfil, acceso…"><div id="page-groups">${groups
    .map(
      (group) =>
        `<section class="index-group mb-4"><div class="section-head"><h2>${group}</h2></div><div class="screen-grid">${entries
          .filter((item) => item[2] === group)
          .map(
            ([id, title]) =>
              `<a class="card screen-link" href="${url(id)}" data-screen-name="${title.toLowerCase()} ${group.toLowerCase()}"><span>${title}</span>${icon("arrow-up-right")}</a>`,
          )
          .join("")}</div></section>`,
    )
    .join(
      "",
    )}</div><p id="page-search-empty" class="d-none small" role="status">No hay pantallas con ese nombre.</p>`;
}

function renderDesignGuide() {
  return `${heading("Guía de continuidad", "La personalidad está en los detalles.", "Estas pautas mantienen la propuesta coherente al crecer.")}
  <div class="d-flex flex-wrap gap-2 mb-4"><a class="btn btn-primary" href="README.md" target="_blank">${icon("file-earmark-text")} Abrir README completo</a><a class="btn btn-outline-secondary" href="PAGE-MAP.md" target="_blank">Mapa de cobertura</a>${link("pages", "Todas las páginas", "btn btn-outline-secondary")}</div>
  <div class="swatch-grid mb-4">${[
    ["mint", "Aprender", "Cercanía y práctica"],
    ["blue", "Enseñar", "Preparación y resultados"],
    ["peach", "Quiz", "Pequeños retos"],
    ["lilac", "Conversación", "Personajes y diálogo"],
  ]
    .map(
      ([tone, title, copy]) =>
        `<div class="card p-4 tone-${tone}"><h3>${title}</h3><p class="small mb-0">${copy}</p></div>`,
    )
    .join("")}</div>
  <div class="row g-4"><div class="col-lg-7"><section class="card p-4"><h2 class="editorial fs-2">Profesional, cálido y adulto.</h2><p>Una escena para dar contexto. Un mockup para entender qué viene. Color para orientar y texto claro para decidir.</p><h3 class="mt-3">Conservar</h3><p>Flatly, el azul de marca, titulares editoriales, fondos cálidos, iconos Bootstrap y el mismo significado para cada color.</p><h3 class="mt-3">Elegir según la tarea</h3><p>Descubrir admite imágenes. Practicar necesita foco. Editar necesita espacio. Un informe necesita evidencias. Los ajustes necesitan claridad.</p><h3 class="mt-3">Una acción con sentido</h3><p class="mb-0">En cada pantalla debe quedar claro qué puedes hacer y cuál es el siguiente paso. Los ejemplos deben identificarse como ejemplos.</p></section></div><div class="col-lg-5">${featureNote("mint", "compass", "Aprendiendo", "Situaciones reales, confianza y un siguiente paso alcanzable. Verde, etiqueta de modo e información centrada en la persona.")}<div class="mt-3">${featureNote("blue", "easel", "Enseñando", "Crear con intención, comprender las respuestas y preparar lo que viene. Azul, etiqueta de modo y herramientas de autoría.")}</div></div></div>`;
}

function bindExtendedInteractions() {
  document.querySelectorAll("[data-local-form]").forEach((form) =>
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      form.querySelector(".local-feedback").textContent =
        "Listo en esta vista de ejemplo. No se enviaron ni guardaron datos en el sitio.";
    }),
  );
  document.querySelectorAll("[data-demo-next]").forEach((form) =>
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      location.hash = `${mode}/${form.dataset.demoNext}`;
    }),
  );
  document.querySelectorAll("[data-preview-share]").forEach((button) =>
    button.addEventListener("click", () => {
      const modal = document.querySelector("#share-modal");
      modal.addEventListener(
        "hidden.bs.modal",
        () => {
          location.hash = "learn/quiz-shared";
        },
        { once: true },
      );
      bootstrap.Modal.getInstance(modal).hide();
    }),
  );
  document.querySelector("#page-search")?.addEventListener("input", (event) => {
    const query = event.target.value.toLowerCase().trim();
    let visible = 0;
    document.querySelectorAll("[data-screen-name]").forEach((card) => {
      card.hidden = !card.dataset.screenName.includes(query);
      if (!card.hidden) visible++;
    });
    document.querySelectorAll(".index-group").forEach((group) => {
      group.hidden = ![...group.querySelectorAll("[data-screen-name]")].some(
        (card) => !card.hidden,
      );
    });
    document
      .querySelector("#page-search-empty")
      .classList.toggle("d-none", visible > 0);
  });
  bindResourceInteractions();
  bindMediaInteractions();
  bindAccountInteractions();
}
