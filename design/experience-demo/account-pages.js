/* Public and account screens. All submissions are local simulations. */
function publicShell(content) {
  return `<div class="public-shell"><header class="public-header"><a class="brand mb-0" href="${url("landing")}"><img src="assets/brand.png" alt="">Mister F<span class="dot">.</span></a><div class="d-flex gap-2">${link("pages", "Todas las páginas", "btn btn-outline-secondary btn-sm")}${link("login", "Entrar", "btn btn-primary btn-sm")}</div></header><main id="main" tabindex="-1" class="public-main">${content}</main><footer class="public-footer"><span>Propuesta visual · Datos de ejemplo</span><div>${link("privacy", "Privacidad", "")} · ${link("terms", "Términos", "")}</div></footer></div>`;
}

function renderPublicLanding() {
  return `<section class="public-hero"><div><div class="kicker">Inglés para conectar</div><h1>De una buena idea<br>a una conversación real.</h1><p class="lead mt-4">Crea actividades con intención. Practica situaciones cotidianas. Descubre qué puedes hacer después.</p><div class="d-flex flex-wrap gap-2 mt-4">${link("register", "Empezar")}${link("quiz-shared", "Probar una actividad", "btn btn-outline-secondary")}</div><p class="notice mt-3">Adaptación estática de referencia. El landing actual conserva su diseño.</p></div><div class="tone-blue rounded p-3">${reportPreview()}</div></section><section class="py-5"><div class="section-head"><h2 class="editorial fs-1">Una idea que se convierte en práctica.</h2></div><div class="row g-3">${pathCard("quiz", "Crea con intención", "Un texto, una situación o algo que quieras practicar.", "Explorar un quiz", "quiz-detail")}${pathCard("roleplay", "Hazlo conversación", "Un personaje y un contexto para usar lo aprendido.", "Conocer a Sofía", "roleplay-detail")}${pathCard("guide", "Encuentra tu siguiente paso", "Un recorrido que conecta la práctica con la vida.", "Explorar una guía", "guide-detail")}</div></section>`;
}

function authLayout(kicker, title, copy, form, kind = "chat") {
  return `<div class="auth-layout"><section class="auth-story tone-${kind === "guide" ? "mint" : "lilac"}"><div class="kicker">Un espacio para ti</div><h2 class="editorial">El inglés empieza<br>con una conexión.</h2>${mini(kind)}<p>Para aprender a tu ritmo.<br>Para enseñar con tus ideas.</p><img src="assets/restaurant.png" alt="Una conversación alrededor de una mesa"></section><section class="card auth-form"><div class="kicker">${kicker}</div><h1>${title}</h1><p class="mb-4">${copy}</p>${form}<p class="notice mt-4">Solo diseño: usa datos ficticios. No hay autenticación ni envío de formularios.</p></section></div>`;
}

function renderLogin() {
  return authLayout(
    "Bienvenido de nuevo",
    "Retoma la conversación.",
    "Tu espacio para aprender y enseñar te espera.",
    `<form data-demo-next="home"><button type="button" class="btn btn-outline-secondary w-100 mb-3" data-auth-example>${icon("google")} Continuar con Google · Demo</button><p class="small text-center">o con tu correo</p>${field("login-email", "Correo de ejemplo", "alex@example.test", "email")}${field("login-password", "Contraseña ficticia", "", "password")}<div class="mb-4">${link("forgot-password", "¿Olvidaste tu contraseña?", "small")}</div><button class="btn btn-primary w-100">Entrar al demo</button></form><p class="small mt-4 mb-0">¿Primera vez? ${link("register", "Crea tu cuenta", "")}</p>`,
  );
}
function renderRegister() {
  return authLayout(
    "Tu primer paso",
    "Hay mucho que puedes decir.",
    "Crea un espacio para tus prácticas y tus ideas.",
    `<form data-demo-next="verify-email">${field("register-name", "Nombre", "Alex Morgan")}${field("register-email", "Correo de ejemplo", "alex@example.test", "email")}${field("register-password", "Contraseña ficticia", "", "password")}<p class="small">Consulta el diseño de ${link("terms", "Términos", "")} y ${link("privacy", "Privacidad", "")}.</p><button class="btn btn-primary w-100">Ver siguiente paso de ejemplo</button></form><p class="small mt-4 mb-0">¿Ya tienes cuenta? ${link("login", "Iniciar sesión", "")}</p>`,
    "guide",
  );
}
function renderForgotPassword() {
  return authLayout(
    "Recuperar acceso",
    "Volvamos a conectar.",
    "Introduce un correo ficticio para recorrer el diseño de recuperación.",
    `<form data-demo-next="reset-password">${field("recovery-email", "Correo de ejemplo", "alex@example.test", "email")}<button class="btn btn-primary w-100">Ver recuperación de ejemplo</button></form><div class="mt-4">${link("login", "Volver a iniciar sesión", "")}</div>`,
  );
}
function renderVerifyEmail() {
  return `<section class="card state-card public-resource"><div class="state-symbol tone-mint">${icon("envelope-check")}</div><div class="kicker">Verificación · Ejemplo</div><h1>Un paso antes de empezar.</h1><p>Así se vería la pantalla para verificar tu correo. En esta demo no se envió ningún mensaje.</p><form class="verification-form mx-auto" data-demo-next="onboarding">${field("email-code", "Código de ejemplo", "123456")}<button class="btn btn-primary">Continuar con el ejemplo</button></form><button class="btn btn-link mt-3" data-resend-example>Ver aviso de reenvío</button><p id="resend-feedback" class="small" role="status"></p></section>`;
}
function renderResetPassword() {
  return authLayout(
    "Recuperar acceso",
    "Una nueva forma de entrar.",
    "Vista de ejemplo de restablecimiento de contraseña.",
    `<form data-demo-next="login">${field("reset-email", "Correo de ejemplo", "alex@example.test", "email")}${field("reset-code", "Código de ejemplo", "123456")}${field("reset-password", "Nueva contraseña ficticia", "", "password")}<button class="btn btn-primary w-100">Terminar ejemplo</button></form>`,
  );
}

function languageChoice(id = "profile-language") {
  return `<div class="mb-4"><label class="form-label" for="${id}">Idioma de las instrucciones</label><select class="form-select" id="${id}"><option>Español</option><option>English</option><option>Kreyòl ayisyen</option></select><p class="small mt-2">La práctica es en inglés. Este idioma te acompaña en las explicaciones.</p></div>`;
}

function renderOnboarding() {
  return `<div class="onboarding-wrap">${heading("Hagamos este espacio tuyo", "¿Qué te trae por aquí?", "Tu contexto ayuda a que cada práctica tenga más sentido.")}<form data-onboarding><fieldset><legend class="form-label">Quiero usar Mister F para…</legend><div class="row g-3 mb-4"><div class="col-md-6"><label class="card p-4 tone-mint h-100"><span class="d-flex gap-2 mb-2"><input class="form-check-input" name="onboarding-mode" type="radio" value="learn" checked>${icon("compass")} Estoy aprendiendo</span><span class="small">Sentirme más cómodo usando inglés en mi vida diaria.</span></label></div><div class="col-md-6"><label class="card p-4 tone-blue h-100"><span class="d-flex gap-2 mb-2"><input class="form-check-input" name="onboarding-mode" type="radio" value="teach">${icon("easel")} Estoy enseñando</span><span class="small">Crear materiales y acompañar a mis alumnos.</span></label></div></div></fieldset><section class="card p-4">${field("onboarding-name", "¿Cómo quieres llamar a tu perfil?", "Alex")}${languageChoice("onboarding-language")}${textField("onboarding-context", "¿En qué situaciones quieres usar el inglés?", "En el trabajo, al viajar y para conocer gente.", 3)}<div class="d-flex gap-2 flex-wrap"><button class="btn btn-primary">Entrar a mi espacio de ejemplo</button>${link("home", "Ahora no", "btn btn-outline-secondary")}</div></section></form></div>`;
}

function renderProfiles() {
  return `${heading("Tu cuenta", "Distintos contextos. Tu mismo espacio.", "Cada perfil puede tener su idioma de instrucciones y contexto.", link("profile-new", icon("plus-lg") + " Nuevo perfil"))}<div class="row g-4"><div class="col-md-6"><article class="card profile-card"><div class="tone-mint p-4"><span class="avatar profile-avatar">A</span><h2 class="mt-3">Alex · Inglés cotidiano</h2>${badge("Perfil activo")}</div><div class="card-body"><p>Quiero conversar con más confianza en el trabajo y cuando viajo.</p><p class="small">Instrucciones en español · Lite</p>${link("profile-edit", "Editar perfil", "btn btn-outline-secondary")}</div></article></div><div class="col-md-6"><article class="card profile-card"><div class="tone-blue p-4"><span class="avatar profile-avatar">A</span><h2 class="mt-3">Alex · Mis clases</h2>${badge("Contexto docente", "blue")}</div><div class="card-body"><p>Materiales para adultos que están empezando a usar inglés en su vida diaria.</p><p class="small">Instrucciones en español · Lite</p><a class="btn btn-primary" href="#teach/home">Usar ejemplo docente</a></div></article></div></div>`;
}

function profileForm(isNew) {
  return `<div class="settings-layout"><form class="card p-4" data-local-form>${field("profile-name", "Nombre del perfil", isNew ? "" : "Alex · Inglés cotidiano")}${textField("profile-description", "Descripción", isNew ? "" : "Un espacio para practicar inglés en situaciones cotidianas.", 3)}${textField("profile-context", "Contexto de aprendizaje", isNew ? "" : "Trabajo con personas que hablan inglés y quiero sentirme más cómodo al conversar.", 4)}${languageChoice()}<div class="mb-4"><label class="form-label" for="profile-tier">Experiencia del tutor</label><select id="profile-tier" class="form-select"><option>Lite</option><option>Plus</option><option>Pro</option></select><p class="small mt-2">Selector ilustrativo. Disponibilidad y consumo deben corresponder a la configuración real del producto.</p></div>${localSave()}</form><aside>${featureNote("mint", "person-heart", "Tu contexto hace la diferencia", "Escribe situaciones concretas. “Hablar con mis compañeros” ayuda más que “aprender mucho inglés”.")}<div class="card p-4 mt-3"><h3>Puedes ir ajustándolo</h3><p class="small mb-0">Tus objetivos cambian. Tu perfil también puede hacerlo.</p></div></aside></div>`;
}
function renderProfileNew() {
  return (
    heading(
      "Perfiles",
      "Un espacio para otro objetivo.",
      "Define el contexto de este nuevo perfil.",
    ) +
    crumbs([["Perfiles", "profiles"], ["Nuevo perfil"]]) +
    profileForm(true)
  );
}
function renderProfileEdit() {
  return (
    heading(
      "Perfiles",
      "Un perfil que habla de ti.",
      "Ajusta cómo quieres que el tutor te acompañe.",
    ) +
    crumbs([["Perfiles", "profiles"], ["Editar perfil"]]) +
    profileForm(false)
  );
}

function renderSettings() {
  return `${heading("Tu cuenta", "Todo en su lugar.", "Gestiona tu acceso y encuentra los ajustes de tus perfiles.")}<div class="settings-layout"><section><div class="card p-4 mb-3"><div class="d-flex gap-3"><div class="resume-icon tone-blue">${icon("person-circle")}</div><div><h2>Tu cuenta</h2><p class="small">alex@example.test · Datos ficticios</p></div></div><hr><div class="setting-row"><div><h3>Contraseña</h3><p class="small mb-0">Actualiza tu forma de acceder.</p></div>${link("password", "Cambiar", "btn btn-outline-secondary btn-sm")}</div></div><div class="card p-4"><div class="setting-row"><div><h3>Perfiles e idioma</h3><p class="small mb-0">Configura el contexto y las instrucciones.</p></div>${link("profiles", "Ver perfiles", "btn btn-outline-secondary btn-sm")}</div><hr><div class="setting-row"><div><h3>Créditos</h3><p class="small mb-0">Consulta el diseño del saldo y los paquetes.</p></div>${link("credits", "Ver créditos", "btn btn-outline-secondary btn-sm")}</div></div></section><aside>${featureNote("blue", "sliders", "Ajustes sin complicaciones", "Los ajustes generales se quedan aquí. El idioma y el contexto pertenecen a cada perfil.")}<div class="card p-4 mt-3"><h3>Información del sitio</h3><div class="d-flex flex-column gap-2">${link("privacy", "Privacidad", "")}${link("terms", "Términos", "")}${link("login", "Ver pantalla de sesión cerrada", "")}</div></div></aside></div>`;
}
function renderPassword() {
  return `${heading("Cuenta · Seguridad", "Una contraseña para seguir conectado.", "Formulario de diseño. No introduzcas contraseñas reales.")}${crumbs([["Ajustes", "settings"], ["Cambiar contraseña"]])}<form class="card p-4 narrow-form" data-local-form>${field("current-password", "Contraseña actual ficticia", "", "password")}${field("new-password", "Nueva contraseña ficticia", "", "password")}${field("confirm-password", "Repetir contraseña ficticia", "", "password")}${localSave("Simular cambio")}</form>`;
}

function renderCredits() {
  return `${heading("Tu cuenta", "Espacio para seguir practicando.", "Una vista clara del saldo y de las opciones para continuar.")}<section class="card library-banner tone-blue"><div><div class="kicker">Saldo de ejemplo</div><h2>120 créditos</h2><p>Las acciones de IA consumen crédito según la operación y la configuración.</p></div><div class="state-symbol tone-blue mb-0">${icon("wallet2")}</div></section><div class="section-head"><h2>Opciones de recarga</h2><span class="small">Estructura visual · Sin precios comerciales</span></div><div class="row g-3">${[
    ["Una práctica más", "Para retomar una conversación o probar una idea."],
    ["Un nuevo objetivo", "Para acompañar varias sesiones de práctica."],
    [
      "Más ideas para tus clases",
      "Para preparar materiales y explorar resultados.",
    ],
  ]
    .map(
      ([title, copy]) =>
        `<div class="col-lg-4"><section class="card p-4 h-100"><div class="kicker">Paquete de ejemplo</div><h3>${title}</h3><p class="small">${copy}</p><p class="small">Precio y cantidad: según catálogo vigente.</p><button class="btn btn-outline-secondary mt-auto" data-credit-example>Ver detalle de ejemplo</button></section></div>`,
    )
    .join(
      "",
    )}</div><div class="mt-3 small" id="credit-feedback" role="status"></div><p class="notice">Esta propuesta no define tarifas ni abre un pago. Los importes deben venir del catálogo real.</p>`;
}

function renderAdmin() {
  return `${heading("Administración · Vista restringida de ejemplo", "Una vista clara para gestionar.", "Solo datos ficticios. Este acceso existe aquí para revisar el diseño.")}<div class="stats"><div class="card stat"><strong>24</strong><span>Usuarios<br>de ejemplo</span></div><div class="card stat"><strong>18</strong><span>Perfiles activos<br>en el ejemplo</span></div><div class="card stat"><strong>6</strong><span>Pendientes de<br>verificación</span></div></div><div class="settings-layout"><section class="card p-4"><h2>Usuarios</h2><label for="admin-search" class="form-label mt-3">Buscar por nombre</label><input id="admin-search" class="form-control mb-3" type="search" placeholder="Buscar…"><div class="list-group">${["Alex Morgan", "Sam Rivera", "Jordan Lee"].map((name) => `<button class="list-group-item list-group-item-action py-3" data-admin-user="${name}"><strong>${name}</strong><small class="d-block text-muted">${name.split(" ")[0].toLowerCase()}@example.test</small></button>`).join("")}</div></section><section class="card p-4"><div class="kicker">Detalle seleccionado</div><h2 id="admin-user-name">Alex Morgan</h2><p class="small">Cuenta ficticia · Correo verificado</p><hr><h3>Créditos y configuración</h3><p>La gestión real de saldo, usuarios y claves permanece fuera de esta demo.</p><div class="tone-blue rounded p-3 small">${icon("shield-check")} Sin datos privados ni controles conectados.</div></section></div>`;
}

function legalLayout(title, intro, sections) {
  return `${heading("Información del sitio · Muestra de diseño", title, intro)}<div class="alert tone-blue">Texto ilustrativo para revisar legibilidad y navegación. No sustituye los documentos legales del sitio.</div><div class="legal-layout"><aside class="card p-4"><h2 class="h5">En esta página</h2>${sections.map(([label], index) => `<a class="d-block py-2" href="#legal-${index}" data-legal-jump="legal-${index}">${label}</a>`).join("")}</aside><article class="card p-4 p-md-5">${sections.map(([label, copy], index) => `<section id="legal-${index}" class="legal-section" tabindex="-1"><h2>${label}</h2><p>${copy}</p></section>`).join("")}</article></div>`;
}
function renderPrivacy() {
  return legalLayout(
    "Privacidad, con claridad.",
    "Una página tranquila para leer cómo se trata la información.",
    [
      [
        "Datos de la cuenta",
        "Este espacio presenta el tipo de información que debería explicar la política vigente: datos de acceso, perfiles y configuración.",
      ],
      [
        "Conversaciones y actividades",
        "La política debe explicar el tratamiento de conversaciones, respuestas y contenido creado, de acuerdo con las prácticas reales del servicio.",
      ],
      [
        "Proveedores y conservación",
        "Aquí se describirían los proveedores utilizados y los plazos aplicables, después de su revisión correspondiente.",
      ],
      [
        "Tus opciones y contacto",
        "Esta sección debe indicar los canales reales para consultar o ejercer las opciones disponibles. No se inventan compromisos ni contactos en esta muestra.",
      ],
    ],
  );
}
function renderTerms() {
  return legalLayout(
    "Las reglas de este espacio.",
    "Una estructura legible para los términos del servicio.",
    [
      [
        "Uso del servicio",
        "Esta muestra reserva espacio para explicar las condiciones de uso de la plataforma. No establece nuevas condiciones.",
      ],
      [
        "Actividades y contenido",
        "Aquí se describirían las condiciones aplicables a materiales, conversaciones y contenido compartido.",
      ],
      [
        "Créditos y pagos",
        "Las condiciones comerciales deben reflejar los paquetes y operaciones del producto real. Esta demo no fija importes ni políticas de reembolso.",
      ],
      [
        "Disponibilidad y contacto",
        "El texto definitivo debe revisarse de acuerdo con el servicio ofrecido y los canales de contacto vigentes.",
      ],
    ],
  );
}

function bindAccountInteractions() {
  document.querySelectorAll("[data-auth-example]").forEach((button) =>
    button.addEventListener("click", () => {
      location.hash = `${mode}/home`;
    }),
  );
  document
    .querySelector("[data-resend-example]")
    ?.addEventListener("click", () => {
      document.querySelector("#resend-feedback").textContent =
        "Así se confirmaría el reenvío. No se ha enviado ningún correo.";
    });
  document
    .querySelector("[data-onboarding]")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const selected = new FormData(event.target).get("onboarding-mode");
      location.hash = `${selected}/home`;
    });
  document.querySelectorAll("[data-credit-example]").forEach((button) =>
    button.addEventListener("click", () => {
      document.querySelector("#credit-feedback").textContent =
        "En el sitio, aquí se revisarían cantidad y precio antes del pago. No hay una transacción en esta demo.";
    }),
  );
  document.querySelectorAll("[data-admin-user]").forEach((button) =>
    button.addEventListener("click", () => {
      document.querySelector("#admin-user-name").textContent =
        button.dataset.adminUser;
    }),
  );
  document
    .querySelector("#admin-search")
    ?.addEventListener("input", (event) => {
      document.querySelectorAll("[data-admin-user]").forEach((button) => {
        button.hidden = !button.dataset.adminUser
          .toLowerCase()
          .includes(event.target.value.toLowerCase());
      });
    });
  document.querySelectorAll("[data-legal-jump]").forEach((anchor) =>
    anchor.addEventListener("click", (event) => {
      event.preventDefault();
      const section = document.getElementById(anchor.dataset.legalJump);
      section.scrollIntoView({ behavior: "smooth", block: "start" });
      section.focus({ preventScroll: true });
    }),
  );
}
