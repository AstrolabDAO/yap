import { Interval } from "./models";

function shortenAddress(
  address: string,
  start = 4,
  end = 4,
  sep = "."
): string {
  const len = address.length;
  return address.slice(0, 2 + start) + sep + address.slice(len - end, len);
}

// borrowed from https://github.com/ethereumjs/ethereumjs-monorepo/util/src/internal.ts
function isHexPrefixed(str: string): boolean {
  return (str[0] + str[1]).toLowerCase() == "0x";
}

function padToEven(n: string): string {
  let a = n;
  if (a.length % 2) a = `0${a}`;
  return a;
}

const stripHexPrefix = (s: string): string =>
  isHexPrefixed(s) ? s.slice(2) : s;

const clearTrailing = (s: string, re: string): string =>
  s.replace(new RegExp(re + "$"), "");

const clearFrom = (s: string, regex: string): string =>
  s.substring(0, s.search(new RegExp(regex)));

const clearNetworkTypeFromSlug = (slug: string): string =>
  clearFrom(slug, "-mainnet|-testnet");

const clearNetworkTypeFromName = (name: string): string =>
  clearFrom(name, " Mainnet| Testnet");


function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function toSec(interval: number | Interval): number {
  if (typeof interval === "number") {
    return interval;
  }
  if (interval === "forever") {
    return Number.MAX_SAFE_INTEGER;
  }
  const match = interval.match(/^(\d+)(s|m|h|D|W|M|Y)?$/);
  if (!match) {
    throw new Error(`Invalid interval: ${interval}`);
  }
  const value = parseInt(match[1]);
  switch (match[2]) {
    case "s": return value;
    case "m": return value * 60;
    case "h": return value * 3600;
    case "D": return value * 86400;
    case "W": return value * 604800;
    case "M": return value * 2592000;
    case "Y": return value * 31536000;
    default: return value;
  }
}

function toMs(interval: number | Interval): number {
  return toSec(interval) * 1000;
}

function clonePartial(obj: any, { exclude = [], include = [] }: { exclude?: string[], include?: string[] }): any {
  const clone = { ...obj };
  if (include.length) {
    Object.keys(clone).forEach(key => !include.includes(key) && delete clone[key]);
  }
  if (exclude.length) {
    exclude.forEach(key => delete clone[key]);
  }
  return clone;
}

export {
  unique,
  toSec,
  toMs,
  clonePartial,
  shortenAddress,
  isHexPrefixed,
  padToEven,
  stripHexPrefix,
  clearTrailing,
  clearFrom,
  clearNetworkTypeFromSlug,
  clearNetworkTypeFromName,
};
