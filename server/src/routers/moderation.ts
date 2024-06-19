import express, { Request, Response } from "express";
import { getUser, incrementUserMuteCount, isAdmin, isModerator } from "../io";
import { isAdm, isMod, useAuth } from "../middlewares/auth";
import { banUser, muteUser } from "../security";
import config from "../config";

const router = express.Router();

// Ban or mute a user (moderator-only)
router.post("/mod/:action/:address", useAuth, isMod, async (req: Request, res: Response) => {
  const { action, address } = req.params
  const { motive, interval } = req.body;

  if (!["mute", "ban"].includes(action)) {
    return res.status(400).json({ error: "Invalid action" });
  }

  if (typeof motive !== "string") {
    return res.status(400).json({ error: "Missing or invalid motive" });
  }

  if (await isAdmin(address)) {
    return res.status(400).json({ error: "Cannot moderate an admin" });
  } else if (await isModerator(address)) {
    if (!await isAdmin(res.locals.currentUser.address)) {
      return res.status(400).json({ error: "Only admins can moderate a moderator" });
    }
  }

  try {
    await (action === "mute" ? muteUser : banUser)(address, interval || "h1");
    res.status(200).json({ message: "User moderated successfully" });
  } catch (err) {
    console.error("Error moderating user:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
