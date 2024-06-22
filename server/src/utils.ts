import { Call as MultiCall } from "ethcall";

import { NATIVE_ALIAS } from "../../common/constants";
import { Schema, ValidationOption } from "../../common/models";
import {
  getBalances as getCachedBalances,
  getRedis,
  setBalance,
  setBalances,
} from "./io";
import {
  getContract,
  getMultiContract,
  getMultiProvider,
  getProvider,
} from "./state";

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

async function getBalances(
  address: string,
  xtokens: string[]
): Promise<number[]> {
  let balances = await getCachedBalances(address, xtokens);
  const balanceByToken: { [token: string]: number } = {};
  const callsByChainId: { [chainId: string]: MultiCall[] } = {};
  const tokensByChainId: { [chainId: string]: string[] } = {};
  const extraneousPromises = [];

  for (let i = 0; i < xtokens.length; i++) {
    if (!balances[i]) {
      const [chainId, token] = xtokens[i].split(":");
      if (token === NATIVE_ALIAS) {
        extraneousPromises.push(
          getProvider(chainId)
            .then(p => p.getBalance(address))
            .then(b => (balanceByToken[xtokens[i]] = Number(b) / 1e18))
        );
        continue;
      }
      if (!callsByChainId[chainId]) {
        callsByChainId[chainId] = [];
        tokensByChainId[chainId] = [];
      }
      const contract = await getMultiContract(xtokens[i]);
      callsByChainId[chainId].push(contract.balanceOf(address), contract.decimals());
      tokensByChainId[chainId].push(xtokens[i]);
    } else {
      balanceByToken[xtokens[i]] = balances[i];
    }
  }

  await Promise.all([
    ...Object.entries(callsByChainId).map(async ([chainId, calls]) => {
      const provider = await getMultiProvider(chainId);
      const results = await provider.all(calls);
      for (let i = 0; i < results.length; i += 2) {
        const xtoken = tokensByChainId[chainId][i / 2];
        const decimals = Number(results[i + 1]);
        balanceByToken[xtoken] = Number(results[i]) / 10 ** decimals;
      }
    }),
    ...extraneousPromises,
  ]);

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

function validate(
  o: any,
  schema: Schema,
  options: ValidationOption={}
): boolean {

  options = { allowPartial: false, allowExtend: false, ...(options) };
  const getType = (value: any) =>
    value === null ? "null" : Array.isArray(value) ? "array" : typeof value;

  if (typeof schema === "string") return getType(o) === schema;
  if (Array.isArray(schema))
    return (
      Array.isArray(o) && o.every((item) => validate(item, schema[0], options))
    );

  const formatKeys = Object.keys(schema);
  const objectKeys = Object.keys(o);

  if (!options.allowPartial && formatKeys.some((key) => !(key in o))) {
    return false; // Missing required keys in non-partial mode
  }

  if (!options.allowExtend && objectKeys.some((key) => !(key in schema))) {
    return false; // Extra keys in non-extend mode
  }

  return formatKeys.every(
    (key) => key in o && validate(o[key], schema[key], options)
  );
}

export {
  getBalance,
  getBalances,
  getFrom,
  validate
};

