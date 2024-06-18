import { Router } from "express";
import { Topic, User } from "../../../common/models";
import { getTopic, pushTopic } from "../io";
import { useAuth } from "../middlewares/auth";
import { editMessage } from "../post";

const router = Router();

// POST /topic (Create Topic)
router.post("/topic", useAuth, async (req, res) => {
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
router.put("/topic/:topicId", useAuth, async (req, res) => {
  try {
    const topicId = req.params.topicId;
    const { title, description } = req.body;
    const user = req["user"] as User;

    // Check if topic exists
    await getTopic(topicId);

    // Input validation
    if (!title || !description) {
      return res
        .status(400)
        .json({ error: "Title and description are required." });
    }

    // Push updated topic to the data store or publish an event
    // ... your implementation here ...

    res.status(200).json({ message: "Topic updated successfully." });
  } catch (error) {
    console.error("Error updating topic:", error);
    res.status(500).json({ error: "Failed to update topic." });
  }
});

// POST /topic/:topicId/message (Post Message)
router.post("/topic/:topicId/message", useAuth, async (req, res) => {
  try {
    const topicId = req.params.topicId;
    const user = req["user"] as User;
    const content = req.body.content;

    await postMessage(user, topicId, content);
    res.status(201).json({ message: "Message posted successfully." });
  } catch (error) {
    console.error("Error posting message:", error);
    res.status(500).json({ error: "Failed to post message." });
  }
});

// PUT /message/:messageId (Edit Message)
router.put("/message/:messageId", useAuth, async (req, res) => {
  try {
    const messageId = req.params.messageId;
    const user = req["user"] as User;
    const content = req.body.content;

    await editMessage(user, messageId, content);
    res.status(200).json({ message: "Message updated successfully." });
  } catch (error) {
    console.error("Error updating message:", error);
    res.status(500).json({ error: "Failed to update message." });
  }
});
