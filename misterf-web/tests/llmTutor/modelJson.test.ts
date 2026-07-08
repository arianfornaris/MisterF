import { describe, expect, it } from 'vitest';
import { parseJsonFromModelText } from '../../src/server/services/llmTutor/modelJson.js';

describe('parseJsonFromModelText', () => {
  it('parses plain JSON output', () => {
    expect(parseJsonFromModelText(' {"a": 1} ')).toEqual({ a: 1 });
  });

  it('strips a ```json markdown fence around the object', () => {
    expect(parseJsonFromModelText('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(parseJsonFromModelText('```\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(parseJsonFromModelText('```JSON\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it('throws a correctable-classified error on invalid JSON', () => {
    expect(() => parseJsonFromModelText('Claro, aquí tienes el quiz:')).toThrow(
      /JSON parsing failed/,
    );
    expect(() => parseJsonFromModelText('```json\n{"a": \n```')).toThrow(
      /JSON parsing failed/,
    );
  });
});
