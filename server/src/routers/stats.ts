import express, { Request, Response } from "express";
import { getMessageCount, getProposalCount, getTopicCount, getUserCount, getVote, getVoteCount } from "../io";

const router = express.Router();

router.get("/*", async (req: Request, res: Response) => {
  try {
    const data = await Promise.all([
      getUserCount(),
      getVoteCount(),
      getMessageCount(),
      getTopicCount(),
      getProposalCount(),
    ])
    res.status(200).json({
      users: data[0],
      votes: data[1],
      messages: data[2],
      topics: data[3],
      proposals: data[4],
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch stats." });
  }
});

export default router;
