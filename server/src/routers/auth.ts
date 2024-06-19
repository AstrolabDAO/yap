import { ethers, getAddress, verifyMessage } from "ethers";
import express, { Request, Response } from "express";

import { User } from "../../../common/models";
import { Blocky } from "../../../common/rendering";
import { getUser, pushUser } from "../io";
import { getProvider } from "../state";
import { generateJwt } from "../security";
import config from "../config";
import { clonePartial } from "../utils";

const router = express.Router();

// Login/Signup with signature
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { signature, message } = req.body;

    if (!signature || !message) {
      return res.status(400).json({ error: "Missing signature or message" });
    }
    const address = verifyMessage(message, signature);
    let user: User = await getUser(address);
    const ens = await (await getProvider(1)).lookupAddress(address);

    if (!user) {
      user = {
        address: getAddress(address), // checksum
        ens: ens || "",
        name: ens.replace(".eth", "") || "Anon",
        joined: Date.now(),
        picture: new Blocky({ seed: address, scale: 32, size: 7 }).getDataUrl(),
        moderation: {
          muted: { since: 0, until: 0, by: "", count: 0 },
          banned: { since: 0, until: 0, by: "", count: 0 },
        },
        balances: {},
        proposalIds: [],
        topics: [],
        roles: [],
      };
      await pushUser(user);
    }

    const token = generateJwt(
      { address: user.address, roles: user.roles },
      config.server.jwt_session_salt
    );
    res
      .status(200)
      .json({
        token,
        user: clonePartial(user, ["moderation", "balances", "topics"]),
      });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ error: "Login failed" });
  }
});
