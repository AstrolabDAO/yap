import { JsonRpcProvider, Contract } from "ethers";
import { ASTROLAB_CDN, DEFAULT_ABI } from "../../common/constants";
import { Network } from "../../common/models";
import { Provider as MultiProvider, Contract as MultiContract } from "ethcall";
import config from "./config";
import Redis from "ioredis";

const networkById: Map<string|number, Network> = new Map();
const providerByNetworkId: Map<string, JsonRpcProvider> = new Map();
const multiProviderByNetworkId: Map<string, JsonRpcProvider[]> = new Map();
const contractByXAddress: Map<string, Contract> = new Map();
const multiContractByXAddress: Map<string, MultiContract> = new Map();
let redis: Redis;

async function getRedis() {
  if (!redis || !(redis.status === "ready")) {
    redis = await new Redis(config.redis);
  }
  return redis;
}

async function getProvider(networkId: string, multi=false): Promise<JsonRpcProvider|MultiProvider> {
  const targetMap = multi ? multiProviderByNetworkId : providerByNetworkId;
  if (!targetMap.has(networkId)) {
    await initNetworkProviders();
    if (!targetMap.has(networkId)) {
      throw new Error(`Provider not found for network ID ${networkId}`);
    }
  }
  return targetMap.get(networkId);
}

async function getMultiProvider(networkId: string): Promise<MultiProvider> {
  return getProvider(networkId, true) as MultiProvider;
}

async function getContract(xaddress: string, multi=false, abi=DEFAULT_ABI): Promise<Contract> {
  const targetMap = multi ? multiContractByXAddress : contractByXAddress;
  if (!targetMap.has(xaddress)) {
    const [chainId, address] = xaddress.split(":");
    const provider = await getProvider(chainId);
    contractByXAddress.set(xaddress, new Contract(address, ["function balanceOf(address) view returns (uint)"], provider));
    multiContractByXAddress.set(xaddress, new MultiContract(address, abi));
  }
  return contractByXAddress.get(xaddress);
}

async function getMultiContract(xaddress: string, abi=DEFAULT_ABI): Promise<MultiContract> {
  return getContract(xaddress, true, abi);
}

async function initNetworkProviders() {
  try {
    const ids = [];
    if (networkById.size === 0) {
      const response = await fetch(`${ASTROLAB_CDN}/data/networks.json`);
      for (const n of await response.json()) {
        networkById.set(n.slug, n);
        networkById.set(n.id, n);
        ids.push(n.id);
      }
    }
    if (providerByNetworkId.size > 0) {
      return; // Already initialized
    }
    for (const id of ids) {
      const provider = new JsonRpcProvider(networkById.get(id).httpRpcs[0]);
      providerByNetworkId.set(id, provider);
      multiProviderByNetworkId.set(id, new MultiProvider(id, provider));
    }
  } catch (error) {
    console.error("Error fetching network data:", error);
    throw new Error("Failed to initialize network providers");
  }
}

export { getProvider, getContract, getMultiProvider, getMultiContract, getRedis };
