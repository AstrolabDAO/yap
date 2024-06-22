import { App, Ref, ref, watch } from "vue";
import { Network, Resource, Theme, ThemeConfig, User } from "../../common/models";
import { ASTROLAB_CDN } from "../../common/constants";
import { Web3Modal } from "@web3modal/ethers";
import { COLORS, THEMES } from "./constants";

const networkById: Map<string | number, Network> = new Map();
const usedChainIds = new Set<string|number>([]);

let web3modal: Web3Modal = <any>{};
const user: Ref<User> = ref(<User>{});
const jwt = localStorage.getItem("jwt") || "";
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
  if (user.value) user.value.settings.theme = t;
  localStorage.setItem("theme", t);
  Object.entries(COLORS).forEach(([name, value]) => {
    document.documentElement.style.setProperty(`--${name}`, <string>value);
  });
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
  initNetworkProviders
};
