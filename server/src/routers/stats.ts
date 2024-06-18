import express, { Request, Response } from "express";

import { getProposalVotes, getUserProposalVote } from "../io";
import { castVote, generateVoteMessage, verifyVoteSignature } from "../vote";
import { verifyJwt } from "../security";

const router = express.Router();

// Cast a vote
router.post("/snapshot/:proposalId", async (req: Request, res: Response) => {
  const { proposalId } = req.params;
  const { vote, signature } = req.body;

  const user = verifyJwt(req.headers.authorization as string);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  // Fetch token balances if not available in the user object

  const message = await generateVoteMessage(proposalId, vote, user);
  const addr = verifyVoteSignature(message, signature);

  if (!addr || addr.toLowerCase() !== user.address.toLowerCase()) {
    return res.status(400).json({ error: "Invalid signature" });
  }

  try {
    await castVote(proposalId, user, vote, signature);
    res.json({ message: "Vote cast successfully" });
  } catch (error) {
    console.error("Error casting vote:", error);
    res.status(500).json({ error: "Failed to cast vote" });
  }
});

// Get all votes for a proposal (for audit)
router.get("/:proposalId", async (req: Request, res: Response) => {
  const { proposalId } = req.params;
  const votes = await getProposalVotes(proposalId);
  res.json(votes);
});

// Get a specific vote by address and proposal (for audit)
router.get("/:proposalId/:address", async (req: Request, res: Response) => {
  const { proposalId, address } = req.params;
  const vote = await getUserProposalVote(proposalId, address);
  res.json(vote || null); // Return null if vote not found
});

export default router;
