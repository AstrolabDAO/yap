import { Contract as MultiContract, Provider as MultiProvider } from "ethcall";
import { Contract, JsonRpcProvider } from "ethers";

import { JsonFragment } from "ethers";
import { ASTROLAB_CDN, DEFAULT_ABI } from "../../common/constants";
import { Network } from "../../common/models";
import config from "./config";
import { grantRole } from "./io";

const networkById: Map<string|number, Network> = new Map();
const providerByNetworkId: Map<string|number, JsonRpcProvider> = new Map();
const multiProviderByNetworkId: Map<string|number, MultiProvider> = new Map();
const contractByXAddress: Map<string, Contract> = new Map();
const multiContractByXAddress: Map<string, MultiContract> = new Map();

async function getProvider(networkId: string, multi=false): Promise<JsonRpcProvider|MultiProvider> {
  const targetMap = multi ? multiProviderByNetworkId : providerByNetworkId;
  if (!targetMap.has(networkId)) {
    await initNetworkProviders();
    if (!targetMap.has(networkId)) {
      throw new Error(`Provider not found for network ID ${networkId}`);
    }
  }
  return targetMap.get(networkId) as JsonRpcProvider|MultiProvider;
}

async function getMultiProvider(networkId: string): Promise<MultiProvider> {
  return await getProvider(networkId, true) as MultiProvider;
}

async function getContract(xaddress: string, multi=false, abi=DEFAULT_ABI): Promise<Contract|MultiContract> {
  const targetMap = multi ? multiContractByXAddress : contractByXAddress;
  if (!targetMap.has(xaddress)) {
    const [chainId, address] = xaddress.split(":");
    const provider = await getProvider(chainId);
    contractByXAddress.set(xaddress, new Contract(address, ["function balanceOf(address) view returns (uint)"], provider as any));
    multiContractByXAddress.set(xaddress, new MultiContract(address, abi as JsonFragment[]));
  }
  return contractByXAddress.get(xaddress) as Contract|MultiContract;
}

async function getMultiContract(xaddress: string, abi=DEFAULT_ABI): Promise<MultiContract> {
  return await getContract(xaddress, true, abi) as MultiContract;
}

async function initNetworkProviders() {
  try {
    const ids = [];
    if (networkById.size === 0) {
      const response = await fetch(`${ASTROLAB_CDN}/data/networks.json`);
      for (const n of <Network[]>(await response.json())) {
        networkById.set(n.slug, n);
        networkById.set(n.id, n);
        ids.push(n.id);
      }
    }
    console.log(`Initializing providers for networks: ${ids}...`);
    if (providerByNetworkId.size > 0) {
      return; // Already initialized
    }
    for (const id of ids) {
      const provider = new JsonRpcProvider(networkById.get(id)?.httpRpcs[0]);
      providerByNetworkId.set(id, provider);
      multiProviderByNetworkId.set(id, new MultiProvider(id, provider));
    }
  } catch (error) {
    console.error("Error fetching network data:", error);
    throw new Error("Failed to initialize network providers");
  }
}

async function initializeRoles() {
  console.log(`Initializing roles: ${JSON.stringify(config.moderation)}...`);
  return Promise.all([
    config.moderation.admins.forEach((a) => grantRole(a, "adm")),
    config.moderation.moderators.forEach((m) => grantRole(m, "mod")),
    config.governance.governors.forEach((g) => grantRole(g, "gov")),
  ]);
}

async function initialize() {
  await initNetworkProviders();
  await initializeRoles();
}

export { getContract, getMultiContract, getMultiProvider, getProvider };

