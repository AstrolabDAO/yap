import { Request, Response, Router } from "express";

import { Proposal, User } from "../../../common/models";
import { getAllProposals, getProposal, getTopic, getVotingEligibility, isModerator, isSpam, pushProposal, removeProposal } from "../io";
import { useAuth } from "../middlewares/auth";
import { canEdit, canPropose } from "../security";
import { pushWebsocketMessage } from "../state";

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

router.post("/", useAuth, async (req: Request, res: Response) => {
  try {
    const [topicId, title, description, user] = [
      req.body.topicId,
      req.body.title,
      req.body.description,
      res.locals.currentUser as User
    ];

    if (!title || !description || !topicId) {
      return res.status(400).json({ error: "Title, description, and topicId are required." });
    }

    if (await isSpam(title, description)) {
      return res.status(400).json({ error: "Proposal contains spam." });
    }

    if (!await canPropose(user)) {
      return res.status(403).json({ error: "Unauthorized to create proposals." });
    }

    const topic = await getTopic(topicId);

    if (!topic || topic.proposalId) {
      return res.status(400).json({ error: "Invalid topicId: not found or already linked to a proposal." });
    }

    const votingEligibility = await getVotingEligibility();

    const now = Date.now();
    const proposal: Proposal = {
      id: crypto.randomUUID(),
      topicId,
      title,
      description,
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
    await pushWebsocketMessage(proposal, "create", "proposal");
    res.status(201).json(proposal);
  } catch (error) {
    console.error("Error creating proposal:", error);
    res.status(500).json({ error: "Failed to create proposal." });
  }
});

router.put("/:proposalId", useAuth, async (req: Request, res: Response) => {
  try {
    const [proposalId, user] = [req.params.proposalId, res.locals.currentUser as User];
    const updateable = ["title", "description", "startDate", "endDate", "votingPowerScheme", "snapshotConfig"];
    const values = updateable.map(key => req.body[key]); // do not include non-validated post fields
    if (!values.some(v => v)) {
      return res.status(400).json({ error: "Nothing to update." });
    }
    const proposal: Proposal = {
      ...await getProposal(proposalId),
      ...values,
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
    await pushWebsocketMessage(proposal, "update", "proposal");
    res.status(200).json(proposal);
  } catch (error) {
    console.error("Error updating proposal:", error);
    res.status(500).json({ error: "Failed to update proposal." });
  }
});

router.put("/:proposalId/status", useAuth, async (req: Request, res: Response) => {
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
    await pushWebsocketMessage(updatedProposal, "update", "proposal");
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
    await pushWebsocketMessage(proposalId, "delete", "proposal");
    res.status(200).json({ message: "Proposal deleted successfully." });
  } catch (error) {
    console.error("Error deleting proposal:", error);
    res.status(500).json({ error: "Failed to delete proposal." });
  }
});

// async function approveProposal(proposalId: string) {
// }

// async function rejectProposal(proposalId: string) {
// }

export default router;
