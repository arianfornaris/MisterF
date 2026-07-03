import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { env } from '../config/env.js';

const roleplayCharacterAvatarSchema = z.object({
  age: z.number().int().min(1).max(120),
  gender: z.string().trim().min(1).max(80),
  id: z.string().trim().min(1).max(64).regex(/^[a-z][a-z0-9-]*$/),
  imageFile: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+\.png$/),
  name: z.string().trim().min(1).max(120),
  shortDescription: z.string().trim().min(1).max(260),
}).strict();

const roleplayCharacterAvatarRegistrySchema = z.object({
  characters: z.array(roleplayCharacterAvatarSchema).min(1),
}).strict();

export type RoleplayCharacterAvatar = z.infer<typeof roleplayCharacterAvatarSchema> & {
  imagePath: string;
};

function loadRoleplayCharacterAvatars(): RoleplayCharacterAvatar[] {
  const registryPath = path.join(env.projectRoot, 'src/server/roleplays/characters.json');
  const parsed = roleplayCharacterAvatarRegistrySchema.parse(
    JSON.parse(fs.readFileSync(registryPath, 'utf8')),
  );
  const ids = new Set<string>();

  return parsed.characters.map((character) => {
    if (ids.has(character.id)) {
      throw new Error(`Duplicate roleplay character avatar id: ${character.id}`);
    }
    ids.add(character.id);

    return {
      ...character,
      imagePath: `/public/roleplay-characters/${character.imageFile}`,
    };
  });
}

const roleplayCharacterAvatars = loadRoleplayCharacterAvatars();
const roleplayCharacterAvatarIds = new Set(
  roleplayCharacterAvatars.map((avatar) => avatar.id),
);

export function listRoleplayCharacterAvatars(): readonly RoleplayCharacterAvatar[] {
  return roleplayCharacterAvatars;
}

export function findRoleplayCharacterAvatar(id: string | null | undefined): RoleplayCharacterAvatar | null {
  if (!id) {
    return null;
  }

  return roleplayCharacterAvatars.find((avatar) => avatar.id === id) ?? null;
}

export function isRoleplayCharacterAvatarId(value: string): boolean {
  return roleplayCharacterAvatarIds.has(value);
}

export function normalizeRoleplayCharacterAvatarId(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return normalizeRoleplayCharacterAvatarId(value[0]);
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const id = value.trim().slice(0, 64);
  return id && isRoleplayCharacterAvatarId(id) ? id : undefined;
}

export function buildRoleplayCharacterAvatarPromptOptions(): string {
  return roleplayCharacterAvatars
    .map((avatar) => (
      `- ${avatar.id}: ${avatar.name}, age ${avatar.age}, ${avatar.gender}. ${avatar.shortDescription}`
    ))
    .join('\n');
}
