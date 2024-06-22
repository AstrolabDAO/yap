import Redis from "ioredis";
import config from "./config";
import { Proposal, Vote, Topic, Message, User, Role, Snapshot, AirDrop, EligibilityCriterion, EligibilityCriteria, Interval, Resource } from "../../common/models";
import { toSec, unique } from "../../common/utils";

let redis: Redis;

const getRedis = async () => {
  if (!redis || redis.status !== "ready") {
    redis = await new Redis(config.redis);
  }
  return redis;
};

// Core Redis Operations
const redisGet = async (key: string) => (await getRedis()).get(key);
const redisMget = async (keys: string[]) => (await getRedis()).mget(keys);
const redisKeys = async (pattern: string) => (await getRedis()).keys(pattern);
const redisScanStream = async (pattern: string) => (await getRedis()).scanStream({ match: pattern }).toArray();
const redisSet = async (key: string, value: string) => (await getRedis()).set(key, value);
const redisExpire = async (key: string, ttl: number) => (await getRedis()).expire(key, ttl);
const redisSetEx = async (key: string, value: string, ttl: number) => (await getRedis()).setex(key, ttl, value);
const redisMset = async (pairs: [string, string][]) => (await getRedis()).mset(pairs);
const redisMsetEx = async (pairs: [string, string, number][]) => {
  const pipe = (await getRedis()).pipeline();
  pairs.forEach(([key, value, ttl]) => pipe.set(key, value, 'EX', ttl));
  await pipe.exec();
};
const redisRpush = async (key: string, value: string) => (await getRedis()).rpush(key, value);
const redisLrange = async (key: string) => (await getRedis()).lrange(key, 0, -1);
const redisSadd = async (key: string, ...values: string[]) =>
  (await getRedis()).sadd(key, ...values);
const redisSmembers = async (key: string) => (await getRedis()).smembers(key);
const redisIncr = async (key: string) => (await getRedis()).incr(key);
const redisIncrBy = async (key: string, increment: number) => (await getRedis()).incrby(key, increment);
const incrKeepOrSetTtl = async (key: string, increment = 1, ttl = 0) => {
    const [[, prevTtl], [,]]: any = await redis.pipeline().ttl(key).incrby(key, increment).exec();
    if (prevTtl <= 0) {
      await redis.expire(key, ttl);
    }
}
// Helper Functions
const parseJSON = <T>(raw: string | null): T|null =>
  raw ? JSON.parse(raw) as T : null;

const getByKey = async <T>(key: string) => redisGet(key).then(raw => parseJSON<T>(raw));
const getByKeys = async <T>(keys: string[]) => keys?.length ? (await redisMget(keys)).map(raw => parseJSON<T>(raw)) : Promise.resolve([]);
const getAllByPattern = async <T>(pattern: string) => redisKeys(pattern).then(keys => getByKeys<T>(keys)); // redisScanStream(pattern).then(keys => getByKeys<T>(keys, type));
const setByKey = async <T>(key: string, data: T) => redisSet(key, JSON.stringify(data));
const setExByKey = async <T>(key: string, data: T, expiry: number) => redisSetEx(key, JSON.stringify(data), expiry);
const setByKeys = async <T>(pairs: [string, T][]) => redisMset(pairs.map(([k, v]) => [k, JSON.stringify(v)]));
const pushToList = async <T>(key: string, data: T) => redisRpush(key, JSON.stringify(data));
const removeFromList = async (key: string, value: string) => (await getRedis()).lrem(key, 0, value);
const popFromList = async (key: string) => (await getRedis()).lpop(key);
const getList = async <T>(key: string) => (await redisLrange(key)).map(raw => parseJSON<T>(raw));
const addToSet = async <T>(key: string, ...values: T[]) => values?.length ? redisSadd(key, ...values.map(d => JSON.stringify(d))) : Promise.resolve(0);
const removeFromSet = async (key: string, ...values: string[]) => values?.length ? (await getRedis()).srem(key, ...values) : Promise.resolve(0);
const flush = async (key: string) => (await getRedis()).del(key);
const getSet = async <T>(key: string) => (await redisSmembers(key)).map(raw => parseJSON<T>(raw));

// Entity-Specific Functions
const getUser = (address: string) => getByKey<User>(`user:${address}`);
const getUsers = (addresses: string[]) => getByKeys<User>(addresses.map(addr => `user:${addr}`));
const getAllUsers = () => getAllByPattern<User>("user:*");
const pushUser = (user: User) => Promise.all([
  setByKey(`user:${user.address}`, user),
  incrementTotalCount("user")
]);

const getUserMessageCount = (address: string, interval: Interval) => redisGet(`user-message-count:${address}:${interval}`).then(count => Number(count));
const incrementUserMessageCount = (address: string, interval: Interval) =>
  incrKeepOrSetTtl(`user-message-count:${address}:${interval}`, 1, toSec(interval));
const getUserProposalCount = (address: string, interval: Interval) => redisGet(`user-proposal-count:${address}:${interval}`).then(count => Number(count));
const incrementUserProposalCount = (address: string, interval: Interval) =>
  incrKeepOrSetTtl(`user-proposal-count:${address}:${interval}`, 1, toSec(interval));
const getUserMessageCountTtl = (address: string, interval: Interval) =>
  redis.ttl(`user-message-count:${address}:${interval}`).then(ttl => ttl > 0 ? ttl : toSec(interval));
const getUserProposalCountTtl = (address: string, interval: Interval) =>
  redis.ttl(`user-proposal-count:${address}:${interval}`).then(ttl => ttl > 0 ? ttl : toSec(interval));
const getUserMessageCountResetDate = (address: string, interval: Interval) =>
  getUserMessageCountTtl(address, interval).then(ttl => Date.now() + (ttl ?? 0) * 1000);
const getUserProposalCountResetDate = (address: string, interval: Interval) =>
  getUserProposalCountTtl(address, interval).then(ttl => Date.now() + (ttl ?? 0) * 1000);
const getUserSpamCount = (address: string) => redisGet(`user-spam-count:${address}`).then(count => Number(count));
const incrementUserSpamCount = (address: string) => redisIncr(`user-spam-count:${address}`);
const resetUserSpamCount = (address: string) => flush(`user-spam-count:${address}`);
const getUserMuteCount = (address: string) => redisGet(`user-mute-count:${address}`).then(count => Number(count));
const incrementUserMuteCount = (address: string) => redisIncr(`user-mute-count:${address}`);
const getUserBanCount = (address: string) => redisGet(`user-ban-count:${address}`).then(count => Number(count));
const incrementUserBanCount = (address: string) => redisIncr(`user-ban-count:${address}`);
const getBalance = (address: string, xtoken: string) => redisGet(`balance:${address}:${xtoken}`)
  .then(balance => BigInt(<any>balance));
const getBalances = (address: string, xtokens: string[]) =>
  redisMget(xtokens.map(token => `balance:${address}:${token}`))
    .then(balances => balances.map(balance => Number(<any>balance)));
const setBalance = (address: string, xtoken: string, balance: bigint) =>
    redisSetEx(`balance:${address}:${xtoken}`, balance.toString(), config.cache.balances_ttl);
const setBalances = (address: string, balances: { [xtoken: string]: number }) =>
  redisMsetEx(Object.entries(balances)
    .map(([token, balance]) => [`balance:${address}:${token}`, balance.toString(), config.cache.balances_ttl]));

const pushSnapShot = (snapshot: Snapshot) => Promise.all([
  setByKey(`snapshot:${snapshot.id}`, snapshot),
  getProposal(snapshot.proposalId).then(proposal => proposal ? pushProposal({ ...proposal, snapshotIds: [...proposal.snapshotIds, snapshot.id] }) : null),
  getAirDrop(snapshot.airDropId).then(airDrop => airDrop ? pushAirDrop({ ...airDrop, snapshotIds: [...airDrop.snapshotIds, snapshot.id] }) : null),
  incrementTotalCount("snapshot")
]);
const getSnapShot = (id: string) => getByKey<Snapshot>(`snapshot:${id}`);
const getSnapShots = (ids: string[]) => getByKeys<Snapshot>(ids.map(id => `snapshot:${id}`));
const getAllSnapShots = () => getAllByPattern<Snapshot>("snapshot:*");

const getTopic = (id: string) => getByKey<Topic>(`topic:${id}`);
const getTopics = (ids: string[]) => getByKeys<Topic>(ids.map(id => `topic:${id}`));
const getUserTopicIds = (address: string) => getUser(address).then(user => user!.topicIds);
const getUserTopics = (address: string) => getUserTopicIds(address).then(topicIds => getTopics(topicIds));
const getAllTopics = () => getAllByPattern<Topic>("topic:*");
const pushTopic = (topic: Topic) => Promise.all([
  setByKey(`topic:${topic.id}`, topic),
  incrementTotalCount("topic")
]);
const removeTopic = (id: string) => flush(`topic:${id}`);
const getTotalCount = (resource: Resource) => redisGet(`count:${resource}`).then(count => Number(count ?? 0));
const incrementTotalCount = (resource: Resource) => redisIncr(`count:${resource}`);
const getUserCount = () => getTotalCount("user");
const getProposalCount = () => getTotalCount("proposal");
const getTopicCount = () => getTotalCount("topic");
const getMessageCount = () => getTotalCount("message");
const getVoteCount = () => getTotalCount("vote");
const getSnapshotCount = () => getTotalCount("snapshot");
const getAirDropCount = () => getTotalCount("airdrop");

const getMessage = (id: string) => {
  const pipe = redis.pipeline();
  pipe.get(`message:${id}`);
  pipe.smembers(`message-upvotes:${id}`);
  pipe.smembers(`message-downvotes:${id}`);
  const [message, upvotes, downvotes] = pipe.exec() as any;
  return { ...message, upvotes, downvotes };
}

const getUserMessages = (address: string) => getList<Message>(`user-messages:${address}`);
const pushMessage = (message: Message) => Promise.all([
    getTopic(message.topicId).then(topic => pushTopic({ ...topic!, messageIds: [...topic!.messageIds, message.id] })),
    pushToList(`topic-messages:${message.topicId}`, message),
    pushToList(`user-messages:${message.author}`, message), // more volume than votes/proposals -> dedicated list
    redisSet(`user-last-message:${message.author}`, Date.now().toString()),
    incrementTotalCount("message")
]);
const getUserLastMessage = (address: string) => redisGet(`user-last-message:${address}`).then(ts => Number(ts));

const removeMessage = (message: Message) => Promise.all([
  flush(`message:${message.id}`),
  removeFromList(`topic-messages:${message.topicId}`, message.id),
  removeFromList(`user-messages:${message.author}`, message.id)
]);

const getTopicMessages = (topicId: string) => getList<Message>(`topic-messages:${topicId}`)
  .then(messages => {
    // retrieve all sets of upvotes and downvotes for each message using a pipe
    const pipe = redis.pipeline();
    messages.forEach(message => {
      pipe.smembers(`message-upvotes:${message!.id}`);
      pipe.smembers(`message-downvotes:${message!.id}`);
    });
    const res = pipe.exec() as any;
    // combine upvotes and downvotes with messages
    return messages.map((message, i) => ({ ...message, upvotes: res[i * 2], downvotes: res[i * 2 + 1] }));
  });
const getTopicUserAddresses = (topicId: string) => getTopicMessages(topicId).then(messages => messages.map(m => m.author!));
const getTopicUsers = (topicId: string) => getTopicUserAddresses(topicId).then(addresses => getUsers(addresses));
const decreaseUserReputation = (address: string, amount: number) => getUser(address).then(user => pushUser({ ...user!, reputation: user!.reputation - amount }));
const increaseUserReputation = (address: string, amount: number) => getUser(address).then(user => pushUser({ ...user!, reputation: user!.reputation + amount }));
const getMessageUpvotes = (messageId: string) => getSet<string>(`message-upvotes:${messageId}`);
const getMessageDownvotes = (messageId: string) => getSet<string>(`message-downvotes:${messageId}`);
const pushMessageUpvote = (messageId: string, address: string) => Promise.all([
  addToSet(`message-upvotes:${messageId}`, address),
  increaseUserReputation(address, 1)
]);
const pushMessageDownvote = (messageId: string, address: string) => Promise.all([
  addToSet(`message-downvotes:${messageId}`, address),
  decreaseUserReputation(address, 1)
]);
const removeMessageUpvote = (messageId: string, address: string) => Promise.all([
  removeFromSet(`message-upvotes:${messageId}`, address),
  decreaseUserReputation(address, 1)
]);
const removeMessageDownvote = (messageId: string, address: string) => Promise.all([
  removeFromSet(`message-downvotes:${messageId}`, address),
  increaseUserReputation(address, 1)
]);

const getSpamFilters = () => getSet<string>("spam:filters");
const isSpam = (...contents: string[]) => getSpamFilters()
  .then(filters => contents.filter(s => s).some(content => filters.some(f => new RegExp(f!).test(content))));
const pushSpamFilter = (filter: string) =>
    addToSet("spam:filters", filter);
const pushSpamFilters = (filters: string[]) => addToSet("spam:filters", ...filters);
const removeSpamFilter = (filter: string) => removeFromSet("spam:filters", filter);
const removeSpamFilters = (filters: string[]) => removeFromSet("spam:filters", ...filters);

const getEligibility = (id: string) => getSet<EligibilityCriterion>(`eligibility:${id}`);
const pushEligibility = (id: string, crit: EligibilityCriterion) => addToSet(`eligibility:${id}`, crit);
const pushEligibilities = (id: string, criteria: EligibilityCriteria) => addToSet(`eligibility:${id}`, ...criteria);
const getMessagingEligibility = () => getEligibility("messaging");
const getProposalEligibility = () => getEligibility("proposing");
const getVotingEligibility = () => getEligibility("voting");
const flushEligibility = (id: string) => flush(`eligibility:${id}`);

const getAirDrop = (id: string) => getByKey<AirDrop>(`airdrop:${id}`);
const getAirDrops = (ids: string[]) => getByKeys<AirDrop>(ids.map(id => `airdrop:${id}`));
const getAllAirDrops = () => getAllByPattern<AirDrop>("airDrop:*");
const pushAirDrop = (airDrop: AirDrop) => Promise.all([
  setByKey(`airdrop:${airDrop.id}`, airDrop),
  incrementTotalCount("airdrop")
]);

const getProposal = (id: string) => getByKey<Proposal>(`proposal:${id}`);
const getProposals = (ids: string[]) => getByKeys<Proposal>(ids.map(id => `proposal:${id}`));
const getAllProposals = () => getAllByPattern<Proposal>("proposal:*");
const getUserProposalIds = (address: string) => getUser(address).then(user => user!.proposalIds);
const getUserProposals = (address: string) => getUserProposalIds(address).then(getProposals);
const pushProposal = (proposal: Proposal) => Promise.all([
  getTopic(proposal.topicId).then(topic => pushTopic({ ...topic!, proposalId: proposal.id })),
  setByKey(`proposal:${proposal.id}`, proposal),
  getUser(proposal.author).then(user => pushUser({ ...user!, proposalIds: [...user!.proposalIds, proposal.id] })),
  redisSet(`user-last-proposal:${proposal.author}`, Date.now().toString()),
  incrementTotalCount("proposal")
]);
const removeProposal = (id: string) => flush(`proposal:${id}`);
const getUserLastProposal = (address: string) => redisGet(`user-last-proposal:${address}`).then(ts => Number(ts));

const getVote = (id: string) => getByKey<Vote>(`vote:${id}`);
const getVotes = (ids: string[]) => getByKeys<Vote>(ids.map(id => `vote:${id}`));
const getAllVotes = () => getAllByPattern<Vote>("vote:*");

const getUserProposalVote = (proposalId: string, address: string) => getByKey<Vote>(`user-votes:${address}:${proposalId}`);
const hasUserVoted = (proposalId: string, address: string) => redisGet(`user-votes:${address}:${proposalId}`).then(vote => !!vote);
const getProposalVotes = (proposalId: string) => getSet<Vote>(`proposal-votes:${proposalId}`);
const getUserVoteIds = (address: string) => getUser(address).then(user => user!.voteIds);
const getUserVotes = (address: string) => getUserVoteIds(address).then(getVotes);
const pushVote = (vote: Vote) => Promise.all([
  setByKey(`vote:${vote.id}`, vote),
  getProposal(vote.proposalId).then(proposal => pushProposal({ ...proposal!, voteIds: [...proposal!.voteIds, vote.id] })),
  getUser(vote.address).then(user => pushUser({ ...user!, voteIds: [...user!.voteIds, vote.id] })),
  addToSet(`proposal-votes:${vote.proposalId}`, vote)
]);

const getRoles = (address: string) => getUser(address).then(user => user!.roles);
const hasRole = (address: string, role: Role) => getRoles(address).then(roles => roles.includes(role));
const hasAnyRole = (address: string, roles: Role[]) => getRoles(address).then(userRoles => roles.some(role => userRoles.includes(role)));
const isAdmin = (address: string) => hasRole(address, "adm");
const isGovernor = (address: string) => hasAnyRole(address, ["adm", "gov"]);
const isModerator = (address: string) => hasAnyRole(address, ["adm", "mod"]);

const grantRole = (address: string, role: Role) => Promise.all([
  addToSet(`role:${role}`, address),
  getUser(address).then(user => pushUser({ ...user!, roles: unique([...user!.roles, role]) }))
]);
const grantRoles = (address: string, roles: Role[]) => Promise.all([
  roles.map(role => addToSet(`role:${role}`, address)),
  getUser(address).then(user => pushUser({ ...user!, roles: unique([...user!.roles, ...roles]) })),
].flat());
const revokeRole = (address: string, role: Role) => Promise.all([
  removeFromSet(`role:${role}`, address),
  getUser(address).then(user => pushUser({ ...user!, roles: user!.roles.filter(r => r !== role) }))
]);
const revokeRoles = (address: string, roles: Role[]) => Promise.all([
  roles.map(role => removeFromSet(`role:${role}`, address)),
  getUser(address).then(user => pushUser({ ...user!, roles: user!.roles.filter(r => !roles.includes(r)) }))
].flat());
const revokeAllRoles = (address: string) => Promise.all([
  ["adm", "gov", "mod"].map(role => removeFromSet(`role:${role}`, address)),
  getUser(address).then(user => pushUser({ ...user!, roles: [] }))
].flat());
const blacklistForever = (id: string) => setByKey(`blacklist:${id}`, true);
const blacklistFor = (id: string, interval: Interval|number) => redisSetEx(`blacklist:${id}`, "true", toSec(interval));
const isBlacklisted = (id: string) => redisGet(`blacklist:${id}`).then(blacklisted => !!blacklisted);
const pushNonce = (address: string, nonce: string) => redisSetEx(`nonce:${address}`, nonce, toSec("m5"));
const getNonce = (address: string) => redisGet(`nonce:${address}`);

export {
  setByKey,
  setByKeys,
  setExByKey,
  pushToList,
  popFromList,
  getRedis,
  getUser,
  getUsers,
  getAllUsers,
  pushUser,
  getUserMessageCount,
  incrementUserMessageCount,
  getUserProposalCount,
  incrementUserProposalCount,
  getUserSpamCount,
  incrementUserSpamCount,
  resetUserSpamCount,
  getUserMuteCount,
  incrementUserMuteCount,
  getUserBanCount,
  incrementUserBanCount,
  getBalance,
  getBalances,
  setBalance,
  setBalances,
  getProposal,
  getProposals,
  getSnapShot,
  getSnapShots,
  getAllSnapShots,
  pushSnapShot,
  getEligibility,
  getMessagingEligibility,
  getProposalEligibility,
  getVotingEligibility,
  pushEligibility,
  pushEligibilities,
  flushEligibility,
  getAirDrop,
  getAirDrops,
  getAllAirDrops,
  pushAirDrop,
  getAllProposals,
  getUserProposalIds,
  getUserProposals,
  pushProposal,
  removeProposal,
  getUserLastProposal,
  getUserProposalVote,
  hasUserVoted,
  getProposalVotes,
  getVote,
  getVotes,
  pushVote,
  getAllVotes,
  getUserVoteIds,
  getUserVotes,
  increaseUserReputation,
  decreaseUserReputation,
  getTopic,
  getTopics,
  getAllTopics,
  getUserTopicIds,
  getUserTopics,
  getTopicUsers,
  getTopicUserAddresses,
  pushTopic,
  removeTopic,
  getTopicMessages,
  getUserMessages,
  pushMessage,
  removeMessage,
  getUserLastMessage,
  getMessageUpvotes,
  getMessageDownvotes,
  pushMessageUpvote,
  pushMessageDownvote,
  removeMessageUpvote,
  removeMessageDownvote,
  getMessage,
  getSpamFilters,
  isSpam,
  pushSpamFilter,
  pushSpamFilters,
  removeSpamFilter,
  removeSpamFilters,
  hasRole,
  getRoles,
  isAdmin,
  isGovernor,
  isModerator,
  grantRole,
  grantRoles,
  revokeRole,
  revokeRoles,
  revokeAllRoles,
  blacklistForever,
  blacklistFor,
  isBlacklisted,
  getUserMessageCountTtl,
  getUserProposalCountTtl,
  getUserMessageCountResetDate,
  getUserProposalCountResetDate,
  getTotalCount,
  incrementTotalCount,
  getUserCount,
  getProposalCount,
  getTopicCount,
  getMessageCount,
  getVoteCount,
  getSnapshotCount,
  getAirDropCount,
  pushNonce,
  getNonce,
};
