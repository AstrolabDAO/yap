import express, { Request, Response } from "express";
import { User } from "../../../common/models";
import { getTopic, getTopicUsers, isModerator, pushUser } from "../io";
import { useAuth } from "../middlewares/auth";
import { validateBody, validateQuery } from "../middlewares/validation";
import { userPublicAttributes } from "../user";
import { clonePartial } from "../../../common/utils";

const router = express.Router();

router.get("/:userId", useAuth, async (req: Request, res: Response) => {
  const [userId, user] = [req.params.userId, res.locals.currentUser as User];
  try {
    if (await isModerator(user.address)) {
      res.status(200).json(user);
    } else if (userId == user.address) {
      res.status(200).json(clonePartial(user, { include: userPublicAttributes }));
    } else {
      res.status(200).json(clonePartial(user, { include: userPublicAttributes, exclude: ["settings"] }));
    }
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/*", useAuth, validateQuery(
  { "topicId": "string", "proposalId": "string" },
  { allowExtend: false, allowPartial: true }
), async (req: Request, res: Response) => {
  let { topicId, proposalId, userId } = req.query;
  const user = res.locals.currentUser as User;
  try {
    if (proposalId) {
      topicId = (await getTopic(<string>proposalId))?.topicId;
    }
    const users = await getTopicUsers(<string>topicId);
    res.status(200).json(
      await isModerator(user.address)
        ? users
        : users.map(u => clonePartial(u, { include: userPublicAttributes })));
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:userId", useAuth, validateBody(
  {
    "name": "string",
    "picture": "string",
    "title": "string",
    "settings": {
      "notifications": {
        "reputation": "boolean",
        "proposals": "boolean",
        "messages": "boolean",
        "replies": "boolean",
        "topics": "boolean",
        "votes": "boolean"
      },
      "theme": "string",
      "currency": "string",
      "locale": "string",
      "sessionRefresh": "boolean"
    }
  }, { allowExtend: false, allowPartial: true }
), async (req: Request, res: Response) => {
  const [userId, user] = [req.params.userId, res.locals.currentUser as User];
  const updates = req.body.updates;
  try {
    if (userId !== user.address && !await isModerator(user.address)) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    await pushUser({ ...user, ...updates });
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
