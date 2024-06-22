import { getAddress, verifyMessage } from "ethers";
import express, { Request, Response } from "express";

import { User } from "../../../common/models";
import config from "../config";
import { getNonce, getUser, pushNonce } from "../io";
import { canLogin, generateJwt, revokeJwt } from "../security";
import { createUserFromAddress, userPublicAttributes } from "../user";
import { clonePartial, shortenAddress } from "../../../common/utils";
import { validateQuery } from "../middlewares/validation";

const router = express.Router();

router.get("/login/nonce", validateQuery({ address: "string" }), async (req: Request, res: Response) => {
  const { address } = req.query;
  const nonce = `I, ${shortenAddress(getAddress(<string>address))} am signing in to YAP at: ${new Date().toISOString()}`;
  await pushNonce(<string>address, nonce);
  res.status(200).json({ nonce });
});

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { signature, message } = req.body;

    if (!signature || !message) {
      return res.status(400).json({ error: "Missing signature or message" });
    }
    const address = verifyMessage(message, signature);
    const nonce = await getNonce(<string>address);
    if (!nonce || nonce !== message) {
      return res.status(403).json({ error: "Invalid nonce" });
    }
    const user: User = await getUser(address) || await createUserFromAddress(address);
    if (!canLogin(user)) {
      return res.status(403).json({ error: "Banned until " + new Date(user.moderation!.banned.until) });
    }
    const token = generateJwt(
      { address: user.address, roles: user.roles },
      config.server.jwt_session_salt
    );

    console.log(`Refreshed JWT for ${user.address}`);
    res.setHeader("Authorization", `Bearer ${token}`);
    res.status(200).json({
      user: clonePartial(user, { include: userPublicAttributes }),
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/logout", async (req: Request, res: Response) => {
  res.setHeader("Authorization", "");
  if (req.headers.authorization) {
    await revokeJwt(req.headers.authorization);
  }
  res.status(200).json({ message: "Logged out" });
});
