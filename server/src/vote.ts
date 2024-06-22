import { getVotingPower } from "../../common/maths/voting-schemes";
import { JwtPayload, User, Vote, VoteResult } from "../../common/models";

import { verifyMessage } from "ethers";
import { getProposal, getProposalVotes, hasUserVoted, pushProposal, pushVote } from "./io";
import { averageSnapshotBalances, defaultVotingEligibility, getEligibility } from "./security";

/**
 * Generates a message to be signed by the user for a vote
 * @param proposalId - The ID of the proposal being voted on
 * @param value - The vote value (1 for "for", -1 for "against", 0 for "abstain")
 * @param user - The user object containing balances and address
 * @returns The message string to be signed
 */
async function generateVoteMessage(proposalId: string, value: number, user: User|JwtPayload) {
  const proposal = await getProposal(proposalId);
  if (!proposal) {
    throw new Error(`Proposal not found: ${proposalId}`);
  }
  const eligibility = proposal!.eligibility ?? defaultVotingEligibility();
  const [eligible, balances] = await getEligibility(user, eligibility, proposal);
  if (!eligible) {
    throw new Error("User not eligible to vote.");
  }
  const message = JSON.stringify({
    proposalId,
    address: user.address,
    value,
    label: proposal.labels[value],
    balances,
    timestamp: Date.now(), // To prevent replay attacks
  });
  return message;
}

// Cast Vote (User must be eligible)
async function castVote(proposalId: string, user: User|JwtPayload, value: number, signature: string, autoUpdate=true) {

  const proposal = await getProposal(proposalId);
  if (!proposal) {
    throw new Error(`Proposal not found: ${proposalId}`);
  }
  const now = Date.now();
  if (now < proposal!.startDate || now > proposal!.endDate) {
    throw new Error("Voting period not active.");
  }

  if (await hasUserVoted(proposalId, user.address)) {
    throw new Error("User has already voted on this proposal.");
  }

  const eligibility = proposal!.eligibility ?? defaultVotingEligibility();
  const [eligible, balances] = await getEligibility(user, eligibility, proposal);

  if (!eligible) {
    throw new Error("User not eligible to vote.");
  }

  if (!proposal.choices.includes(value)) {
    throw new Error(`Invalid vote value: ${value}, proposal ${proposalId} expects one of ${proposal.choices}`);
  }

  let vote = <Vote>{
    proposalId,
    value,
    timestamp: now,
  };

  const message = JSON.stringify(vote);
  const addr = verifyMessage(message, signature);
  if (addr?.toLowerCase?.() !== user.address.toLowerCase()) {
    throw new Error("Invalid signature.");
  }

  // TODO: use usdBalance (common denomination) for unified balance
  const unifiedBalance = balances.reduce((total, balance) => total + balance, 0);
  const power = getVotingPower(proposal!.votingPowerScheme, Number(unifiedBalance));

  vote = {
    ...vote,
    proposalId,
    address: user.address,
    balances: balances.reduce((obj, balance, i) => ({ ...obj, [proposal!.eligibility[i].xtoken]: balance }), {}),
    power,
    weighted: power * value,
    signature,
    timestamp: now
  };
  await pushVote(vote);

  if (autoUpdate) {
    await tallyResults(proposalId);
  }
}

async function tallyResults(proposalId: string): Promise<VoteResult> {
  const [proposal, votes] = await Promise.all([
    getProposal(proposalId),
    getProposalVotes(proposalId).then(votes => votes.filter(vote => !!vote))
  ]);
  if (!proposal) {
    throw new Error("Proposal not found.");
  }
  if (!votes?.length || proposal.status === "closed") {
    return proposal.result;
  }

  const results: VoteResult = {
    count: votes.length,
    totalWeight: 0,
    participation: 0,
    countByChoice: {},
    weightByChoice: {},
    outcome: "pending",
    choice: "",
  };

  // Initialize countByChoice and weightByChoice with proposal choices
  proposal.choices.forEach(choice => {
    results.countByChoice[choice] = 0;
    results.weightByChoice[choice] = 0;
  });

  // Aggregate the votes
  (<Vote[]>votes).forEach(vote => {
    const { value, power } = vote;
    const weightedValue = value * power;

    results.totalWeight += power;
    results.countByChoice[value] = (results.countByChoice[value] || 0) + 1;
    results.weightByChoice[value] = (results.weightByChoice[value] || 0) + weightedValue;
  });

  // Calculate participation
  const totalEligibleMarketCaps = 1; // TODO: implement await getTotalEligibleMarketCaps(proposal);
  results.participation = results.totalWeight / totalEligibleMarketCaps;

  // Check if voting period has ended
  if (Date.now() > proposal.endDate) {
    proposal.status = "closed";
    const quorumMet = (results.count / totalEligibleMarketCaps) >= proposal.quorum;

    if (quorumMet) {
      // Determine the outcome based on weighted results and vote counts
      const choices = Object.keys(results.weightByChoice);
      choices.sort((a, b) => {
        if (results.weightByChoice[a] === results.weightByChoice[b]) {
          return results.countByChoice[b] - results.countByChoice[a]; // Sort by count if weights are equal
        }
        return results.weightByChoice[b] - results.weightByChoice[a]; // Sort by weight
      });

      const topChoice = choices[0];
      const secondChoice = choices[1];

      if (results.weightByChoice[topChoice] === results.weightByChoice[secondChoice] &&
          results.countByChoice[topChoice] === results.countByChoice[secondChoice]) {
        results.outcome = "failed"; // Consider proposal failed if top two choices are tied in weight and count
      } else {
        results.choice = topChoice;
        results.outcome = "passed";
      }
    } else {
      results.outcome = "failed"; // lack of quorum
    }
  }

  await pushProposal({ ...proposal, result: results });
  return results;
}

export { averageSnapshotBalances, castVote, generateVoteMessage, tallyResults };
