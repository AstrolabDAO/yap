import { getAddress } from "ethers";

import { EligibilityCriteria, Role, User } from "../../common/models";
import { getEligibility, getUser, grantRole, pushEligibilities, pushUser } from "./io";
import { getProvider } from "./state";
import config from "./config";
import { DEFAULT_USER_SETTINGS } from "../../common/constants";

const userPublicAttributes = ["ens", "name", "picture", "title", "joined", "proposalIds", "topics", "badges", "reputation", "settings"];

async function createUser(user: Partial<User>): Promise<User> {

  if (!user.address) {
    throw new Error("User address is required");
  }
  user.address = getAddress(user.address); // ensure checksum
  const prev = await getUser(user.address);
  if (prev) {
    throw new Error(`User already exists: ${JSON.stringify(prev)}`);
  }
  const ens = await (await getProvider(1)).lookupAddress(user.address) ?? "";
  const name = user.name || ens?.replace(".eth", "") || "Anon";
  const title = user.title || "Lurker";
  user = <User>{
    ...user,
    ens,
    name,
    title,
    joined: Date.now(),
    picture: "",
    proposalIds: [],
    topicIds: [],
    voteIds: [],
    roles: [],
    badges: [],
    reputation: 0,
    balances: {},
    moderation: {
      muted: { since: 0, until: 0, by: "", count: 0 },
      banned: { since: 0, until: 0, by: "", count: 0 },
    },
    settings: {
      ...DEFAULT_USER_SETTINGS,
      ...(user.settings ?? {}),
    },
  };
  await pushUser(<User>user);
  console.log(`Created new user: ${JSON.stringify(user)}`);
  return <User>user;
}


async function initRoles() {
  const addressesByRole: { [role: string]: string[] } = {
    adm: config.moderation.admins,
    mod: config.moderation.moderators,
    gov: config.governance.governors,
  };
  console.log(`Initializing roles: ${JSON.stringify(addressesByRole, null, 2)}...`);
  for (const role in addressesByRole) {
    const addresses = addressesByRole[role];
    const jobs = [];
    for (const address of addresses) {
      if (!await getUser(address)) {
        jobs.push(createUser({ address }).then((u) => grantRole(address, <Role>role)));
      }
    }
    await Promise.all(jobs);
  }
}

async function initEligibility() {
  console.log(
    `Initializing eligibility: ${JSON.stringify(
      config.governance.eligibility
    , null, 2)}...`
  );
  const types = ["messaging", "proposing", "voting"];
  const prevs = await Promise.all(types.map((type) => getEligibility(type))) as EligibilityCriteria[];
  return Promise.all(types.filter((_, i) => !prevs[i]).map((type) =>
      pushEligibilities(type, (<any>config.governance.eligibility)[type])));
}

export { userPublicAttributes, createUser, initRoles, initEligibility };
