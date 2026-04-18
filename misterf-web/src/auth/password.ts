import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';

const keyLength = 64;
const scryptOptions = {
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
};

function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(
    password,
    salt,
    keyLength,
    scryptOptions,
  );

  return [
    'scrypt',
    'v=1',
    `n=${scryptOptions.N}`,
    `r=${scryptOptions.r}`,
    `p=${scryptOptions.p}`,
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(
  password: string,
  storedHash: string | null,
): Promise<boolean> {
  if (!storedHash) {
    return false;
  }

  const parts = storedHash.split('$');
  if (parts.length !== 7 || parts[0] !== 'scrypt') {
    return false;
  }

  const settings = Object.fromEntries(
    parts.slice(2, 5).map((item) => {
      const [key, value] = item.split('=');
      return [key, Number.parseInt(value, 10)];
    }),
  );

  const salt = Buffer.from(parts[5], 'base64url');
  const expected = Buffer.from(parts[6], 'base64url');
  const actual = await scrypt(password, salt, expected.length, {
    N: settings.n,
    r: settings.r,
    p: settings.p,
    maxmem: 64 * 1024 * 1024,
  });

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
