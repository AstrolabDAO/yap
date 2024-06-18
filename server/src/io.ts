import Redis from "ioredis";
import config from "./config";
import { Proposal, Vote, Topic, Message, User, Role } from "../../common/models";

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
const redisSet = async (key: string, value: string) => (await getRedis()).set(key, value);
const redisSetEx = async (key: string, value: string, ttl: number) => (await getRedis()).setex(key, ttl, value);
const redisMset = async (pairs: [string, string][]) => (await getRedis()).mset(pairs);
const redisMsetEx = async (pairs: [string, string, number][]) => {
  const pipe = (await getRedis()).pipeline();
  pairs.forEach(([key, value, ttl]) => pipe.set(key, value, 'EX', ttl));
  await pipe.exec();
};
const redisRpush = async (key: string, value: string) => (await getRedis()).rpush(key, value);
const redisLrange = async (key: string) => (await getRedis()).lrange(key, 0, -1);
const redisSadd = async (key: string, value: string) => (await getRedis()).sadd(key, value);
const redisSmembers = async (key: string) => (await getRedis()).smembers(key);

// Helper Functions
const parseJSON = <T>(raw: string | null, type: string): T =>
  raw ? JSON.parse(raw) as T : (() => { throw new Error(`${type} not found.`); })();

const getByKey = async <T>(key: string, type: string) => parseJSON<T>(await redisGet(key), type);
const getByKeys = async <T>(keys: string[], type: string) => (await redisMget(keys)).map(raw => parseJSON<T>(raw, type));
const getAllByPattern = async <T>(pattern: string, type: string) => getByKeys<T>(await redisKeys(pattern), type);
const setByKey = async <T>(key: string, data: T) => redisSet(key, JSON.stringify(data));
const setByKeys = async <T>(pairs: [string, T][]) => redisMset(pairs.map(([k, v]) => [k, JSON.stringify(v)]));
const pushToList = async <T>(key: string, data: T) => redisRpush(key, JSON.stringify(data));
const removeFromList = async (key: string, value: string) => (await getRedis()).lrem(key, 0, value);
const popFromList = async <T>(key: string) => (await getRedis()).lpop(key);
const getList = async <T>(key: string) => (await redisLrange(key)).map(raw => parseJSON<T>(raw, 'List'));
const pushToSet = async <T>(key: string, data: T) => redisSadd(key, JSON.stringify(data));
const removeFromSet = async (key: string, value: string) => (await getRedis()).srem(key, value);
const flush = async (key: string) => (await getRedis()).del(key);
const getSet = async <T>(key: string) => (await redisSmembers(key)).map(raw => parseJSON<T>(raw, 'Set'));

// Entity-Specific Functions
const getUser = (address: string) => getByKey<User>(`user:${address}`, "User");
const getUsers = (addresses: string[]) => getByKeys<User>(addresses.map(addr => `user:${addr}`), "User");
const getAllUsers = () => getAllByPattern<User>("user:*", "User");
const pushUser = (user: User) => setByKey(`user:${user.address}`, user);

const getBalance = (address: string, xtoken: string) => redisGet(`balance:${address}:${xtoken}`)
  .then(balance => BigInt(<any>balance));
const getBalances = (address: string, xtokens: string[]) =>
  redisMget(xtokens.map(token => `balance:${address}:${token}`))
    .then(balances => balances.map(balance => BigInt(<any>balance)));
const setBalance = (address: string, xtoken: string, balance: bigint) =>
    redisSetEx(`balance:${address}:${xtoken}`, balance.toString(), config.cache.balances_ttl);
const setBalances = (address: string, balances: { [xtoken: string]: bigint }) =>
  redisMsetEx(Object.entries(balances)
    .map(([token, balance]) => [`balance:${address}:${token}`, balance.toString(), config.cache.balances_ttl]));

const getTopic = (id: string) => getByKey<Topic>(`topic:${id}`, "Topic");
const getTopics = (ids: string[]) => getByKeys<Topic>(ids.map(id => `topic:${id}`), "Topic");
const getAllTopics = () => getAllByPattern<Topic>("topic:*", "Topic");
const pushTopic = (topic: Topic) => setByKey(`topic:${topic.id}`, topic);
const removeTopic = (id: string) => flush(`topic:${id}`);

const getMessage = (id: string) => {
  const pipe = redis.pipeline();
  pipe.get(`message:${id}`);
  pipe.smembers(`message:${id}:upvotes`);
  pipe.smembers(`message:${id}:downvotes`);
  const [message, upvotes, downvotes] = pipe.exec() as any;
  return { ...message, upvotes, downvotes };
}

const getUserMessages = (address: string) => getList<Message>(`user:${address}:messages`);
const pushMessage = (topicId: string, from: string, message: Message) => {
  return Promise.all([
    pushToList(`topic:${topicId}:messages`, message),
    pushToList(`user:${from}:messages`, message) // more volume than votes/proposals -> dedicated list
]);
}
const removeMessage = (id: string) => Promise.all([
  flush(`message:${id}`),
  removeFromList(`topic:${id}`, id),
  removeFromList(`user:${id}`, id)
]);

const getMessageUpvotes = (messageId: string) => getSet<string>(`message:${messageId}:upvotes`);
const getTopicMessages = (topicId: string) => getList<Message>(`topic:${topicId}:messages`)
  .then(messages => {
    // retrieve all sets of upvotes and downvotes for each message using a pipe
    const pipe = redis.pipeline();
    messages.forEach(message => {
      pipe.smembers(`message:${message.id}:upvotes`);
      pipe.smembers(`message:${message.id}:downvotes`);
    });
    const res = pipe.exec() as any;
    // combine upvotes and downvotes with messages
    return messages.map((message, i) => ({ ...message, upvotes: res[i * 2], downvotes: res[i * 2 + 1] }));
  });
const getMessageDownvotes = (messageId: string) => getSet<string>(`message:${messageId}:downvotes`);
const pushMessageUpvote = (messageId: string, address: string) => pushToSet(`message:${messageId}:upvotes`, address);
const pushMessageDownvote = (messageId: string, address: string) => pushToSet(`message:${messageId}:downvotes`, address);

const getProposal = (id: string) => getByKey<Proposal>(`proposal:${id}`, "Proposal");
const getProposals = (ids: string[]) => getByKeys<Proposal>(ids.map(id => `proposal:${id}`), "Proposal");
const getAllProposals = () => getAllByPattern<Proposal>("proposal:*", "Proposal");
const getUserProposals = (address: string) => getUser(address).then(user => getProposals(user.proposals));
const pushProposal = (proposal: Proposal) => setByKey(`proposal:${proposal.id}`, proposal);
const removeProposal = (id: string) => flush(`proposal:${id}`);

const getUserProposalVote = (proposalId: string, address: string) => getByKey<Vote>(`vote:${proposalId}:${address}`, "Vote");
const hasUserVoted = (proposalId: string, address: string) => redisGet(`vote:${proposalId}:${address}`);
const getProposalVotes = (proposalId: string) => getSet<Vote>(`proposal:${proposalId}:votes`);
const getAllVotes = () => getAllByPattern<Vote>("vote:*", "Vote");
const getUserVotes = (address: string) => getAllByPattern(`vote:*:${address}`, "Vote");
const pushVote = (vote: Vote) => {
  Promise.all([
    setByKey(`vote:${vote.proposalId}:${vote.address}`, vote),
    pushToSet(`proposal:${vote.proposalId}:votes`, vote)
  ]);
}

const getRoles = (address: string) => getUser(address).then(user => user.roles);
const hasRole = (address: string, role: Role) => getRoles(address).then(roles => roles.includes(role));
const isAdmin = (address: string) => hasRole(address, "adm");
const isGovernor = (address: string) => hasRole(address, "gov");
const isModerator = (address: string) => hasRole(address, "mod");

const grantRole = (address: string, role: Role) => Promise.all([
  pushToSet(`role:${role}`, address),
  pushToSet(`user:${address}:roles`, role)
]);
const grantRoles = (address: string, roles: Role[]) => Promise.all([
  getUser(address).then(user => pushUser({ ...user, roles })),
  roles.map(role => pushToSet(`role:${role}`, address))
].flat());
const revokeRole = (address: string, role: Role) => Promise.all([
  removeFromSet(`role:${role}`, address),
  getUser(address).then(user => pushUser({ ...user, roles: user.roles.filter(r => r !== role) }))
]);
const revokeAllRoles = (address: string) => Promise.all([
  ["adm", "gov", "mod"].map(role => removeFromSet(`role:${role}`, address)),
  getUser(address).then(user => pushUser({ ...user, roles: [] }))
].flat());

export {
  getRedis,
  getUser,
  getUsers,
  getAllUsers,
  pushUser,
  getBalance,
  getBalances,
  setBalance,
  setBalances,
  getProposal,
  getProposals,
  getAllProposals,
  pushProposal,
  removeProposal,
  getUserProposalVote,
  hasUserVoted,
  getProposalVotes,
  getAllVotes,
  getUserVotes,
  getUserProposals,
  pushVote,
  getTopic,
  getTopics,
  getAllTopics,
  pushTopic,
  removeTopic,
  getTopicMessages,
  getUserMessages,
  pushMessage,
  removeMessage,
  getMessageUpvotes,
  getMessageDownvotes,
  pushMessageUpvote,
  pushMessageDownvote,
  getMessage,
  hasRole,
  isAdmin,
  isGovernor,
  isModerator,
  grantRole,
  grantRoles,
  revokeRole,
  revokeAllRoles
};
