import express, { Request, Response } from "express";
import { verifyMessage } from "ethers";

import { getProposalVotes, getUserProposalVote, getUserVotes } from "../io";
import { castVote, generateVoteMessage } from "../vote";
import { verifyJwt } from "../security";
import { Vote } from "../../../common/models";
import { pushWebsocketMessage } from "../state";

const router = express.Router();

router.get("/:voteId", async (req: Request, res: Response) => {
  const user = res.locals.currentUser;
  try {
    const vote = await getUserVotes(user.address);
    if (!vote) {
      return res.status(404).json({ error: "Vote not found." });
    }
    res.status(200).json(vote);
  } catch (error) {
    console.error("Error fetching vote:", error);
    res.status(500).json({ error: "Failed to fetch vote." });
  }
});

router.get("/*", async (req: Request, res: Response) => {
  try {
    const [proposalId, userId] = [req.query.topicId, req.query.userId, []];
    let votes: Vote[] = [];
    if (proposalId && userId) {
      votes = [await getUserProposalVote(<string>proposalId, <string>userId)];
    } else if (proposalId) {
      votes = await getProposalVotes(<string>proposalId);
    } else if (userId) {
      votes = await getUserVotes(<string>userId);
    }
    res.status(200).json(votes);
  } catch (error) {
    console.error("Error fetching votes:", error);
    res.status(500).json({ error: "Failed to fetch votes." });
  }
});

router.post("/:proposalId", async (req: Request, res: Response) => {
  const { proposalId } = req.params;
  const { vote, signature } = req.body;

  const user = verifyJwt(req.headers.authorization as string);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const message = await generateVoteMessage(proposalId, vote, user);
  const addr = verifyMessage(message, signature);

  if (!addr || addr.toLowerCase() !== user.address.toLowerCase()) {
    return res.status(400).json({ error: "Invalid signature" });
  }

  try {
    await castVote(proposalId, user, vote, signature);
    await pushWebsocketMessage(vote, "create", "proposal");
    res.json({ message: "Vote cast successfully" });
  } catch (error) {
    console.error("Error casting vote:", error);
    res.status(500).json({ error: "Failed to cast vote" });
  }
});

export default router;
