import { ethers } from "ethers";
import config from "./config";
import { User } from "../../common/models";
import { getContract, getRedis } from "./state";
import { getMultiProvider } from "./state.js";

/**
 * Generates a message to be signed by the user for a vote.
 * @param proposalId - The ID of the proposal being voted on.
 * @param vote - The vote value (1 for "for", -1 for "against", 0 for "abstain").
 * @param user - The user object containing balances and address.
 * @returns The message string to be signed.
 */
function generateVoteMessage(proposalId: string, vote: number, user: User): string {
  const relevantBalances = {}; // Extract balances relevant to voting eligibility
  for (const group of config.governance.eligibility.voting) {
    relevantBalances[group.token] = user.balances[group.token] || 0;
  }
  const message = JSON.stringify({
    proposalId,
    vote,
    balances: relevantBalances,
    timestamp: Date.now(), // To prevent replay attacks
  });
  return message;
}

/**
 * Verifies a signed vote message.
 * @param message - The original message that was signed.
 * @param signature - The signature provided by the user.
 * @returns The address of the signer if the signature is valid, null otherwise.
 */
function verifyVoteSignature(message: string, signature: string): string | null {
  try {
    const sig = ethers.Signature.from(signature); // r,s,v...
    return ethers.recoverAddress(ethers.hashMessage(message), sig);
  } catch (error) {
    console.error("Error verifying signature:", error);
    return null; // Invalid signature
  }
}

async function getBalance(address: string, xtoken: string): Promise<string> {
  const r = await getRedis();
  let balance = await r.get(`balance:${address}:${xtoken}`);
  if (!balance) {
    balance = await (await getContract(xtoken)).balanceOf(address);
    await r.setex(`balance:${address}:${xtoken}`, config.cache.balances_ttl, balance);
  }
  return balance;
}

async function getBalances(address: string, xtokens: string[]): Promise<bigint[]>{
  const r = await getRedis();
  const keys = xtokens.map((token) => `balance:${address}:${token}`);
  let balances = (await r.mget(keys)).map((balance) => BigInt(balance));
  const balanceByToken: { [token: string]: bigint } = {};
  const callsByChainId: { [chainId: string]: Promise<any>[] } = {};
  const tokensByChainId: { [chainId: string]: string[] } = {};

  for (let i = 0; i < xtokens.length; i++) {
    if (!balances[i]) {
      const [chainId, token] = xtokens[i].split(":");
      if (!callsByChainId[chainId]) {
        callsByChainId[chainId] = [];
        tokensByChainId[chainId] = [];
      }
      const contract = await getContract(xtokens[i]);
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
      balanceByToken[tokensByChainId[chainId][index]] = BigInt(result);
    });
  }));

  balances = xtokens.map((token) => balanceByToken[token]);
  await r.mset(...keys.flatMap((key, i) => [key, balances[i].toString()]));
  return balances;
}

export { generateVoteMessage, verifyVoteSignature, getBalance, getBalances };
