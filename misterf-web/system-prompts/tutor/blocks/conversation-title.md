/**
 * Conversation title update.
 *
 * Use only when the purpose or topic is clear and the current title is generic.
 * Follow the current title rule from the surrounding prompt variables.
 */
interface ConversationTitleBlock {
  /** Literal discriminator. */
  type: "conversation_title";
  /** Short Spanish title for the current conversation. */
  title: string;
}
