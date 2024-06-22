import * as jwt from "jsonwebtoken";

import {
  AirDrop,
  Authored,
  Currency,
  EligibilityCriteria,
  Interval,
  JwtPayload,
  Proposal,
  User
} from "../../common/models";
import { toMs } from "../../common/utils";
import { getMovingAverage } from "../../common/maths/averages";
import config from "./config";
import {
  blacklistFor,
  getBalances,
  getSnapShots,
  getUserLastMessage,
  getUserLastProposal,
  getUserMessageCount,
  getUserProposalCount,
  getVotingEligibility,
  isModerator
} from "./io";
import { getXToken } from "./state";

function generateJwt(
  payload: JwtPayload,
  salt = config.server.jwt_session_salt,
  ttl: Interval = "h1"
): string {
  return jwt.sign(payload, salt, { expiresIn: toMs(ttl) });
}

function verifyJwt(
  token: string,
  salt = config.server.jwt_session_salt
): JwtPayload | null {
  try {
    if (!token) return null;
    const tokenWithoutBearer = token.replace("Bearer ", "");
    return jwt.verify(tokenWithoutBearer, salt) as JwtPayload;
  } catch (error) {
    console.error("Error verifying token:", error);
    return null;
  }
}

async function revokeJwt(token: string): Promise<void> {
  token = token.replace("Bearer ", "");
  const payload = verifyJwt(token);
  if (payload) {
    const expiration = payload.exp as number;
    const remainingTime = expiration * 1000 - Date.now(); // Calculate remaining TTL in ms
    await blacklistFor(token, remainingTime);
  }
}

function verifyAndRefreshJwt(
  token: string,
  salt: string,
  grace: Interval = "m30",
  ttl: Interval = "h1"
): [string, JwtPayload] {
  const payload = verifyJwt(token);
  if (!payload) {
    throw new Error(`Invalid token: ${token}`);
  }
  if (typeof payload.exp !== "number") {
    throw new Error("Invalid token: missing or invalid expiration time");
  }
  if (payload.exp * 1000 > Date.now() - toMs(grace)) {
    token = generateJwt(payload, salt, ttl);
  }
  return [token, payload];
}

async function averageSnapshotBalances(address: string, options: { snapshotIds?: string[], proposal?: Proposal, airDrop?: AirDrop, denomination?: Currency }): Promise<number[]> {
  const ids = options.snapshotIds ?? options.proposal?.snapshotIds ?? [];
  if (!ids.length) {
    throw new Error(`No snapshots found for ${address}, snapshotIds: ${ids}`);
  }
  if (options.denomination && options.denomination !== "usd") {
    throw new Error(`Unsupported denomination: ${options.denomination}, use any of [USD, undefined (raw token balances)]`);
  }
  const snapshots = await getSnapShots(ids);
  const balances: { [xtoken: string]: number }[] =
    snapshots.map((s) => (options.denomination ? s!.usdBalances[address] : s!.balances[address]) ?? 0);
  const sums = balances.map((b) => Object.values(b).reduce((acc, val) => acc + val, 0)); // by epoch
  return getMovingAverage(options.proposal?.snapshotConfig.weightFunction ?? "simple", sums);
}

function defaultVotingEligibility(): EligibilityCriteria {
  return config.governance.eligibility.voting;
}

async function getEligibility(
  user: User | JwtPayload,
  criteria: EligibilityCriteria,
  proposal?: Proposal,
): Promise<[boolean, number[]]> {
  const relevantXTokens = [
    ...new Set([...criteria.map((c) => getXToken(c.xtoken))]),
  ];
  const balances = proposal?.snapshotIds ?
    await averageSnapshotBalances(user.address, { proposal }) :
    await getBalances(user.address, relevantXTokens);

  const eligible = criteria.some(
    (crit) =>
      balances[relevantXTokens.indexOf(crit.xtoken)] > BigInt(crit.min_balance)
  );
  return [eligible, balances];
}

function isMuted(user: User): boolean {
  return user.moderation.muted.until > Date.now();
}

function isBanned(user: User): boolean {
  return user.moderation.banned.until > Date.now();
}

function isMutedOrBanned(user: User): boolean {
  return isMuted(user) || isBanned(user);
}

async function canMessage(user: User): Promise<boolean> {
  if (isMutedOrBanned(user)) return false;
  const tooMany =
    (await getUserMessageCount(user.address, "D1")) >
    config.moderation.daily_message_limit;
  const tooEarly =
    Date.now() - (await getUserLastMessage(user.address)) <
    toMs(config.moderation.message_cooldown);
  return (
    (await isModerator(user.address)) ||
    ((await getEligibility(user, config.governance.eligibility.messaging))[0] &&
      !tooMany &&
      !tooEarly)
  );
}

async function canEdit(user: User, authored: Authored): Promise<boolean> {
  if (isMutedOrBanned(user)) return false;
  const isAuthor = authored.author === user.address;
  return (await isModerator(user.address)) || isAuthor;
}

async function canPropose(user: User): Promise<boolean> {
  if (isMutedOrBanned(user)) return false;
  const tooMany =
    (await getUserProposalCount(user.address, "D1")) >
    config.moderation.daily_proposal_limit;
  const tooEarly =
    Date.now() - (await getUserLastProposal(user.address)) <
    toMs(config.moderation.proposal_cooldown);
  return (
    (await isModerator(user.address)) ||
    ((await getEligibility(user, config.governance.eligibility.proposing))[0] &&
      !tooMany &&
      !tooEarly)
  );
}

async function canVote(user: User): Promise<boolean> {
  return (await getEligibility(user, await getVotingEligibility() as EligibilityCriteria))[0];
}

async function canLogin(user: User): Promise<boolean> {
  return !isBanned(user);
}

export {
  canEdit,
  canLogin,
  canMessage,
  canPropose,
  canVote,
  generateJwt,
  isBanned,
  isMuted,
  isMutedOrBanned,
  revokeJwt, verifyAndRefreshJwt,
  verifyJwt,
  averageSnapshotBalances,
  defaultVotingEligibility,
  getEligibility,
};

