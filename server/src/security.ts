import * as jwt from "jsonwebtoken";
import config from "./config";
import { EligibilityCriteria, JwtPayload } from "../../common/models";
import { User } from "../../common/models";
import { grantRole, grantRoles } from "./io";
import { getBalances } from "./utils";

function generateJwt(payload: JwtPayload, expiresIn: string = "1h"): string {
  return jwt.sign(payload, config.server.jwt_secret, { expiresIn });
}

function verifyJwt(token: string): JwtPayload | null {
  try {
    if (!token) return null;
    const tokenWithoutBearer = token.replace("Bearer ", "");
    return jwt.verify(
      tokenWithoutBearer,
      config.server.jwt_secret
    ) as JwtPayload;
  } catch (error) {
    console.error("Error verifying token:", error);
    return null;
  }
}

function refreshJwt(token: string, expiresIn: string = "1h"): string | null {
  const payload = verifyJwt(token);
  if (!payload) return null; // Invalid token
  return generateJwt(payload, expiresIn);
}

function updateJwtClaim(
  token: string,
  claim: string,
  value: any
): string | null {
  const payload = verifyJwt(token);
  if (!payload) return null;
  payload[claim] = value;
  return generateJwt(payload);
}

async function getEligibility(
  user: User | JwtPayload,
  criteria: EligibilityCriteria[]
): Promise<[boolean, bigint[]]> {
  const relevantXTokens = [...new Set([...criteria.map((c) => c.xtoken)])];
  const balances = await getBalances(user.address, relevantXTokens);
  const eligible = criteria.some(
    (crit) =>
      balances[relevantXTokens.indexOf(crit.xtoken)] > BigInt(crit.balance)
  );
  return [eligible, balances];
}

// TODO: implement topic/proposal specific eligibility checks
async function canMessage(user: User, topicId?: string): Promise<boolean> {
  return (
    await getEligibility(user, config.governance.eligibility.messaging)
  )[0];
}

async function canPostProposal(user: User): Promise<boolean> {
  return (await getEligibility(user, config.governance.eligibility.posting))[0];
}

async function canVote(user: User, proposalId: string): Promise<boolean> {
  return (await getEligibility(user, config.governance.eligibility.voting))[0];
}

async function canModerate(user: User): Promise<boolean> {
  return (
    config.moderation.admins.includes(user.address) ||
    config.moderation.moderators.includes(user.address)
  );
}

async function isSpam(content: string): Promise<boolean> {
  return config.moderation.spam_filters.some((f) => new RegExp(f).test(content));
}

export {
  generateJwt,
  verifyJwt,
  refreshJwt,
  updateJwtClaim,
  getEligibility,
  canMessage,
  canPostProposal,
  canVote,
  canModerate,
  initializeRoles,
};
