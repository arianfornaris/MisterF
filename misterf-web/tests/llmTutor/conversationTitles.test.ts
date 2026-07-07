import { describe, expect, it } from 'vitest';
import {
  isGenericConversationTitle,
  normalizeConversationTitle,
} from '../../src/server/services/llmTutor/conversationTitles.js';

describe('isGenericConversationTitle', () => {
  it('recognizes the default titles of all three instruction languages', () => {
    expect(isGenericConversationTitle('Nueva conversación')).toBe(true);
    expect(isGenericConversationTitle('New conversation')).toBe(true);
    expect(isGenericConversationTitle('Nouvo konvèsasyon')).toBe(true);
    expect(isGenericConversationTitle('Conversación')).toBe(true);
    expect(isGenericConversationTitle('Conversation')).toBe(true);
    expect(isGenericConversationTitle('Konvèsasyon')).toBe(true);
    expect(isGenericConversationTitle('')).toBe(true);
    expect(isGenericConversationTitle('  ')).toBe(true);
  });

  it('ignores case, diacritics, and punctuation noise', () => {
    expect(isGenericConversationTitle('NUEVA CONVERSACION')).toBe(true);
    expect(isGenericConversationTitle('nueva  conversación!')).toBe(true);
    expect(isGenericConversationTitle('nouvo konvesasyon')).toBe(true);
  });

  it('treats real topics as specific titles', () => {
    expect(isGenericConversationTitle('Práctica de presente perfecto')).toBe(false);
    expect(isGenericConversationTitle('Job interview practice')).toBe(false);
    expect(isGenericConversationTitle('Pratik vokabilè restoran')).toBe(false);
  });
});

describe('normalizeConversationTitle', () => {
  it('collapses whitespace, trims, and caps the length at 90 characters', () => {
    expect(normalizeConversationTitle('  Práctica   de \n verbos  ')).toBe('Práctica de verbos');
    expect(normalizeConversationTitle(undefined)).toBe('');
    expect(normalizeConversationTitle('x'.repeat(120))).toHaveLength(90);
  });
});
