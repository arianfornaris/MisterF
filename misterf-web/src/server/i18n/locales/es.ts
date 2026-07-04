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
