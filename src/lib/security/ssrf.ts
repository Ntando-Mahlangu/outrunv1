import dns from "node:dns";
import { Agent } from "undici";

const PRIVATE_IPV4_RANGES: Array<[string, number]> = [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local (includes cloud metadata 169.254.169.254)
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation (TEST-NET-1)
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation (TEST-NET-2)
  ["203.0.113.0", 24], // documentation (TEST-NET-3)
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved
];

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map(Number);
  return (((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0);
}

function isPrivateIPv4(ip: string): boolean {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return false;
  const ipInt = ipv4ToInt(ip);
  return PRIVATE_IPV4_RANGES.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (ipInt & mask) === (ipv4ToInt(base) & mask);
  });
}

function isPrivateIPv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) {
    const embedded = normalized.slice(7);
    if (/^\d+\.\d+\.\d+\.\d+$/.test(embedded)) return isPrivateIPv4(embedded);
  }
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fe80:") || // link-local
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") // unique local
  );
}

/** True if this resolved address must never be connected to from a server-side fetch. */
export function isPrivateAddress(address: string, family: number): boolean {
  return family === 4 ? isPrivateIPv4(address) : isPrivateIPv6(address);
}

/**
 * A DNS lookup that refuses to resolve to a private/internal/link-local
 * address — the actual SSRF defense (docs/outrun/15 "SECURITY"). Plugged
 * into a dedicated undici Agent below so it runs on every TCP connection
 * a server-side fetch makes, including ones made after following a
 * redirect — a URL that passes validation once but redirects to
 * 169.254.169.254 (or resolves there via DNS rebinding) is still refused
 * on the actual connection, not just the initial request.
 *
 * node:dns's own lookup() has no built-in timeout — a slow or blackholed
 * resolver can hang it indefinitely. Since this function is the `lookup`
 * plugged into every connection undici's Agent makes, that hang sits
 * underneath fetch()'s own AbortSignal.timeout() rather than inside it,
 * so the delivery-level timeout in dispatch.ts can't be relied on alone
 * to bound it. LOOKUP_TIMEOUT_MS below is the actual backstop.
 */
const LOOKUP_TIMEOUT_MS = 5_000;

function safeLookup(
  hostname: string,
  options: dns.LookupOptions,
  callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void,
): void {
  let settled = false;
  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    callback(new Error(`DNS lookup for ${hostname} timed out.`), "");
  }, LOOKUP_TIMEOUT_MS);

  dns.lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
    if (settled) return;
    clearTimeout(timer);
    settled = true;

    if (err) {
      callback(err, "");
      return;
    }
    if (addresses.length === 0) {
      callback(new Error(`Could not resolve ${hostname}.`), "");
      return;
    }
    const unsafe = addresses.find((a) => isPrivateAddress(a.address, a.family));
    if (unsafe) {
      callback(new Error(`Refusing to connect to a private/internal address (${unsafe.address}).`), "");
      return;
    }

    // Node's own connect logic (Happy Eyeballs / autoSelectFamily) may call
    // this lookup with `all: true` and expects the full address list back,
    // not a single pair — respect that shape or every real connection
    // attempt fails with ERR_INVALID_IP_ADDRESS.
    if (options.all) {
      callback(null, addresses);
      return;
    }
    const chosen = addresses[0]!;
    callback(null, chosen.address, chosen.family);
  });
}

/** Shared dispatcher for every server-side fetch of a user-supplied URL. */
export const ssrfSafeDispatcher = new Agent({ connect: { lookup: safeLookup } });

/**
 * Cheap, synchronous rejection of obviously-unsafe URLs before even
 * attempting a fetch — non-http(s) schemes, "localhost", and literal
 * IP-address hosts in a private range. The dispatcher above is the real
 * defense (it also catches DNS resolving a normal-looking hostname to a
 * private address), but this gives an immediate, clear error for the
 * common case instead of a generic network failure.
 */
export function assertPubliclyRoutableUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs are supported.");
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("That URL points to a local address, which isn't allowed.");
  }
  if (isPrivateIPv4(hostname) || isPrivateIPv6(hostname)) {
    throw new Error("That URL points to a private address, which isn't allowed.");
  }

  return url;
}
