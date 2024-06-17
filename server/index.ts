// import { getBalance } from "./src/utils";

import express from "express";
import cors from "cors";
import expressWs from "express-ws";
import config from "./src/config";
import voteRoutes from "./src/routes";

const app = express();
expressWs(app);

// Apply middleware
app.use(cors());
app.use(express.json());
// ... any additional middleware (e.g., authentication)

// Mount the vote routes
app.use("/votes", voteRoutes);

const port = config.port || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
