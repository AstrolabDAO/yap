import { Web3Modal } from "@web3modal/ethers";
import { createWeb3Modal, defaultConfig, useWeb3ModalAccount, useWeb3ModalProvider } from "@web3modal/ethers/vue";
import { BrowserProvider, JsonRpcSigner } from "ethers";
import { App, Ref, ref, watch } from "vue";

import { ASTROLAB_CDN, DEFAULT_USER_SETTINGS, W3M_PROJECTID, YAP_ENDPOINT } from "../../common/constants";
import { Network, Resource, Theme, User, UserSettings } from "../../common/models";
import { COLORS, THEMES } from "./constants";
import { clearNetworkTypeFromSlug } from "../../common/utils";

const networkById: Map<string | number, Network> = new Map();
const usedChainIds = new Set<string|number>([]);

let web3modal: Web3Modal = <any>{};
const user: Ref<User> = ref(<User>{});
let address: Ref<string> = ref("");
let isConnected: Ref<boolean> = ref(false);
const jwt = ref(localStorage.getItem("jwt") || "");
const theme: Ref<Theme> = ref(<Theme>localStorage.getItem("theme") || "dark");
let app: App = <any>{};
let socket: WebSocket = <any>{};

type ResourceStore = {
  byId: Record<string, any>;
  all: Ref<any>[];
}

const store: Record<Resource, ResourceStore> = {
  user: { byId: {}, all: [] },
  message: { byId: {}, all: [] },
  proposal: { byId: {}, all: [] },
  topic: { byId: {}, all: [] },
  vote: { byId: {}, all: [] },
  snapshot: { byId: {}, all: [] },
  airdrop: { byId: {}, all: [] },
};

const upsert = (type: Resource, data: any) => {
  if (!data.id) throw new Error(`Missing Id for: ${JSON.stringify(data)}`);
  const s = store[type];
  if (!s) throw new Error(`Invalid store type: ${type}`);
  let r = s.byId[data.id] ?? ref();
  r.value = data;
  s.byId[r.value.id] = r;
  const i = s.all.findIndex((ri) => ri.value?.id === r.value?.id);
  (i === -1) ? s.all.push(r) : s.all[i] = r;
}

const upsertAll = (type: Resource, data: any[]) => {
  data.forEach((d) => upsert(type, d));
}

const get = (type: Resource, id: string) => {
  const s = store[type];
  if (s.byId[id]) return s.byId[id];
}

const getAll = (type: Resource) => {
  return store[type].all;
}

const del = (type: Resource, id: string) => {
  const s = store[type];
  if (s.byId[id]) {
    delete s.byId[id];
    s.all = s.all.filter((v) => v.value?.id !== id);
  }
}

const delAll = (type: Resource) => {
  const s = store[type];
  s.byId = {};
  s.all = [];
}

const updateTheme = (t: Theme) => {
  if (user.value?.settings) {
    user.value.settings.theme = t;
  }
  localStorage.setItem(`userSettings:theme`, t);
  Object.entries(THEMES[t]).forEach(([name, value]) => {
    document.documentElement.style.setProperty(`--${name}`, <string>value);
  });
}

const setJwt = (t: string) => {
  localStorage.setItem('jwt', t);
  jwt.value = t;
}

const setUser = (u: User) => {
  user.value = u;
  upsert("user", u);
}

watch(theme, (newTheme, prevTheme) => (newTheme !== prevTheme) ? updateTheme(newTheme) : null);

async function init(app: App, socket: WebSocket) {
  [app, socket] = [app, socket];
  await initNetworks();
  await setupWeb3Modal().then((w3m) => console.log("Web3Modal initialized:", w3m));
  app.mount('#app');
  updateTheme(theme.value);

  socket.onopen = () => {
    console.log(`WebSocket connected to ${socket.url}`);
  }
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const { type, method } = data;
    switch (method) {
      case "create":
      case "update": upsert(type, data[type]); break;
      case "delete": del(type, data[type].id); break;
      default:
        throw new Error(`Invalid websocket method: ${method}`);
    }
  };
}


const featuredW3mWallets = {
  // metamask: "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96",
  // coinbase: "fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa",
  trust: "4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0",
  rainbow: "1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369",
  // zerion: "ecc4036f814562b41a5268adc86270fba1365471402006302e70169465b7ac18",
  // argent: "bc949c5d968ae81310268bf9193f9c9fb7bb4e1283e1284af8f2bd4992535fd6",
  safe: "225affb176778569276e484e1b92637ad061b01e13a048b35a9d280c3b58970f",
  fireblocks:
    "5864e2ced7c293ed18ac35e0db085c09ed567d67346ccb6f58a0327a75137489",
  ledgerlive:
    "19177a98252e07ddfc9af2083ba8e07ef627cb6103467ffebb3f8f4205fd7927",
  phantom: "a797aa35c0fadbfc1a53e7f675162ed5226968b44a19ee3d24385c64d1d3c393",
};

const bridgeableNetworks = [
  "ethereum-mainnet",
  "polygon-mainnet",
  "arbitrum-mainnet-one",
  "optimism-mainnet",
  "base-mainnet",
  "zksync-era-mainnet",
  "fantom-mainnet-opera",
  "avalanche-mainnet",
  "bnb-chain-mainnet",
  "gnosis-chain-mainnet",
  "scroll-mainnet",
  "linea-mainnet",
  "mantle-mainnet",
  "celo-mainnet",
  "moonbeam-mainnet",
  "kava-mainnet",
];

export const setupWeb3Modal = async () => {

  await initNetworks();

  const projectId = W3M_PROJECTID;
  const chainImages: { [id: number]: string } = {};
  for (const id of usedChainIds) {
    chainImages[<number>id] = `${ASTROLAB_CDN}/assets/images/networks/${clearNetworkTypeFromSlug(
      networkById.get(id)!.slug
    )}.svg`;
  }
  const chains = Array.from(usedChainIds)
    .map((n) => networkById.get(n))
    .map((n) => ({
      chainId: n!.id!,
      name: n!.name!,
      explorerUrl: n!.explorers[0]!,
      rpcUrl: n!.httpRpcs[0]!,
      currency: "ETH",
    }));
  const ethersConfig = defaultConfig({
    chains,
    metadata: {
      name: "Astrolab YAP",
      description: "YAP is a decentralized governance platform.",
      url: "https://yap.astrolab.fi",
      icons: ["/images/logo.png"],
    },
  });

  web3modal = createWeb3Modal({
    projectId,
    chains,
    ethersConfig,
    chainImages,
    featuredWalletIds: Object.values(featuredW3mWallets),
    themeMode: (user.value.settings?.theme ?? "dark") as any,
    themeVariables: {
      "--w3m-accent": THEMES[theme.value].primary,
      // '--w3m-color-mix': theme.value!.bg[0],
      // '--w3m-color-mix-strength': 40,
      "--w3m-font-family": THEMES[theme.value].bodyFont,
      "--w3m-font-size-master": ".5rem",
      "--w3m-border-radius-master": ".12rem",
    },
    enableAnalytics: true, // Optional - defaults to your Cloud configuration
    enableOnramp: true // Optional - false as default
  });

  // document.documentElement.style.setProperty(
  //   "--wui-color-modal-bg-base",
  //   theme.value!.bg[1]
  // );
  // web3Modal.subscribeEvents(event => { refreshData(); });
  // web3Modal.subscribeState(state => { refreshData(); });
  return web3modal;
};

async function initNetworks() {
  try {
    const ids = [];
    if (!usedChainIds.size) {
      const { chainIds } = await fetch(`${YAP_ENDPOINT}/stats/chainIds`).then((r) => r.json());
      for (const id of chainIds) {
        usedChainIds.add(id);
      }
    }
    if (!networkById?.size) {
      const response = await fetch(`${ASTROLAB_CDN}/data/networks.json`);
      for (const n of <Network[]>await response.json()) {
        if (!n.httpRpcs || !n.httpRpcs[0]) {
          console.error(`No HTTP RPCs found for used network ${n.slug}`);
        }
        networkById.set(n.slug, n);
        networkById.set(n.id, n);
        ids.push(n.id);
      }
    }
  } catch (error) {
    console.error("Error fetching network data:", error);
    throw new Error("Failed to initialize network providers");
  }
}

function loadSettings(): UserSettings {
  const settings = <any>{};
  for (const k of Object.keys(DEFAULT_USER_SETTINGS)) {
    const v = localStorage.getItem(`userSettings:${k}`) ?? (<any>DEFAULT_USER_SETTINGS)[k];
    settings[k] = v;
  }
  if (user.value) {
    user.value.settings = settings;
  }
  updateTheme(settings.theme);
  return settings;
}

function saveSettings(settings: UserSettings=user.value?.settings) {
  for (const k of Object.keys(settings)) {
    localStorage.setItem(`userSettings:${k}`, (<any>settings)[k] ?? (<any>DEFAULT_USER_SETTINGS)[k]);
  }
}

async function getProvider(): Promise<BrowserProvider> {
  const { walletProvider } = useWeb3ModalProvider();
  return new BrowserProvider(walletProvider.value!);
}

async function getSigner(): Promise<JsonRpcSigner> {
  return (await getProvider()).getSigner();
}

async function getAddress(): Promise<string> {
  const { address } = useWeb3ModalAccount();
  return address.value!;
}

export default {
  app,
  socket,
  store,
  jwt,
  theme,
  user,
  web3modal,
  get,
  getAll,
  del,
  delAll,
  upsert,
  upsertAll,
  init,
  networkById,
  usedChainIds,
  initNetworkProviders: initNetworks,
  setupWeb3Modal,
  loadSettings,
  saveSettings,
  getProvider,
  getSigner,
  getAddress,
  setJwt,
  setUser,
  address,
  isConnected,
};
