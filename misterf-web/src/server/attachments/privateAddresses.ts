/**
 * Address classification for SSRF defence.
 *
 * When the server fetches a user-supplied URL it becomes a proxy with the
 * network position of the application: it can reach the loopback interface, the
 * private network, and any cloud metadata endpoint. Everything that is not
 * plainly public internet is refused.
 */

import { isIP } from 'node:net';

/** Parses a dotted-quad into its four octets, or null when it is not IPv4. */
function parseIpv4(address: string): number[] | null {
  if (isIP(address) !== 4) {
    return null;
  }

  return address.split('.').map((part) => Number.parseInt(part, 10));
}

function isPrivateIpv4(address: string): boolean {
  const octets = parseIpv4(address);
  if (!octets) {
    return false;
  }

  const [a, b] = octets;

  return (
    a === 0 || // "this network"
    a === 10 || // RFC1918 private
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // RFC6598 carrier-grade NAT
    (a === 169 && b === 254) || // link-local, including cloud metadata
    (a === 172 && b >= 16 && b <= 31) || // RFC1918 private
    (a === 192 && b === 0) || // IETF protocol assignments and TEST-NET-1
    (a === 192 && b === 88) || // 6to4 relay anycast
    (a === 192 && b === 168) || // RFC1918 private
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    (a === 198 && b === 51) || // TEST-NET-2
    (a === 203 && b === 0) || // TEST-NET-3
    a >= 224 // multicast, reserved, broadcast
  );
}

function expandIpv6(address: string): string[] | null {
  if (isIP(address) !== 6) {
    return null;
  }

  const zoneless = address.split('%')[0];
  const [head, tail] = zoneless.split('::');
  const headGroups = head ? head.split(':').filter(Boolean) : [];
  const tailGroups = tail ? tail.split(':').filter(Boolean) : [];

  if (zoneless.includes('::')) {
    const missing = 8 - headGroups.length - tailGroups.length;
    return [...headGroups, ...Array(Math.max(missing, 0)).fill('0'), ...tailGroups];
  }

  return zoneless.split(':');
}

function isPrivateIpv6(address: string): boolean {
  const groups = expandIpv6(address);
  if (!groups) {
    return false;
  }

  const normalized = groups.map((group) => Number.parseInt(group || '0', 16));
  const [first] = normalized;

  // An IPv4-mapped address (::ffff:a.b.c.d) reaches an IPv4 destination, so it
  // has to be judged by the embedded IPv4 rules rather than the IPv6 ones.
  const mappedIpv4 = extractMappedIpv4(address);
  if (mappedIpv4) {
    return isPrivateIpv4(mappedIpv4);
  }

  const isUnspecified = normalized.every((group) => group === 0);
  const isLoopback =
    normalized.slice(0, 7).every((group) => group === 0) &&
    normalized[7] === 1;

  return (
    isUnspecified ||
    isLoopback ||
    (first & 0xfe00) === 0xfc00 || // fc00::/7 unique local
    (first & 0xffc0) === 0xfe80 || // fe80::/10 link-local
    (first & 0xff00) === 0xff00 || // ff00::/8 multicast
    first === 0x2001 && normalized[1] === 0x0db8 // 2001:db8::/32 documentation
  );
}

function extractMappedIpv4(address: string): string | null {
  const match = /::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  return match ? match[1] : null;
}

/**
 * True when an address must not be contacted on behalf of a user-supplied URL.
 * Anything that is not a recognizable IP literal is also refused, because the
 * caller is expected to pass a resolved address, and an unrecognized value
 * means the resolution step did not do what it was supposed to.
 */
export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) {
    return true;
  }

  return family === 4 ? isPrivateIpv4(address) : isPrivateIpv6(address);
}
