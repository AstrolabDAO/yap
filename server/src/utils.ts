import { Call as MultiCall } from "ethcall";
import { Request, Response } from "express";

import { getBalances as getCachedBalances, getRedis, setBalance, setBalances } from "./io";
import { getContract, getMultiContract, getMultiProvider } from "./state";
import { User } from "../../common/models";

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
  const r = await getRedis();
  const keys = xtokens.map((token) => `balance:${address}:${token}`);
  let balances = await getCachedBalances(address, xtokens);
  const balanceByToken: { [token: string]: bigint } = {};
  const callsByChainId: { [chainId: string]: MultiCall[] } = {};
  const tokensByChainId: { [chainId: string]: string[] } = {};

  for (let i = 0; i < xtokens.length; i++) {
    if (!balances[i]) {
      const [chainId, token] = xtokens[i].split(":");
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

  await Promise.all(Object.entries(callsByChainId).map(async ([chainId, calls]) => {
    const provider = await getMultiProvider(chainId);
    const results = await provider.all(calls);
    results.forEach((result, index) => {
      balanceByToken[tokensByChainId[chainId][index]] = BigInt(result as string);
    });
  }));

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

export { getBalance, getBalances, getFrom };
