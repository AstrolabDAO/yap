import { Request, Response, Router } from "express";
import { Topic, User } from "../../../common/models";
import { getTopic, pushTopic } from "../io";
import { useAuth } from "../middlewares/auth";
import { editMessage } from "../post";
import { getFrom } from "../utils";
import { canMessage, canPostProposal } from "../security";

const router = Router();

// POST /topic (Create Topic)
router.post("/topic", useAuth, async (req: Request, res: Response) => {
  try {
    const { title, description } = req.body; // Assuming title and description in request body
    const user = req["user"] as User;

    // Basic input validation
    if (!title || !description) {
      return res
        .status(400)
        .json({ error: "Title and description are required." });
    }

    const topic: Topic = {
      id: crypto.randomUUID(),
      title,
      author: user.address,
      createdAt: Date.now(),
      proposalId: "",
      messageIds: []
    }
    await pushTopic(topic);

    res.status(201).json({ topicId: topic.id });
  } catch (error) {
    console.error("Error creating topic:", error);
    res.status(500).json({ error: "Failed to create topic." });
  }
});

// PUT /topic/:topicId (Edit Topic)
router.put("/topic/:topicId", useAuth, async (req: Request, res: Response) => {
  try {
    const [topicId, user] = [req.params.topicId, getFrom<User>(req, "user")];

    const t = await getTopic(topicId);
    const updateable = ["title", "description", "content"];
    const values = updateable.map(key => req.body[key]);

    if (t.author !== user.address || !(await canMessage(user))) {
      return res.status(403).json({ error: "User is not eligible to edit this topic." });
    }

    if (!values.some(v => v)) {
      return res.status(400).json({ error: "Nothing to update." });
    }
    await pushTopic({ ...t, ...values });
    res.status(200).json({ message: "Topic updated successfully." });
  } catch (error) {
    console.error("Error updating topic:", error);
    res.status(500).json({ error: "Failed to update topic." });
  }
});

// POST /topic/:topicId/message (Post Message)
router.post("/topic/:topicId/message", useAuth, async (req: Request, res: Response) => {
  try {
    const [topicId, content, user] = [req.params.topicId, req.body.content, getFrom<User>(req, "user")];
    await postMessage(user, topicId, content);
    res.status(201).json({ message: "Message posted successfully." });
  } catch (error) {
    console.error("Error posting message:", error);
    res.status(500).json({ error: "Failed to post message." });
  }
});

// PUT /message/:messageId (Edit Message)
router.put("/message/:messageId", useAuth, async (req: Request, res: Response) => {
  try {
    const [messageId, content, user] = [req.params.messageId, req.body.content, getFrom<User>(req, "user")];
    await editMessage(user, messageId, content);
    res.status(200).json({ message: "Message updated successfully." });
  } catch (error) {
    console.error("Error updating message:", error);
    res.status(500).json({ error: "Failed to update message." });
  }
});
