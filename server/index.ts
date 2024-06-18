// import { getBalance } from "./src/utils";

import express from "express";
import cors from "cors";
import expressWs from "express-ws";
import config from "./src/config";
import routes from "./src/routers/vote";

const app = express();
expressWs(app);

// Apply middleware
app.use(cors());
app.use(express.json());
app.use("/votes", routes);

const port = config.server.port || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
