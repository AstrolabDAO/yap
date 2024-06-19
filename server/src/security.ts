import * as jwt from "jsonwebtoken";
import { Signature, recoverAddress, hashMessage } from "ethers";

import config from "./config";
import { Authored, EligibilityCriteria, EligibilityCriterion, Interval, JwtPayload } from "../../common/models";
import { User } from "../../common/models";
import { getProposalEligibility, getUser, getUserBanCount, getUserLastMessage, getUserLastProposal, getUserMessageCount, getUserMuteCount, getUserProposalCount, getUserSpamCount, getVotingEligibility, grantRole, grantRoles, incrementUserBanCount, incrementUserMuteCount, isModerator, pushUser } from "./io";
import { getBalances, toSec, toMs } from "./utils";

function generateJwt(payload: JwtPayload, salt=config.server.jwt_session_salt, ttl: Interval = "h1"): string {
  return jwt.sign(payload, salt, { expiresIn: toMs(ttl) });
}

function verifyJwt(token: string, salt=config.server.jwt_session_salt): JwtPayload | null {
  try {
    if (!token) return null;
    const tokenWithoutBearer = token.replace("Bearer ", "");
    return jwt.verify(tokenWithoutBearer, salt) as JwtPayload;
  } catch (error) {
    console.error("Error verifying token:", error);
    return null;
  }
}

function verifyAndRefreshJwt(token: string, salt: string, grace: Interval = "m30", ttl: Interval = "h1"): [string, JwtPayload] {
  const payload = verifyJwt(token);
  if (!payload) {
    throw new Error(`Invalid token: ${token}`);
  }
  if (typeof payload.exp !== 'number') {
    throw new Error('Invalid token: missing or invalid expiration time');
  }
  if (payload.exp * 1000 > (Date.now() - toMs(grace))) {
    token = generateJwt(payload, salt, ttl);
  }
  return [token, payload];
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
  criteria: EligibilityCriteria
): Promise<[boolean, bigint[]]> {
  const relevantXTokens = [...new Set([...criteria.map((c) => c.xtoken)])];
  const balances = await getBalances(user.address, relevantXTokens);
  const eligible = criteria.some(
    (crit) =>
      balances[relevantXTokens.indexOf(crit.xtoken)] > BigInt(crit.min_balance)
  );
  return [eligible, balances];
}

function isMutedOrBanned(user: User): boolean {
  const now = Date.now();
  const [muted, banned] = [
    user.moderation.muted.until > now,
    user.moderation.banned.until > now
  ];
  return muted || banned;
}

async function canMessage(user: User): Promise<boolean> {
  if (isMutedOrBanned(user)) return false;
  const tooMany = await getUserMessageCount(user.address, 'D1') > config.moderation.daily_message_limit;
  const tooEarly = Date.now() - await getUserLastMessage(user.address) < toMs(config.moderation.message_cooldown);
  return await isModerator(user.address) || ((
    await getEligibility(user, config.governance.eligibility.messaging)
  )[0] && !tooMany && !tooEarly);
}

async function canEdit(user: User, authored: Authored): Promise<boolean> {
  if (isMutedOrBanned(user)) return false;
  const isAuthor = authored.author === user.address;
  return await isModerator(user.address) || isAuthor;
}

async function canPropose(user: User): Promise<boolean> {
  if (isMutedOrBanned(user)) return false;
  const tooMany = await getUserProposalCount(user.address, 'D1') > config.moderation.daily_proposal_limit;
  const tooEarly = Date.now() - await getUserLastProposal(user.address) < toMs(config.moderation.proposal_cooldown);
  return await isModerator(user.address) || ((
    await getEligibility(user, config.governance.eligibility.proposing)
  )[0] && !tooMany && !tooEarly);
}

async function canVote(user: User): Promise<boolean> {
  return (await getEligibility(user, await getVotingEligibility()))[0];
}

const muteUser = (address: string, interval: Interval|number) => Promise.all([
  getUser(address).then(user => {
    const now = Date.now();
    user.moderation.muted = {
      since: now,
      until: now + toMs(interval),
      by: "system",
      count: user.moderation.muted.count + 1
    };
    return pushUser(user);
  }),
  incrementUserMuteCount(address)
]);

const banUser = (address: string, interval: Interval|number) => Promise.all([
  getUser(address).then(user => {
    const now = Date.now();
    user.moderation.banned = {
      since: now,
      until: now + toMs(interval),
      by: "system",
      count: user.moderation.banned.count + 1
    };
    return pushUser(user);
  }),
  incrementUserBanCount(address)
]);

async function cuffUser(address: string) {
  const [spams, mutes, bans] = await Promise.all([
    getUserSpamCount(address),
    getUserMuteCount(address),
    getUserBanCount(address)
  ]);
  for (const rule of config.moderation.ban.reverse()) {
    if (spams >= rule.after) {
      await banUser(address, rule.duration);
      return;
    }
  }
  for (const rule of config.moderation.mute.reverse()) {
    if (spams >= rule.after) {
      await muteUser(address, rule.duration);
      return;
    }
  }
}

export {
  generateJwt,
  verifyJwt,
  verifyAndRefreshJwt,
  updateJwtClaim,
  getEligibility,
  canMessage,
  canPropose,
  canEdit,
  canVote,
  cuffUser,
  muteUser,
  banUser
};
