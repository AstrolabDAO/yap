import { Request, Response, Router } from "express";

import { Proposal, User } from "../../../common/models";
import { getAllProposals, getProposal, getTopic, getVotingEligibility, isModerator, isSpam, pushProposal, removeProposal } from "../io";
import { useAuth } from "../middlewares/auth";
import { canEdit, canPropose } from "../security";
import { pushToClients } from "../state";
import { validateBody } from "../middlewares/validation";
import { cuffIfSpam } from "../mod";

const router = Router();

router.get("/:proposalId", async (req: Request, res: Response) => {
  try {
    const proposal = await getProposal(req.params.proposalId);
    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found." });
    }
    res.status(200).json(proposal);
  } catch (error) {
    console.error("Error fetching proposal:", error);
    res.status(500).json({ error: "Failed to fetch proposal." });
  }
});

router.get("/*", async (req: Request, res: Response) => {
  try {
    const proposals = await getAllProposals();
    res.status(200).json(proposals);
  } catch (error) {
    console.error("Error fetching proposals:", error);
    res.status(500).json({ error: "Failed to fetch proposals." });
  }
});

router.post("/:topicId", useAuth, validateBody(
  { "proposal": { "topicId": "string", "title": "string", "description": "string" } },
  { allowExtend: false, allowPartial: false }
), async (req: Request, res: Response) => {
  try {
    let [topicId, proposal, user] = [
      req.params.topicId,
      req.body.proposal,
      res.locals.currentUser as User
    ];

    if (!await canPropose(user)) {
      return res.status(403).json({ error: "Unauthorized to create proposals." });
    }

    if (await cuffIfSpam(user.address, proposal.title, proposal.description)) {
      return res.status(400).json({ error: "Proposal contains spam." });
    }

    const topic = await getTopic(topicId);

    if (!topic || topic.proposalId) {
      return res.status(400).json({ error: "Invalid topicId: not found or already linked to a proposal." });
    }

    const votingEligibility = await getVotingEligibility();

    const now = Date.now();
    proposal = <Proposal>{
      ...proposal,
      id: crypto.randomUUID(),
      topicId,
      author: user.address,
      createdAt: now,
      updatedAt: now,
      startDate: 0, // Set later or by governance
      endDate: 0,   // Set later or by governance
      snapshotIds: [],
      eligibility: await getVotingEligibility(), // Default voting eligibility (TODO: parse from request specific tokens eligibility)
      votingPowerScheme: "quadratic", // Default or fetch from governance
      voteIds: [],
      snapshotConfig: {
        interval: 24 * 3600, // 1 day
        randomize: false, // Pseudo-randomize snapshot
        weightFunction: "simple",
        startDate: 0,
        endDate: 0,
        xtokens: votingEligibility.map((c) => c.xtoken),
      },
      status: "pending",
      results: {
        outcome: "pending",
        count: { total: 0, for: 0, against: 0, abstain: 0 }, weighted: { total: 0, for: 0, against: 0, abstain: 0 }
      },
    };
    await pushProposal(proposal);
    await pushToClients(proposal, "create", "proposal");
    res.status(201).json(proposal);
  } catch (error) {
    console.error("Error creating proposal:", error);
    res.status(500).json({ error: "Failed to create proposal." });
  }
});

router.put("/:proposalId", useAuth, validateBody({
  "proposal": {
    "title": "string",
    "description": "string",
    "startDate": "number",
    "endDate": "number",
    "votingPowerScheme": "string",
    "snapshotConfig": {
      "interval": "number",
      "randomize": "boolean",
      "weightFunction": "string",
      "startDate": "number",
      "endDate": "number",
      "xtokens": "array"
    }
  }}, { allowExtend: false, allowPartial: true }
), async (req: Request, res: Response) => {
  try {
    let [proposalId, proposal, user] = [req.params.proposalId, req.body.proposal, res.locals.currentUser as User];
    proposal = <Proposal>{
      ...await getProposal(proposalId),
      ...proposal,
      updatedAt: Date.now(),
    };
    if (!await isModerator(user.address)) {
      if (proposal.status !== "pending") {
        return res.status(400).json({ error: "Proposal can only be modified while pending." });
      }
      if (!await canEdit(user, proposal)) {
        return res.status(403).json({ error: "User is not eligible to edit this proposal." });
      }
    }
    await pushProposal(proposal);
    await pushToClients(proposal, "update", "proposal");
    res.status(200).json(proposal);
  } catch (error) {
    console.error("Error updating proposal:", error);
    res.status(500).json({ error: "Failed to update proposal." });
  }
});

// set status to active == green light, proceed with votes, closed == red light, proposal rejected
router.put("/:proposalId/status", useAuth, validateBody(
  { "status": "string" },
  { allowExtend: false, allowPartial: false }
), async (req: Request, res: Response) => {
  try {
    const [proposalId, user, status] = [
      req.params.proposalId,
      res.locals.currentUser as User,
      req.body.status
    ];

    if (!await isModerator(user.address)) {
      return res.status(403).json({ error: "Unauthorized to change proposal status." });
    }

    const proposal = await getProposal(proposalId);
    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found." });
    }

    const validStatuses = ["pending", "active", "closed", "cancelled", "paused"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid proposal status." });
    }

    if (["closed", "cancelled"].includes(proposal.status) && status === "active") {
      return res.status(400).json({ error: "Cannot re-activate a closed or cancelled proposal." });
    }

    const now = Date.now();
    const updatedProposal: Proposal = {
      ...proposal,
      status,
      startDate: status === "active" && !proposal.startDate ? now : proposal.startDate,
      endDate: status === "closed" ? now : proposal.endDate,
    };

    await pushProposal(updatedProposal);
    await pushToClients(updatedProposal, "update", "proposal");
    res.status(200).json(updatedProposal);
  } catch (error) {
    console.error("Error changing proposal status:", error);
    res.status(500).json({ error: "Failed to change proposal status." });
  }
});

router.delete("/:proposalId", useAuth, async (req: Request, res: Response) => {
  try {
    const [proposalId, user] = [req.params.proposalId, res.locals.currentUser as User];
    if (!await isModerator(user.address)) {
      return res.status(403).json({ error: "Unauthorized to delete proposal." });
    }
    await removeProposal(proposalId);
    await pushToClients(proposalId, "delete", "proposal");
    res.status(200).json({ message: "Proposal deleted successfully." });
  } catch (error) {
    console.error("Error deleting proposal:", error);
    res.status(500).json({ error: "Failed to delete proposal." });
  }
});

export default router;
