import http from "http";
import cors from "cors";
import express from "express";
import WebSocket from "ws";

import config from "./src/config";
import state, { initNetworkProviders } from "./src/state";
import vote from "./src/routers/vote";
import message from "./src/routers/message";
import topic from "./src/routers/topic";
import proposal from "./src/routers/proposal";
import moderation from "./src/routers/moderation";
import stats from "./src/routers/stats";
import setupWs from "./src/routers/ws";
import { initRoles, initEligibility } from "./src/user";
import { initSpamFilters } from "./src/mod";

async function init() {
  return Promise.all([
    initRoles(),
    initEligibility(),
    initSpamFilters(),
    initNetworkProviders(),
  ]);
}

const start = async () => {
  await init();
  state.app = express();
  state.server = http.createServer(state.app);
  state.wss = new WebSocket.Server({ server: state.server });
  setupWs(state.wss);
  state.app.use(cors())
    .use(express.json())
    .use("/votes", vote)
    .use("/messages", message)
    .use("/topics", topic)
    .use("/proposals", proposal)
    .use("/moderation", moderation)
    .use("/stats", stats);

  const port = config.server.port || 3000;
  state.server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
  Bun.serve
};

start().catch((error) => {
  console.error('Error initializing server:', error);
});
