import express, { Request, Response } from "express";
import { verifyMessage } from "ethers";

import { getProposalVotes, getUserProposalVote, getUserVotes } from "../io";
import { castVote, generateVoteMessage, tallyResults } from "../vote";
import { verifyJwt } from "../security";
import { User, Vote } from "../../../common/models";
import { pushToClients } from "../state";
import { isGov, useAuth } from "../middlewares/auth";
import { validateParams, validateQuery } from "../middlewares/validation";

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

router.get("/*", validateQuery(
  { proposalId: "string", userId: "string" },
  { allowExtend: false, allowPartial: true }
), async (req: Request, res: Response) => {
  try {
    const { proposalId, userId } = req.query;
    let votes: (Vote|null)[] = [];
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
    await pushToClients(vote, "create", "proposal");
    res.json({ message: "Vote cast successfully" });
  } catch (error) {
    console.error("Error casting vote:", error);
    res.status(500).json({ error: "Failed to cast vote" });
  }
});

router.get("/verify/:proposalId/:vote/:signature", useAuth, validateParams(
  { proposalId: "string", vote: "number", signature: "string" }
), async (req: Request, res: Response) => {
  const user = res.locals.currentUser as User;
  const { proposalId, vote, signature } = req.params;
  const message = await generateVoteMessage(proposalId, Number(vote), user);
  const addr = verifyMessage(message, signature);

  if (!addr || addr.toLowerCase() !== user.address.toLowerCase()) {
    return res.status(400).json({ error: "Invalid signature" });
  }

  res.status(200).json({ message: "Signature verified" });
});

router.get("/tally/:proposalId", isGov, async (req: Request, res: Response) => {
  const { proposalId } = req.params;
  try {
    const results = await tallyResults(proposalId);
    res.status(200).json(results);
  } catch (error) {
    console.error("Error tallying votes:", error);
    res.status(500).json({ error: "Failed to tally votes" });
  }
});

export default router;
