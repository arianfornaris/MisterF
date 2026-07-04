import type { LocaleCatalog } from '../index.js';

export const en: LocaleCatalog = {
  common: {
    cancel: 'Cancel',
    close: 'Close',
    delete: 'Delete',
    understood: 'Got it',
    save: 'Save',
  },
  error: {
    unexpected: 'An unexpected error occurred.',
  },
  language: {
    label: 'Language',
    spanish: 'Spanish',
    english: 'English',
    switchToSpanish: 'Español',
    switchToEnglish: 'English',
  },
  nav: {
    chatControls: 'Chat controls',
    conversations: 'Conversations',
    translator: 'Translator',
    sidePanel: 'Side panel',
    goHome: 'Go to home',
    newConversation: 'New conversation',
    resources: 'Resources',
    progress: 'Progress',
    recent: 'Recent',
    conversationOptions: 'Conversation options',
    rename: 'Rename',
    finalizeAndSummarize: 'Finish and summarize',
    noConversations: 'No conversations yet.',
    signedOutTitle: 'Sign in to practice',
    signedOutBody:
      'Sign in or create an account to see practice options with Mr. F, your resources, and your saved conversations.',
    profile: 'Profile',
    switchProfile: 'Switch profile',
    accountSettings: 'Account settings',
    credits: 'Credits',
    signOut: 'Sign out',
    signIn: 'Sign in',
    createAccount: 'Create account',
  },
  deleteConversation: {
    title: 'Delete chat',
    bodyBefore: 'Are you sure you want to delete “',
    bodyAfter: '”? This action cannot be undone.',
  },
  closeTutorPlan: {
    title: 'Finish plan',
    body1:
      'This plan still has pending steps. If you finish it now, it will no longer appear as the active guide in this conversation.',
    body2:
      'The conversation is not deleted and you can keep practicing normally with Mr. F.',
  },
  createResource: {
    titlePrefix: 'Create',
    genericLabel: 'resource',
    body: 'Your instructions come first: describe what you want the resource to cover. You can refer to this conversation, which is included as supporting context.',
    promptLabel: 'Instructions for the resource',
    promptPlaceholder:
      'For example: a guide focused on the simple past we just used, with more writing exercises.',
    submit: 'Create resource',
    submitLoading: 'Creating resource...',
  },
  finalizeConversation: {
    title: 'Finish and summarize',
    body1:
      'Mister F will generate a summary of this conversation with what you practiced, your progress, main difficulties, key vocabulary, and recommendations.',
    body2:
      'After you finish it, the conversation becomes read-only and you can review the summary whenever you want.',
    submit: 'Finish and summarize',
    submitLoading: 'Generating summary...',
  },
  tutorReportPending: {
    title: 'Generating summary...',
    body: 'This may take a few seconds.',
  },
  translator: {
    title: 'Translator',
    mode: 'Translation mode',
    auto: 'Auto',
    esEn: 'ES → EN',
    enEs: 'EN → ES',
    inputLabel: 'Text to translate',
    copyText: 'Copy text',
    copyTranslation: 'Copy translation',
    submit: 'Translate',
  },
  credit: {
    title: 'Not enough credits',
    body: 'You don’t have enough credits to continue this practice.',
    buy: 'Buy credits',
  },
  practiceGuideHelp: {
    title: 'What the tutor can do',
    typesTitle: 'Kinds of practice you can ask for',
    type1: 'Translate from Spanish to English with guided correction.',
    type2: 'Understand English sentences and explain them in Spanish.',
    type3: 'Mini-conversations or role-play with fictional characters.',
    type4: 'Match columns of words, phrases, or meanings.',
    type5: 'Fill in blanks by typing or choosing options.',
    type6: 'Multiple choice with one or several correct answers.',
    type7: 'Reorder words to rebuild a sentence.',
    examplesTitle: 'Examples of useful instructions',
    example1:
      'Practice color vocabulary with varied exercises and lots of patient correction.',
    example2:
      'Do restaurant mini-conversations for a basic level, with a friendly tone and realistic situations.',
    example3:
      'Work on the simple past with short sentences, fill-in-the-blanks, and multiple choice.',
    example4:
      'Focus on English for job interviews with a formal tone and clear corrections.',
    goodPracticesTitle: 'Good practices',
    goodPractice1:
      'Specify the topic, the kind of situation, and the approximate level.',
    goodPractice2:
      'You can combine several activities within a single practice guide.',
    goodPractice3:
      'You don’t need to describe the interface; describe the learning goal.',
    goodPractice4:
      'You can say whether you want the tutor to be more patient, more demanding, or more conversational.',
  },
};
