import { Contract as MultiContract, Provider as MultiProvider } from "ethcall";
import { Contract, JsonRpcProvider, JsonFragment } from "ethers";
import { Server } from "http";
import WebSocket from "ws";
import { Express } from "express";

import { ASTROLAB_CDN, DEFAULT_ABI } from "../../common/constants";
import { EligibilityCriteria, Network, WsMethod } from "../../common/models";
import config from "./config";
import { getEligibility, getUser, grantRole, pushEligibilities, pushSpamFilters } from "./io";
import { createUserFromAddress } from "./user";

const networkById: Map<string | number, Network> = new Map();
const providerByNetworkId: Map<string | number, JsonRpcProvider> = new Map();
const multiProviderByNetworkId: Map<string | number, MultiProvider> = new Map();
const contractByXAddress: Map<string, Contract> = new Map();
const multiContractByXAddress: Map<string, MultiContract> = new Map();
let server: Server = <any>{};
let app: Express = <any>{};
let wss: WebSocket.Server = <any>{};

const xTokenAliases: { [alias: string]: string } =
  config.governance.eligibility.aliases;

const usedChainIds = new Set<number|string>(
  [
    Object.values(config.governance.eligibility.aliases).map((alias) =>
      getChainId(alias)
    ),
    ["messaging", "proposing", "voting"].map((type) =>
      Object.values(
        <EligibilityCriteria>(<any>config.governance.eligibility)[type]
      ).map((crit) => getChainId(crit.xtoken))
    ),
  ].flat(2)
);

function getXToken(xtoken: string): string {
  return xTokenAliases[xtoken] || xtoken;
}

function getChainId(xtoken: string): string {
  return getXToken(xtoken).split(":")[0];
}

// const pushMessageCreate = (message: any) => pushToClients(message, "create", "message");
// const pushMessageUpdate = (message: any) => pushToClients(message, "update", "message"); // upvote, downvote, edit
// const pushMessageDelete = (message: any) => pushToClients(message, "delete", "message");
// const pushProposalCreate = (proposal: any) => pushToClients(proposal, "create", "proposal");
// const pushProposalUpdate = (proposal: any) => pushToClients(proposal, "update", "proposal");
// const pushProposalDelete = (proposal: any) => pushToClients(proposal, "delete", "proposal");
// const pushTopicCreate = (topic: any) => pushToClients(topic, "create", "topic");
// const pushTopicUpdate = (topic: any) => pushToClients(topic, "update", "topic");
// const pushTopicDelete = (topic: any) => pushToClients(topic, "delete", "topic");
// const pushVoteCreate = (vote: any) => pushToClients(vote, "create", "vote"); // proposal vote

async function pushToClients(
  data: any,
  method: WsMethod = "create",
  resource = "message"
) {
  // state.wss.emit(topic, message);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ method, resource, data }));
    } else {
      client.close();
    }
  }
}

async function getProvider(
  networkId: string | number,
  multi = false
): Promise<JsonRpcProvider> {
  const targetMap = multi ? multiProviderByNetworkId : providerByNetworkId;
  if (!targetMap.has(networkId)) {
    await initNetworkProviders();
    if (!targetMap.has(networkId)) {
      throw new Error(`Provider not found for network ID ${networkId}`);
    }
  }
  return targetMap.get(networkId) as JsonRpcProvider;
}

async function getMultiProvider(networkId: string): Promise<MultiProvider> {
  return (await getProvider(networkId, true)) as any as MultiProvider;
}

async function getContract(
  xaddress: string,
  multi = false,
  abi = DEFAULT_ABI
): Promise<Contract> {
  const targetMap = multi ? multiContractByXAddress : contractByXAddress;
  if (!targetMap.has(xaddress)) {
    const [chainId, address] = xaddress.split(":");
    const provider = await getProvider(chainId);
    contractByXAddress.set(
      xaddress,
      new Contract(
        address,
        ["function balanceOf(address) view returns (uint)"],
        provider as any
      )
    );
    multiContractByXAddress.set(
      xaddress,
      new MultiContract(address, abi as JsonFragment[])
    );
  }
  return contractByXAddress.get(xaddress) as Contract;
}

async function getMultiContract(
  xaddress: string,
  abi = DEFAULT_ABI
): Promise<MultiContract> {
  return (await getContract(xaddress, true, abi)) as any as MultiContract;
}

async function initNetworkProviders() {
  try {
    const ids = [];
    if (networkById.size === 0) {
      const response = await fetch(`${ASTROLAB_CDN}/data/networks.json`);
      for (const n of <Network[]>await response.json()) {
        if (!usedChainIds.has(n.id)) {
          continue;
        }
        if (!n.httpRpcs || !n.httpRpcs[0]) {
          throw new Error(`No HTTP RPCs found for used network ${n.slug}`);
        }
        networkById.set(n.slug, n);
        networkById.set(n.id, n);
        ids.push(n.id);
      }
    }
    if (providerByNetworkId.size > 0) {
      return; // Already initialized
    }
    for (const id of ids) {
      const provider = new JsonRpcProvider(networkById.get(id)?.httpRpcs[0]);
      providerByNetworkId.set(id, provider);
      multiProviderByNetworkId.set(id, new MultiProvider(id, provider));
    }
    console.log(`Initialized providers for networks: ${ids}`);
  } catch (error) {
    console.error("Error fetching network data:", error);
    throw new Error("Failed to initialize network providers");
  }
}

export {
  getContract,
  getMultiContract,
  getMultiProvider,
  getProvider,
  pushToClients,
  xTokenAliases,
  usedChainIds,
  getXToken,
  getChainId,
  initNetworkProviders,
};
export default { server, app, wss };
