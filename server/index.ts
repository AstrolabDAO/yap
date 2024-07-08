
import cors from "cors";
import express from "express";
import http from "http";
import WebSocket from "ws";

import config from "./src/config";
import { initSpamFilters } from "./src/mod";
import message from "./src/routers/message";
import moderation from "./src/routers/moderation";
import proposal from "./src/routers/proposal";
import stats from "./src/routers/stats";
import topic from "./src/routers/topic";
import vote from "./src/routers/vote";
import setupWs from "./src/routers/ws";
import state, { initNetworkProviders } from "./src/state";
import { initEligibility, initRoles } from "./src/user";
import user from "./src/routers/user";

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
    .use("/user", user)
    .use("/vote", vote)
    .use("/message", message)
    .use("/topic", topic)
    .use("/proposal", proposal)
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
