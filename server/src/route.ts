import express from "express";
import config from "./config.js";
import { verifyToken } from "./utils.js";
import { canVote, castVote, getVotesByProposal, getVoteByProposalAndAddress } from "./route.js";
import { generateVoteMessage, verifyVoteSignature, getBalance } from "./route.js";

const router = express.Router();

// Cast a vote
router.post("/:proposalId", async (req, res) => {
  const { proposalId } = req.params;
  const { vote, signature } = req.body;

  const user = verifyToken(req.headers.authorization as string);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  // Fetch token balances if not available in the user object

  const message = generateVoteMessage(proposalId, vote, user);
  const signerAddress = verifyVoteSignature(message, signature);

  if (!signerAddress || signerAddress.toLowerCase() !== user.address.toLowerCase()) {
    return res.status(400).json({ error: "Invalid signature" });
  }

  try {
    await castVote(proposalId, user.address, vote, signature);
    res.json({ message: "Vote cast successfully" });
  } catch (error) {
    console.error("Error casting vote:", error);
    res.status(500).json({ error: "Failed to cast vote" });
  }
});

// Get all votes for a proposal (for audit)
router.get("/:proposalId", async (req, res) => {
  const { proposalId } = req.params;
  const votes = await getVotesByProposal(proposalId);
  res.json(votes);
});

// Get a specific vote by address and proposal (for audit)
router.get("/:proposalId/:address", async (req, res) => {
  const { proposalId, address } = req.params;
  const vote = await getVoteByAddressAndProposal(proposalId, address);
  res.json(vote || null); // Return null if vote not found
});

export default router;
