import { Call as MultiCall } from "ethcall";

import { getBalances as getCachedBalances, getRedis, setBalance, setBalances } from "./io";
import { getContract, getMultiContract, getMultiProvider, getProvider } from "./state";
import { Interval, User } from "../../common/models";
import { NATIVE_ALIAS } from "../../common/constants";

async function getBalance(address: string, xtoken: string): Promise<string> {
  const r = await getRedis();
  let balance: any = await r.get(`balance:${address}:${xtoken}`);
  if (!balance) {
    balance = await (await getContract(xtoken)).balanceOf(address);
    if (!balance) {
      throw new Error(`Failed to get balance for ${address}:${xtoken}`);
    }
    await setBalance(address, xtoken, <bigint>balance);
  }
  return balance;
}

async function getBalances(address: string, xtokens: string[]): Promise<bigint[]>{
  let balances = await getCachedBalances(address, xtokens);
  const balanceByToken: { [token: string]: bigint } = {};
  const callsByChainId: { [chainId: string]: MultiCall[] } = {};
  const tokensByChainId: { [chainId: string]: string[] } = {};
  const extraneousPromises = [];

  for (let i = 0; i < xtokens.length; i++) {
    if (!balances[i]) {
      const [chainId, token] = xtokens[i].split(":");
      if (token == NATIVE_ALIAS) {
        extraneousPromises.push(getProvider(chainId)
          .then(p => p.getBalance(address))
            .then(b => balanceByToken[xtokens[i]] = BigInt(b)));
        continue;
      }
      if (!callsByChainId[chainId]) {
        callsByChainId[chainId] = [];
        tokensByChainId[chainId] = [];
      }
      const contract = await getMultiContract(xtokens[i]);
      callsByChainId[chainId].push(contract.balanceOf(address));
      tokensByChainId[chainId].push(xtokens[i]);
    } else {
      balanceByToken[xtokens[i]] = BigInt(balances[i]);
    }
  }

  await Promise.all([
    ...Object.entries(callsByChainId).map(async ([chainId, calls]) => {
      const provider = await getMultiProvider(chainId);
      const results = await provider.all(calls);
      results.forEach((result, index) => {
        balanceByToken[tokensByChainId[chainId][index]] = BigInt(result as string);
      });
    }),
    ...extraneousPromises
  ]);

  balances = xtokens.map((token) => balanceByToken[token]);
  await setBalances(address, balanceByToken);
  return balances;
}

function getFrom<T>(from: any, what: string): T {
  const o = (<any>from)[what];
  if (!o) {
    throw new Error(`Missing ${what} in object: ${JSON.stringify(from)}`);
  }
  return o as T;
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function toSec(interval: number|Interval): number {
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
    case "s":
      return value;
    case "m":
      return value * 60;
    case "h":
      return value * 3600;
    case "D":
      return value * 86400;
    case "W":
      return value * 604800;
    case "M":
      return value * 2592000;
    case "Y":
      return value * 31536000;
    default:
      return value;
  }
}

function toMs(interval: number|Interval): number {
  return toSec(interval) * 1000;
}

function clonePartial(obj: any, exclude: string[]): any {
  const clone = { ...obj };
  exclude.forEach((key) => delete clone[key]);
  return clone;
}

export { getBalance, getBalances, getFrom, unique, toSec, toMs, clonePartial };
