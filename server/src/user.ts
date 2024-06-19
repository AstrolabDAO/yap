import { getAddress } from "ethers";

import { EligibilityCriteria, Role, User } from "../../common/models";
import { Blocky } from "../../common/rendering";
import { getEligibility, getUser, grantRole, pushEligibilities, pushUser } from "./io";
import { getProvider } from "./state";
import config from "./config";

const userPublicAttributes = ["ens", "name", "picture", "title", "joined", "proposalIds", "topics", "badges", "reputation", "settings"];

async function createUserFromAddress(address: string): Promise<User> {

  address = getAddress(address); // ensure checksum
  const ens = await (await getProvider(1)).lookupAddress(address);
  const blocky = new Blocky({ seed: address, scale: 32, size: 7 });
  const prev = await getUser(address);
  if (prev) {
    throw new Error(`User already exists: ${JSON.stringify(prev)}`);
  }
  const user: User = {
    address: getAddress(address), // checksum
    ens: ens || "",
    name: ens?.replace(".eth", "") || "Anon",
    title: "Citizen",
    joined: Date.now(),
    picture: blocky.getDataUrl(),
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
      theme: "dark",
      locale: "en",
      currency: "usd",
      notifications: {
        reputation: true,
        proposals: true,
        messages: false,
        replies: true,
        topics: true,
        votes: false,
      },
      sessionRefresh: true,
    },
  };
  await pushUser(user);
  console.log(`Created new user: ${JSON.stringify(user)}`);
  return user;
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
        jobs.push(createUserFromAddress(address).then((u) => grantRole(address, <Role>role)));
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
  const prevs: EligibilityCriteria[] = await Promise.all(types.map((type) => getEligibility(type)));
  return Promise.all(types.filter((_, i) => !prevs[i]).map((type) =>
      pushEligibilities(type, (<any>config.governance.eligibility)[type])));
}

export { userPublicAttributes, createUserFromAddress, initRoles, initEligibility };
