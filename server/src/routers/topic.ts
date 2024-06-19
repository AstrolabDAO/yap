import { Request, Response, Router } from "express";

import { Topic, User } from "../../../common/models";
import { getAllTopics, getTopic, isSpam, pushTopic, removeTopic } from "../io";
import { useAuth } from "../middlewares/auth";
import { canEdit, canPropose } from "../security";
import { pushWebsocketMessage } from "../state";

const router = Router();

router.get("/:topicId", async (req: Request, res: Response) => {
  try {
    const topic = await getTopic(req.params.topicId);
    if (!topic) {
      return res.status(404).json({ error: "Topic not found." });
    }
    res.status(200).json(topic);
  } catch (error) {
    console.error("Error fetching topic:", error);
    res.status(500).json({ error: "Failed to fetch topic." });
  }
});

router.get("/*", async (req: Request, res: Response) => {
  try {
    const topics = await getAllTopics();
    res.status(200).json(topics);
  } catch (error) {
    console.error("Error fetching topics:", error);
    res.status(500).json({ error: "Failed to fetch topics." });
  }
});

router.post("/topic", useAuth, async (req: Request, res: Response) => {
  try {
    let [title, content, user] = [req.body.title, req.body.content, res.locals.currentUser as User];
    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required." });
    }
    if (await isSpam(title, content)) {
      return res.status(400).json({ error: "Topic contains spam." });
    }
    if (!await canPropose(user)) {
      return res.status(403).json({ error: "Unauthorized to create topics." });
    }
    const now = Date.now();
    const id = crypto.randomUUID();
    const topic: Topic = {
      id,
      topicId: id,
      title,
      content,
      author: user.address,
      proposalId: "",
      messageIds: [],
      createdAt: now,
      updatedAt: now,
      upvotes: [],
      downvotes: [],
    }
    await pushTopic(topic);
    res.status(201).json(topic);
    await pushWebsocketMessage(topic, "create", "topic");
  } catch (error) {
    console.error("Error creating topic:", error);
    res.status(500).json({ error: "Failed to create topic." });
  }
});

router.put("/topic/:topicId", useAuth, async (req: Request, res: Response) => {
  try {
    const [topicId, user] = [req.params.topicId, res.locals.currentUser as User];
    const updateable = ["title", "description", "content"];
    const values = updateable.map(key => req.body[key]);
    if (!values.some(v => v)) {
      return res.status(400).json({ error: "Nothing to update." });
    }
    if (await isSpam(...values)) {
      return res.status(400).json({ error: "Topic contains spam." });
    }
    const topic: Topic = {
      ...await getTopic(topicId),
      ...values,
      updatedAt: Date.now(),
    };
    if (!await canEdit(user, topic)) {
      return res.status(403).json({ error: "User is not eligible to edit this topic." });
    }
    await pushTopic(topic);
    await pushWebsocketMessage(topic, "update", "topic");
    res.status(200).json(topic);
  } catch (error) {
    console.error("Error updating topic:", error);
    res.status(500).json({ error: "Failed to update topic." });
  }
});

router.delete("/topic/:topicId", useAuth, async (req: Request, res: Response) => {
  try {
    const [topicId, user] = [req.params.topicId, res.locals.currentUser as User];
    const topic = await getTopic(topicId);
    if (!await canEdit(user, topic)) {
      return res.status(403).json({ error: "Unauthorized to delete topic." });
    }
    await removeTopic(topicId);
    await pushWebsocketMessage(topicId, "delete", "topic");
    res.status(200).json({ message: "Topic deleted successfully." });
  } catch (error) {
    console.error("Error deleting topic:", error);
    res.status(500).json({ error: "Failed to delete topic." });
  }
});

export default router;
