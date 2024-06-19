import { App, Ref, ref } from "vue";

let app: App = <any>{};
let socket: WebSocket = <any>{};
type ResourceStore = {
  byId: Record<string, any>;
  all: Ref<any>[];
}

const store: Record<string, ResourceStore> = {
  message: { byId: {}, all: [] },
  proposal: { byId: {}, all: [] },
  topic: { byId: {}, all: [] },
  vote: { byId: {}, all: [] },
  user: { byId: {}, all: [] },
};

const upsert = (type: string, data: any) => {
  if (!data.id) throw new Error(`Missing Id for: ${JSON.stringify(data)}`);
  const s = store[type];
  if (!s) throw new Error(`Invalid store type: ${type}`);
  let r = s.byId[data.id] ?? ref();
  r.value = data;
  s.byId[r.value.id] = r;
  const i = s.all.findIndex((ri) => ri.value?.id === r.value?.id);
  (i === -1) ? s.all.push(r) : s.all[i] = r;
}

const upsertAll = (type: string, data: any[]) => {
  data.forEach((d) => upsert(type, d));
}

const get = (type: string, id: string) => {
  const s = store[type];
  if (s.byId[id]) return s.byId[id];
}

const getAll = (type: string) => {
  return store[type].all;
}

const del = (type: string, id: string) => {
  const s = store[type];
  if (s.byId[id]) {
    delete s.byId[id];
    s.all = s.all.filter((v) => v.value?.id !== id);
  }
}

const delAll = (type: string) => {
  const s = store[type];
  s.byId = {};
  s.all = [];
}

function init(app: App, socket: WebSocket) {
  [app, socket] = [app, socket];
  app.mount('#app');

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

export default {
  app,
  socket,
  store,
  get,
  getAll,
  del,
  delAll,
  upsert,
  upsertAll,
  init
};
