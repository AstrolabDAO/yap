import { Interval } from "../../common/models";
import config from "./config";
import { blacklistFor, getSpamFilters, getUser, getUserSpamCount, incrementUserBanCount, incrementUserMuteCount, incrementUserSpamCount, isSpam, pushSpamFilters, pushUser } from "./io";
import { toMs } from "./utils";

async function initSpamFilters() {
  console.log(
    `Initializing spam filters: ${JSON.stringify(config.moderation.spam_filters, null, 2)}...`
  );
  const filters = config.moderation.spam_filters;
  const existing = await getSpamFilters();
  return pushSpamFilters(filters.filter((f) => !existing.includes(f)));
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
  blacklistFor(address, interval),
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

function cuffDuration(spams: number) {
  for (const rule of config.moderation.ban.reverse()) {
    if (spams == rule.after) {
      return rule.duration;
    }
  }
  for (const rule of config.moderation.mute.reverse()) {
    if (spams == rule.after) {
      return rule.duration;
    }
  }
  return 0;
}

async function cuffIfSpam(address: string, ...contents: string[]) {
  if (await isSpam(...contents)) {
    await incrementUserSpamCount(address);
    await cuffAddress(address);
    return true;
  }
  return false;
}

async function cuffAddress(address: string) {
  const [spams, mutes, bans] = await Promise.all([
    getUserSpamCount(address),,,
    // getUserMuteCount(address),
    // getUserBanCount(address)
  ]);
  const duration = cuffDuration(spams);
  if (duration) {
    await banUser(address, duration);
  }
}

export { initSpamFilters, muteUser, banUser, cuffIfSpam, cuffAddress };
