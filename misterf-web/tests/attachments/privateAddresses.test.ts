import { describe, expect, it } from 'vitest';

import { isBlockedAddress } from '../../src/server/attachments/privateAddresses.js';

describe('isBlockedAddress', () => {
  it('allows ordinary public addresses', () => {
    for (const address of [
      '8.8.8.8',
      '1.1.1.1',
      '93.184.216.34',
      '172.32.0.1',
      '192.169.0.1',
      '2606:4700:4700::1111',
      '2a00:1450:4001:80f::200e',
    ]) {
      expect(isBlockedAddress(address), address).toBe(false);
    }
  });

  it('blocks loopback, private, and link-local IPv4', () => {
    for (const address of [
      '0.0.0.0',
      '10.0.0.1',
      '127.0.0.1',
      '127.1.2.3',
      '169.254.169.254',
      '172.16.0.1',
      '172.31.255.254',
      '192.168.1.1',
      '100.64.0.1',
      '198.18.0.1',
      '224.0.0.1',
      '255.255.255.255',
    ]) {
      expect(isBlockedAddress(address), address).toBe(true);
    }
  });

  it('blocks the cloud metadata address specifically', () => {
    expect(isBlockedAddress('169.254.169.254')).toBe(true);
  });

  it('blocks loopback, unique-local, and link-local IPv6', () => {
    for (const address of [
      '::',
      '::1',
      'fc00::1',
      'fd12:3456:789a::1',
      'fe80::1',
      'ff02::1',
      '2001:db8::1',
    ]) {
      expect(isBlockedAddress(address), address).toBe(true);
    }
  });

  it('judges IPv4-mapped IPv6 by the embedded IPv4 address', () => {
    expect(isBlockedAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isBlockedAddress('::ffff:169.254.169.254')).toBe(true);
    expect(isBlockedAddress('::ffff:8.8.8.8')).toBe(false);
  });

  it('blocks anything that is not a resolved IP literal', () => {
    for (const value of ['example.com', 'localhost', '', 'not-an-address']) {
      expect(isBlockedAddress(value), value).toBe(true);
    }
  });
});
