import type { LocaleCatalog } from '../index.js';

export const es: LocaleCatalog = {
  common: {
    cancel: 'Cancelar',
    close: 'Cerrar',
    delete: 'Eliminar',
    understood: 'Entendido',
    save: 'Guardar',
  },
  error: {
    unexpected: 'Ocurrió un error inesperado.',
  },
  auth: {
    kicker: {
      login: 'Bienvenido',
      signup: 'Crea tu cuenta',
      forgot: 'Recuperación',
      reset: 'Seguridad',
    },
    heading: {
      login: 'Iniciar sesión',
      signup: 'Empezar a practicar',
      forgot: 'Recuperar contraseña',
      reset: 'Nueva contraseña',
    },
    intro: {
      login: 'Entra para continuar practicando con Mr. F.',
      signup: 'Crea tu cuenta y empieza con tus créditos iniciales.',
      forgot: 'Te enviaremos un código para restablecer tu contraseña.',
      reset: 'Escribe el código recibido y define tu nueva contraseña.',
    },
    submit: {
      login: 'Entrar',
      signup: 'Crear cuenta',
      forgot: 'Enviar código',
      reset: 'Actualizar contraseña',
    },
    googleContinue: 'Continuar con Google',
    or: 'o',
    fullName: 'Nombre completo',
    email: 'Correo',
    code: 'Código',
    password: 'Contraseña',
    passwordHelp: 'Usa al menos 10 caracteres.',
    confirmPassword: 'Repite la contraseña',
    noAccount: '¿No tienes cuenta?',
    createOne: 'Crea una',
    forgotPassword: 'Olvidé mi contraseña',
    hasAccount: '¿Ya tienes cuenta?',
    signIn: 'Inicia sesión',
    backToLogin: 'Volver a iniciar sesión',
    privacy: 'Privacidad',
    terms: 'Términos',
    documentTitle: {
      login: 'Iniciar sesión',
      signup: 'Crear cuenta',
      forgot: 'Recuperar contraseña',
      reset: 'Nueva contraseña',
    },
    error: {
      tooManyAttempts:
        'Demasiados intentos. Espera unos minutos y vuelve a probar.',
      invalidCredentials: 'El correo o el password no son correctos.',
      invalidOrExpiredCode: 'El código no es válido o ya expiró.',
      wrongCurrentPassword: 'El password actual no es correcto.',
    },
    field: {
      emailRequired: 'Escribe tu correo.',
      passwordRequired: 'Escribe tu password.',
      emailInvalid: 'Escribe un correo válido.',
      emailExists: 'Ya existe una cuenta con este correo.',
      fullNameRequired: 'Escribe tu nombre completo.',
      passwordTooShort: 'Usa al menos 10 caracteres.',
      confirmRequired: 'Repite tu password.',
      passwordsMismatch: 'Los passwords no coinciden.',
      resetEmailRequired: 'Escribe el correo de tu cuenta.',
      codeRequired: 'Escribe el código que recibiste.',
      currentPasswordRequired: 'Escribe tu password actual.',
      confirmNewRequired: 'Repite la nueva contraseña.',
      newPasswordsMismatch: 'Las contraseñas no coinciden.',
    },
    serviceError: {
      openrouterWithReason:
        'No pude preparar la cuenta de IA para este usuario: {{reason}}',
      openrouter: 'No pude preparar la cuenta de IA para este usuario.',
      mailWithReason: 'No pude enviar el email: {{reason}}',
      mail: 'No pude enviar el email por un error inesperado.',
    },
    message: {
      changePasswordTitle: 'Cambiar contraseña',
      forgotSentTitle: 'Revisa tu correo',
      forgotSentBody:
        'Si existe una cuenta con ese correo, enviamos un código para recuperar el password.',
      forgotSentLink: 'Escribir código',
      passwordUpdatedTitle: 'Contraseña actualizada',
      passwordUpdatedResetBody:
        'Tu contraseña fue actualizada. Ya puedes iniciar sesión.',
      passwordUpdatedChangeBody:
        'Tu contraseña fue actualizada. Vuelve a iniciar sesión.',
      signInLink: 'Iniciar sesión',
      verifyTitle: 'Verifica tu correo',
      verifyEnterCode: 'Escribe el código que enviamos a tu correo.',
      invalidCodeTitle: 'Código inválido',
      invalidCodeBody: 'El código de verificación no es válido o ya expiró.',
      verifiedTitle: 'Correo verificado',
      verifiedBody:
        'Tu correo ya está verificado. Completa tu perfil de aprendizaje para que Mr. F pueda adaptar mejor la práctica.',
      completeProfileLink: 'Completar perfil',
      mailFailTitle: 'No pude enviar el email',
      resentBody: 'Enviamos otro código de verificación a tu correo.',
      verifyNeededBody:
        'Antes de usar el tutor, escribe el código que enviamos a {{email}}.',
      resendVerification: 'Reenviar verificación',
      verifyEmailButton: 'Verificar correo',
      back: 'Volver',
    },
    changePassword: {
      kicker: 'Seguridad',
      titleChange: 'Cambiar contraseña',
      titleCreate: 'Crear contraseña',
      copy: 'Protege tu cuenta con una contraseña segura. Después del cambio tendrás que iniciar sesión otra vez.',
      currentPassword: 'Contraseña actual',
      newPassword: 'Nueva contraseña',
      confirmPassword: 'Repite la nueva contraseña',
      submit: 'Actualizar contraseña',
      backToSettings: 'Volver a ajustes de cuenta',
    },
  },
  profiles: {
    kicker: 'Perfiles',
    listTitle: 'Cambiar perfil',
    listCopy: 'Cada perfil mantiene separadas sus conversaciones y guías de práctica.',
    create: 'Crear perfil',
    cardKicker: 'Perfil',
    active: 'Activo',
    noDescription: 'Sin descripción.',
    editActive: 'Editar datos y preferencias',
    useThis: 'Usar este perfil',
    listEmpty:
      'Todavía no hay perfiles. Crea el primero para separar tu práctica en distintos contextos.',
    editTitle: 'Editar perfil',
    newTitle: 'Nuevo perfil',
    editCopy: 'Ajusta los datos y preferencias de práctica de este perfil.',
    newCopy:
      'Crea un perfil separado para organizar conversaciones, guías y preferencias sin mezclarlas con las demás.',
    name: 'Nombre',
    description: 'Descripción',
    descriptionHelp: 'Una nota breve para distinguir este perfil.',
    context: 'Contexto para Mr. F',
    contextHelp:
      'Puedes mencionar tus objetivos, intereses, trabajo, estudios, nivel aproximado o situaciones donde quieres usar inglés.',
    saveEdit: 'Guardar cambios',
    saveNew: 'Crear perfil',
    languageLegend: 'Idioma de instrucción',
    languageHelpForm:
      'El idioma de la interfaz y de las explicaciones de Mr. F para este perfil. El inglés que se practica no cambia.',
    languageHelpOnboarding:
      '¿En qué idioma prefieres la interfaz y las explicaciones de Mr. F?',
    spanishDescForm: 'La interfaz y las explicaciones en español.',
    spanishDescOnboarding:
      'La interfaz y las explicaciones en español. El inglés que practicas sigue siendo inglés.',
    englishDesc: 'Interface and explanations in English, for full immersion.',
    modelLegend: 'Modelo por defecto',
    modelHelp: 'Este modelo se usará en las conversaciones nuevas de este perfil.',
    modelRegular: 'Regular',
    modelRegularDesc: 'Muy rápido. Ideal para práctica frecuente con costo 1x.',
    modelAdvanced: 'Avanzado',
    modelAdvancedDesc:
      'Más inteligente y todavía rápido. Úsalo cuando quieras más precisión con costo 2x.',
    modelMax: 'Max',
    modelMaxDesc:
      'La opción más potente y más lenta. Recomendable para sesiones exigentes con costo 8x.',
    onbAria: 'Completa tu perfil',
    onbKicker: 'Perfil de aprendizaje',
    onbTitle: 'Ayuda a Mr. F a conocerte mejor',
    onbIntro:
      'Estos datos no son parte de tu cuenta pública. Sirven para adaptar las prácticas a tus metas, intereses y contexto.',
    onbNameLabel: 'Nombre del perfil',
    onbNameHelp: 'Por ejemplo: Arian, Inglés para trabajo, Viajes, Examen.',
    onbDescLabel: 'Descripción breve',
    onbDescHelp: 'Una nota corta para reconocer este perfil cuando tengas varios.',
    onbContextHelp:
      'Puedes contar para qué quieres aprender inglés, en qué trabajas o estudias, qué temas te interesan y qué se te hace difícil.',
    save: 'Guardar y continuar',
    skip: 'Omitir por ahora',
  },
  settings: {
    kicker: 'Cuenta',
    title: 'Ajustes de cuenta',
    intro: 'Gestiona tu cuenta y tus preferencias.',
    languageSectionKicker: 'Idioma',
    languageTitle: 'Idioma de instrucción',
    languageCopy:
      'El idioma de la interfaz y de las explicaciones de Mr. F para el perfil activo. El inglés que se practica no cambia.',
    languageSave: 'Guardar idioma',
    securityKicker: 'Seguridad',
    passwordTitle: 'Contraseña',
    passwordCopy:
      'Actualiza la contraseña de tu cuenta cuando necesites reforzar tu acceso.',
    changePassword: 'Cambiar contraseña',
  },
  language: {
    label: 'Idioma',
    spanish: 'Español',
    english: 'Inglés',
    switchToSpanish: 'Español',
    switchToEnglish: 'English',
  },
  nav: {
    chatControls: 'Controles del chat',
    conversations: 'Conversaciones',
    translator: 'Traductor',
    sidePanel: 'Panel lateral',
    goHome: 'Ir al inicio',
    newConversation: 'Nueva conversación',
    resources: 'Recursos',
    progress: 'Progreso',
    recent: 'Recientes',
    conversationOptions: 'Opciones de conversación',
    rename: 'Renombrar',
    finalizeAndSummarize: 'Finalizar y resumir',
    noConversations: 'Todavía no hay conversaciones.',
    signedOutTitle: 'Abre una sesión para practicar',
    signedOutBody:
      'Inicia sesión o crea una cuenta para ver las opciones de práctica con Mr. F, tus recursos y conversaciones guardadas.',
    profile: 'Perfil',
    switchProfile: 'Cambiar perfil',
    accountSettings: 'Ajustes de cuenta',
    credits: 'Créditos',
    signOut: 'Cerrar sesión',
    signIn: 'Iniciar sesión',
    createAccount: 'Crear cuenta',
  },
  chat: {
    ariaLabel: 'Chat con Mister F',
    closedNotice:
      'Conversación finalizada. Puedes revisar el historial o consultar su resumen.',
    tabConversation: 'Conversación',
    tabSummary: 'Resumen',
    summaryKicker: 'Resumen de conversación',
    preparingPractice: 'Preparando práctica...',
    practiceThese: 'Practicar estos puntos',
    createResource: 'Crear recurso',
    resourceTypeQuiz: 'Quiz',
    resourceTypePracticeGuide: 'Guía de práctica',
    resourceTypeRoleplay: 'Roleplay',
    summaryPracticed: 'Lo que practicaste',
    summaryProgress: 'Progreso observado',
    summaryDifficulties: 'Dificultades principales',
    summaryVocabulary: 'Vocabulario importante',
    summaryExample: 'Ejemplo:',
    summaryPhrases: 'Frases útiles',
    summaryRecommendations: 'Recomendaciones',
    summaryNextSteps: 'Próximos pasos',
    summaryUnavailableTitle: 'Resumen no disponible',
    summaryUnavailableBody:
      'Todavía no hay un resumen guardado para esta conversación.',
    practiceGuideKicker: 'Guía de Práctica',
    practiceGuideStarting: 'Comenzando la guía de práctica...',
    practiceGuideStart: 'Comenzar',
    messagePlaceholder: 'Escribe tu mensaje',
    finalize: 'Finalizar y resumir',
    send: 'Enviar',
  },
  clientChat: {
    resourceLabelQuiz: 'quiz',
    resourceLabelPracticeGuide: 'guía de práctica',
    resourceLabelRoleplay: 'roleplay',
    resourceLabelGeneric: 'recurso',
    newTitleAriaLabel: 'Nuevo título de la conversación',
    creditExhaustedShort:
      'Tu crédito de práctica se agotó por ahora. Puedes recargar crédito o intentarlo de nuevo más tarde.',
    creditExhaustedMessage:
      'Me quedé sin créditos para continuar esta práctica ahora mismo. Compra créditos y te traigo de vuelta aquí para seguir justo donde nos quedamos.\n\n[Comprar créditos]({{buyPath}})',
    authRequired:
      'Para practicar con Mr. F necesitas autenticarte. [Inicia sesión](/login) o [crea una cuenta](/signup).',
    greeting:
      '¡Hola! Soy Mr. F, tu tutor de inglés. Cuéntame qué quieres practicar hoy.',
    guestSaveHint:
      'Perfecto. Para guardar tu práctica y continuar esta conversación, [inicia sesión](/login) o [crea una cuenta](/signup). Cuando regreses, continuaré desde tu primer mensaje.',
    connectionLost:
      'Se perdió la conexión con el servidor. Intentando reconectar. ({{reason}})',
    conversationUpdateFailed: 'No pude actualizar la conversación.',
    responseError:
      'Se me enredó la respuesta y no quiero confundirte. Inténtalo otra vez en unos segundos.',
  },
  deleteConversation: {
    title: 'Eliminar chat',
    bodyBefore: '¿Seguro que quieres eliminar “',
    bodyAfter: '”? Esta acción no se puede deshacer.',
  },
  closeTutorPlan: {
    title: 'Concluir plan',
    body1:
      'Este plan todavía tiene pasos pendientes. Si lo concluyes ahora, dejará de aparecer como guía activa en esta conversación.',
    body2:
      'La conversación no se borra y puedes seguir practicando normalmente con Mr. F.',
  },
  createResource: {
    titlePrefix: 'Crear',
    genericLabel: 'recurso',
    body: 'Tus instrucciones son lo principal: describe qué quieres que cubra el recurso. Puedes referirte a esta conversación, que se incluye como contexto de apoyo.',
    promptLabel: 'Instrucciones para el recurso',
    promptPlaceholder:
      'Por ejemplo: una guía centrada en el pasado simple que usamos hace un momento, con más ejercicios de escritura.',
    submit: 'Crear recurso',
    submitLoading: 'Creando recurso...',
  },
  finalizeConversation: {
    title: 'Finalizar y resumir',
    body1:
      'Mister F generará un resumen de esta conversación con lo que practicaste, tus avances, dificultades principales, vocabulario importante y recomendaciones.',
    body2:
      'Después de finalizarla, la conversación quedará en modo lectura y podrás consultar el resumen cuando quieras.',
    submit: 'Finalizar y resumir',
    submitLoading: 'Generando resumen...',
  },
  tutorReportPending: {
    title: 'Generando resumen...',
    body: 'Esto puede tardar unos segundos.',
  },
  translator: {
    title: 'Traductor',
    mode: 'Modo de traducción',
    auto: 'Auto',
    esEn: 'ES → EN',
    enEs: 'EN → ES',
    inputLabel: 'Texto para traducir',
    copyText: 'Copiar texto',
    copyTranslation: 'Copiar traducción',
    submit: 'Traducir',
  },
  credit: {
    title: 'Créditos insuficientes',
    body: 'No tienes créditos suficientes para continuar esta práctica.',
    buy: 'Comprar créditos',
  },
  practiceGuideHelp: {
    title: 'Qué puede hacer el tutor',
    typesTitle: 'Tipos de práctica que puedes pedir',
    type1: 'Traducir del español al inglés con corrección guiada.',
    type2: 'Comprender frases en inglés y explicarlas en español.',
    type3: 'Mini-conversaciones o role-play con personajes ficticios.',
    type4: 'Emparejar columnas de palabras, frases o significados.',
    type5: 'Completar espacios escribiendo o eligiendo opciones.',
    type6: 'Multiple choice de una o varias respuestas correctas.',
    type7: 'Ordenar palabras para reconstruir una oración.',
    examplesTitle: 'Ejemplos de instrucciones útiles',
    example1:
      'Practica vocabulario de colores con ejercicios variados y mucha corrección paciente.',
    example2:
      'Haz mini-conversaciones de restaurante para un nivel básico, con tono amable y situaciones realistas.',
    example3:
      'Trabaja el pasado simple con frases cortas, completar espacios y multiple choice.',
    example4:
      'Enfócate en inglés para entrevistas de trabajo con tono formal y correcciones claras.',
    goodPracticesTitle: 'Buenas prácticas',
    goodPractice1:
      'Especifica el tema, el tipo de situación y el nivel aproximado.',
    goodPractice2:
      'Puedes combinar varias dinámicas dentro de una misma guía de práctica.',
    goodPractice3:
      'No hace falta describir la interfaz; describe el objetivo pedagógico.',
    goodPractice4:
      'Puedes decir si quieres que el tutor sea más paciente, más exigente o más conversacional.',
  },
};
