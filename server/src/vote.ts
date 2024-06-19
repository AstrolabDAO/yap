import { JwtPayload, User, Vote, VoteResults } from "../../common/models";
import { getVotingPower } from "../../common/maths/voting-schemes";
import config from "./config";
import { getProposal, getProposalVotes, hasUserVoted, pushProposal, pushVote } from "./io";
import { getEligibility } from "./security";
import { verifyMessage } from "ethers";

/**
 * Generates a message to be signed by the user for a vote
 * @param proposalId - The ID of the proposal being voted on
 * @param value - The vote value (1 for "for", -1 for "against", 0 for "abstain")
 * @param user - The user object containing balances and address
 * @returns The message string to be signed
 */
async function generateVoteMessage(proposalId: string, value: number, user: User|JwtPayload) {
  const proposal = await getProposal(proposalId);
  const baseEligibility = config.governance.eligibility.voting;
  const specificEligibility = proposal.eligibility;
  const [eligible, balances] = await getEligibility(user, [...baseEligibility, ...specificEligibility]);
  if (!eligible) {
    throw new Error("User not eligible to vote.");
  }
  const message = JSON.stringify({
    proposalId,
    address: user.address,
    value,
    balances,
    timestamp: Date.now(), // To prevent replay attacks
  });
  return message;
}

// Cast Vote (User must be eligible)
async function castVote(proposalId: string, user: User|JwtPayload, value: 1|0|-1, signature: string, autoUpdate=true) {

  const proposal = await getProposal(proposalId);
  const now = Date.now();
  if (now < proposal.startDate || now > proposal.endDate) {
    throw new Error("Voting period not active.");
  }

  if (await hasUserVoted(proposalId, user.address)) {
    throw new Error("User has already voted on this proposal.");
  }

  const baseEligibility = config.governance.eligibility.voting;
  const specificEligibility = proposal.eligibility;
  const [eligible, balances] = await getEligibility(user, [...baseEligibility, ...specificEligibility]);

  if (!eligible) {
    throw new Error("User not eligible to vote.");
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
  const unifiedBalance = balances.reduce((total, balance) => total + balance, BigInt(0));
  const power = getVotingPower(proposal.votingPowerScheme, Number(unifiedBalance));

  vote = {
    ...vote,
    proposalId,
    address: user.address,
    balances: balances.reduce((obj, balance, i) => ({ ...obj, [proposal.eligibility[i].xtoken]: balance }), {}),
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

async function tallyResults(proposalId: string) {
  const proposal = await getProposal(proposalId);
  const votes = await getProposalVotes(proposalId);

  const results = votes.reduce((acc, vote) => {
    const isFor = vote.value === 1;
    const isAgainst = vote.value === -1;
    const isAbstain = vote.value === 0;

    acc.count.total += 1;
    acc.count.for += isFor ? 1 : 0;
    acc.count.against += isAgainst ? 1 : 0;
    acc.count.abstain += isAbstain ? 1 : 0;

    acc.weighted.total += vote.weighted;
    acc.weighted.for += isFor ? vote.weighted : 0;
    acc.weighted.against += isAgainst ? vote.weighted : 0;
    acc.weighted.abstain += isAbstain ? vote.weighted : 0;

    return acc;
  }, {
    outcome: "pending",
    count: { total: 0, for: 0, against: 0, abstain: 0 },
    weighted: { total: 0, for: 0, against: 0, abstain: 0 }
  } as VoteResults);

  if (Date.now() > proposal.endDate) {
    proposal.status = "closed";
    results.outcome = results.weighted.for > results.weighted.against ? "passed" : "failed";
  }

  await pushProposal({ ...proposal, results });
}

// async function pauseVote(proposalId: string) {
// }

// async function cancelVote(proposalId: string) {
// }

// async function closeVote(proposalId: string) {
// }

export { castVote, generateVoteMessage, tallyResults };

