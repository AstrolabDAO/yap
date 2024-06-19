import { Request, Response, Router } from "express";

import { Message, User } from "../../../common/models";
import { getMessage, getMessageDownvotes, getMessageUpvotes, getTopic, getTopicMessages, getUserMessages, isSpam, pushMessage, pushMessageDownvote, pushMessageUpvote, removeMessage, removeMessageDownvote, removeMessageUpvote } from "../io";
import { useAuth } from "../middlewares/auth";
import { canEdit, canMessage } from "../security";
import state, { pushToClients } from "../state";
import { validateBody, validateParams } from "../middlewares/validation";
import { cuffIfSpam } from "../mod";

const router = Router();

router.get("/:messageId", async (req: Request, res: Response) => {
  try {
    const message = await getTopic(req.params.messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found." });
    }
    res.status(200).json(message);
  } catch (error) {
    console.error("Error fetching message:", error);
    res.status(500).json({ error: "Failed to fetch message." });
  }
});

router.get("/*", async (req: Request, res: Response) => {
  try {
    const [topicId, userId] = [req.query.topicId, req.query.userId, []];
    let messages: Message[] = [];
    if (topicId) {
      messages = await getTopicMessages(<string>topicId);
    } else if (userId) {
      messages = await getUserMessages(<string>userId);
    }
    if (!messages) {
      return res.status(404).json({ error: "Messages not found, please provide a valid topicId or userId." });
    }
    res.status(200).json(messages);
  } catch (error) {
    console.error("Error fetching topic:", error);
    res.status(500).json({ error: "Failed to fetch topic." });
  }
});

router.post("/", useAuth, validateBody(
  { "message": { "topicId": "string", "content": "string" } },
  { allowExtend: false, allowPartial: false }
), async (req: Request, res: Response) => {
  try {
    let [message, user] = [req.body.message, res.locals.currentUser as User];
    if (!await canMessage(user)) {
      return res.status(403).json({ error: "Unauthorized to post messages." });
    }
    if (await cuffIfSpam(user.address, message.content)) {
      return res.status(400).json({ error: "Message contains spam." });
    }
    const now = Date.now();
    message = <Message>{
      ...message,
      id: crypto.randomUUID(),
      author: user.address,
      createdAt: now,
      updatedAt: now,
      upvotes: [],
      downvotes: [],
    };
    await pushMessage(message);
    await pushToClients(message, "create", "message");
    res.status(201).json(message);
  } catch (error) {
    console.error("Error posting message:", error);
    res.status(500).json({ error: "Failed to post message." });
  }
});

router.put("/:messageId", useAuth, validateBody(
  { "message": { "content": "string" } },
  { allowExtend: false, allowPartial: false }
), async (req: Request, res: Response) => {
  try {
    let [messageId, message, user] = [req.params.messageId, req.body.message, res.locals.currentUser as User];
    if (await cuffIfSpam(user.address, message.content)) {
      return res.status(400).json({ error: "Message contains spam." });
    }
    message = <Message>{
      ...await getMessage(messageId),
      ...message,
      updatedAt: Date.now(),
    };
    if (!await canEdit(user, message)) { // make sure the user authored the message or is mod
      return res.status(403).json({ error: "User is not eligible to edit this message." });
    }
    await pushMessage(message);
    await pushToClients(message, "update", "message");
    res.status(200).json({ message: "Message updated successfully." });
  } catch (error) {
    console.error("Error updating message:", error);
    res.status(500).json({ error: "Failed to update message." });
  }
});

router.delete("/:messageId", useAuth, async (req: Request, res: Response) => {
  try {
    const [messageId, user] = [req.params.messageId, res.locals.currentUser as User];
    const message = await getTopic(messageId);
    if (!await canEdit(user, message)) {
      return res.status(403).json({ error: "Unauthorized to delete message." });
    }
    await removeMessage(message);
    await pushToClients(messageId, "delete", "message");
    res.status(200).json({ message: "Message deleted successfully." });
  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({ error: "Failed to delete message." });
  }
});

router.post("/:messageId/:reaction", useAuth, validateParams(
  { "reaction": "string", "messageId": "string" },
  { allowExtend: false, allowPartial: false }
), async (req, res) => {
  const { messageId, reaction } = req.params;
  const user = res.locals.currentUser as User;

  if (!["upvote", "downvote"].includes(reaction)) {
    return res.status(400).json({ error: "Invalid vote type" });
  }
  const [ups, downs] = await Promise.all([
    getMessageUpvotes(messageId),
    getMessageDownvotes(messageId),
  ]);
  let fn = reaction === "upvote" ? pushMessageUpvote : pushMessageDownvote;
  if (ups.includes(user.address)) {
    fn = removeMessageUpvote;
  } else if (downs.includes(user.address)) {
    fn = removeMessageDownvote;
  }
  await fn(messageId, user.address);
  await pushToClients(reaction, "create", "reaction");
  res.status(200).json({ message: `Message ${reaction}d successfully` });
});

export default router;
