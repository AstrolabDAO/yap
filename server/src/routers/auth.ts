import { ethers, getAddress, verifyMessage } from "ethers";
import express, { Request, Response } from "express";

import { User } from "../../../common/models";
import { Blocky } from "../../../common/rendering";
import { blacklistForever, getUser, pushUser } from "../io";
import { getProvider } from "../state";
import { canLogin, generateJwt, revokeJwt } from "../security";
import config from "../config";
import { clonePartial } from "../utils";
import { useAuth } from "../middlewares/auth";
import { createUserFromAddress, userPublicAttributes } from "../user";

const router = express.Router();

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { signature, message } = req.body;

    if (!signature || !message) {
      return res.status(400).json({ error: "Missing signature or message" });
    }
    const address = verifyMessage(message, signature);
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
