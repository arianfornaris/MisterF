/* Multimedia pages reuse the existing scene imagery and flat reading surfaces. */
function renderMediaLibrary() {
  return `${heading(icon("images") + " Biblioteca multimedia", "Una escena abre una conversación.", "Imágenes, guiones y audio para dar contexto a tu práctica.", link("media-new", icon("plus-lg") + " Crear escena"))}<section class="card library-banner tone-blue"><div><div class="kicker">Materiales que dan vida al inglés</div><h2>Empieza por lo que está pasando.</h2><p>Una imagen invita a observar. Un diálogo ayuda a escuchar. Una pregunta inicia la práctica.</p></div></section><div class="filter-row"><label class="visually-hidden" for="media-search">Buscar multimedia</label><input id="media-search" class="form-control search" type="search" placeholder="Buscar una escena…">${link("media-trash", "Ver papelera", "btn btn-outline-secondary btn-sm")}</div><div class="resource-grid">${[
    ["restaurant", "At the restaurant", "Pedir comida y conversar."],
    ["airport", "At the airport", "Orientarse y pedir ayuda."],
    ["workplace", "In the break room", "Romper el hielo en el trabajo."],
  ]
    .map(
      ([image, title, copy]) =>
        `<article class="card resource-card" data-media-name="${title.toLowerCase()}"><div class="resource-image"><img src="assets/${image}.png" alt="${title}"></div><div class="card-body"><div class="resource-meta"><span>Escena · A2</span><span>Imagen + guion</span></div><h3>${title}</h3><p>${copy}</p>${link("media-detail?scene=" + image, "Explorar escena " + icon("arrow-right"), "")}</div></article>`,
    )
    .join(
      "",
    )}</div><p id="media-search-status" class="small mt-3" role="status"></p>`;
}

function currentScene() {
  const scene = new URLSearchParams(location.hash.split("?")[1] || "").get(
    "scene",
  );
  return (
    {
      airport: {
        asset: "airport",
        title: "At the airport",
        summary:
          "Viajeros esperan para pasar el control de seguridad. Una persona pide indicaciones.",
        line: "Excuse me. Where is gate B12?",
      },
      workplace: {
        asset: "workplace",
        title: "In the break room",
        summary: "Dos compañeros conversan durante una pausa en el trabajo.",
        line: "Hi! How was your weekend?",
      },
    }[scene] || {
      asset: "restaurant",
      title: "At the restaurant",
      summary:
        "Un grupo de amigos pide comida. La camarera escucha sus preguntas y explica el menú.",
      line: "Hi! What would you like to order?",
    }
  );
}

function mediaScenePreview(scene) {
  return `<section class="card media-scene"><img src="assets/${scene.asset}.png" alt="${scene.summary}"><div class="card-body"><div class="kicker">Observa la escena</div><p class="mb-0">${scene.summary}</p></div></section>`;
}

function renderMediaDetail() {
  const scene = currentScene();
  const suffix = "?scene=" + scene.asset;
  return `${resourceHeading("media", scene.title, "", "media")}<div class="d-flex flex-wrap gap-2 mb-4">${link("create", icon("plus-lg") + " Crear actividad con esta idea")}${link("media-edit" + suffix, "Editar escena", "btn btn-outline-secondary")}${link("media-variation" + suffix, "Crear variación", "btn btn-outline-secondary")}</div><div class="detail-grid">${mediaScenePreview(scene)}<aside><section class="card p-4"><div class="kicker">Guion · Inglés A2</div><h2 class="editorial fs-2">Escucha lo que podría pasar.</h2><div class="script-line"><strong>Sofía</strong><p lang="en">${scene.line}</p></div><div class="script-line"><strong>Alex</strong><p lang="en">Could you help me, please?</p></div><div class="script-line"><strong>Sofía</strong><p lang="en">Of course. What do you need?</p></div><div class="tone-blue rounded p-3 mt-3 small">${icon("soundwave")} Audio pendiente en este ejemplo. La vista muestra dónde estarían los controles por turno.</div></section><section class="card p-4 mt-3"><h3>Ideas para usarla</h3><p class="small">Describe lo que ves, ensaya una pregunta o crea un quiz sobre la situación.</p>${link("quiz-new", "Crear un quiz", "")}</section></aside></div>`;
}

function renderMediaNew() {
  return `${resourceHeading("media", "Dale una escena a tu idea.", "Crear", "media")}<div class="create-layout"><section class="card p-4"><form data-demo-next="media-detail">${textField("scene-idea", "¿Qué está pasando?", "Una camarera ayuda a dos amigos a elegir su cena en un restaurante.", 5)}${field("scene-title", "Título", "At the restaurant")}<div class="mb-3"><label for="scene-level" class="form-label">Nivel del diálogo</label><select id="scene-level" class="form-select"><option>A1</option><option selected>A2</option><option>B1</option></select></div><fieldset class="mb-4"><legend class="form-label">Contenido</legend><label class="form-check"><input class="form-check-input" type="checkbox" checked> Imagen de la escena</label><label class="form-check"><input class="form-check-input" type="checkbox" checked> Guion de conversación</label><label class="form-check"><input class="form-check-input" type="checkbox"> Audio por turno</label></fieldset><button class="btn btn-primary">${icon("stars")} Ver escena de ejemplo</button><p class="notice">Se abre una escena existente del demo. No se genera contenido ni se consume crédito.</p></form></section><aside class="card p-4 tone-blue"><div class="kicker">Piensa en una situación concreta</div><h2 class="editorial fs-2">Una mesa.<br>Un menú.<br>Una pregunta.</h2><img class="rounded w-100 mt-3" src="assets/restaurant.png" alt="Escena de un restaurante"><p class="small mt-3 mb-0">El contexto visual ayuda a encontrar algo que decir.</p></aside></div>`;
}

function renderMediaEditor() {
  const scene = currentScene();
  return `${resourceHeading("media", scene.title, "Editando", "media", "media-detail?scene=" + scene.asset)}<div class="create-layout"><section class="card p-4"><form data-local-form>${field("media-title", "Título", scene.title)}${textField("media-summary", "Descripción visual", scene.summary, 4)}<h2 class="h5 mt-4">Guion</h2>${field("speaker-one", "Personaje · Turno 1", "Sofía")}${textField("line-one", "Diálogo · Turno 1", scene.line, 2)}${field("speaker-two", "Personaje · Turno 2", "Alex")}${textField("line-two", "Diálogo · Turno 2", "Could you help me, please?", 2)}${localSave()}</form></section><aside>${mediaScenePreview(scene)}<div class="mt-3">${featureNote("blue", "soundwave", "Audio por turno", "Los controles de regeneración y escucha se conectarían al guion en el producto. Esta demo no crea ni reproduce audio.")}</div></aside></div>`;
}

function renderMediaVariation() {
  const scene = currentScene();
  return `${resourceHeading("media", "La misma escena, otra posibilidad.", "Variación", "media", "media-detail?scene=" + scene.asset)}<div class="create-layout"><section class="card p-4"><form data-demo-next="media-detail"><div class="kicker">Basada en ${scene.title}</div>${textField("variation-idea", "¿Qué quieres cambiar?", "Simplifica el diálogo para alguien que está empezando. Mantén la misma situación.", 5)}<label for="variation-level" class="form-label">Nivel de la variación</label><select class="form-select mb-4" id="variation-level"><option>A1 · Principiante</option><option>A2 · Básico</option><option>B1 · Intermedio</option></select><button class="btn btn-primary">${icon("stars")} Ver variación de ejemplo</button><p class="notice">Este botón abre la escena predefinida. El original y sus archivos no se modifican.</p></form></section><aside>${mediaScenePreview(scene)}</aside></div>`;
}
function renderMediaTrash() {
  return trashContent("media");
}
function bindMediaInteractions() {
  document
    .querySelector("#media-search")
    ?.addEventListener("input", (event) => {
      let count = 0;
      document.querySelectorAll("[data-media-name]").forEach((card) => {
        card.hidden = !card.dataset.mediaName.includes(
          event.target.value.toLowerCase(),
        );
        if (!card.hidden) count++;
      });
      document.querySelector("#media-search-status").textContent =
        count + " escenas de ejemplo";
    });
}
