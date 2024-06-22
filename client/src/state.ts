import { Web3Modal } from "@web3modal/ethers";
import { useWeb3ModalAccount, useWeb3ModalProvider } from "@web3modal/ethers/vue";
import { BrowserProvider, JsonRpcSigner } from "ethers";
import { App, Ref, ref, watch } from "vue";
import { ASTROLAB_CDN, DEFAULT_USER_SETTINGS } from "../../common/constants";
import { Network, Resource, Theme, User, UserSettings } from "../../common/models";
import { COLORS } from "./constants";

const networkById: Map<string | number, Network> = new Map();
const usedChainIds = new Set<string|number>([]);

let web3modal: Web3Modal = <any>{};
const user: Ref<User> = ref(<User>{});
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
  if (user.value) {
    user.value.settings.theme = t;
  }
  localStorage.setItem(`userSettings:theme`, t);
  fetch
  Object.entries(COLORS).forEach(([name, value]) => {
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

function init(app: App, socket: WebSocket) {
  [app, socket] = [app, socket];
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

async function initNetworkProviders() {
  try {
    const ids = [];
    if (!networkById?.size) {
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
  initNetworkProviders,
  loadSettings,
  saveSettings,
  getProvider,
  getSigner,
  getAddress,
  setJwt,
  setUser,
};
