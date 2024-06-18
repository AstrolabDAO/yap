type VoteValue = 1 | 0 | -1; // For, Abstain, Against
type Role = "adm" | "gov" | "mod"; // Admin, Governor, Moderator
type ProposalStatus = "pending" | "active" | "closed" | "paused" | "canceled";
type VotingPowerScheme =
  | "affine"
  | "linear"
  | "geometric"
  | "exponential"
  | "nthRoot"
  | "powerLaw"
  | "step"
  | "cubicSpline"
  | "sigmoid";
type ModAction = "mute" | "ban"; // Mute, Ban
type VoteOutcome = "pending" | "passed" | "failed"; // == proposal accepted / rejected

interface GeneralEligibility {
  registry: { [xtoken: string]: string }; // Mapping of token identifiers to addresses
  messaging: EligibilityCriteria[]; // Eligibility criteria for messaging
  posting: EligibilityCriteria[]; // Eligibility criteria for posting
  voting: EligibilityCriteria[]; // Eligibility criteria for voting
}

interface EligibilityCriteria {
  xtoken: string; // Token identifier
  balance: number; // Minimum token balance
  duration: number; // Minimum duration in days
}

interface ModRule {
  after: number; // Number of messages before action
  duration: number | "forever"; // Duration of action in seconds
}

interface Config {
  server: {
    port: number; // Port to run the server on
    host: string; // Hostname to bind to
    jwt_secret: string; // Secret for JWT signing
  };
  redis: {
    host: string; // Redis hostname
    port: number; // Redis port
    username: string; // Redis username
    password: string; // Redis password
  };
  cache: {
    balances_ttl: number; // TTL for user balances
  };
  moderation: {
    // Moderation configuration
    admins: string[]; // Array of admin addresses (can elect governors and moderators)
    moderators: string[]; // Array of moderator addresses
    spam_filters: string[]; // Array of regex patterns for spam filtering
    mute: ModRule[]; // Array of mute rules
    ban: ModRule[]; // Array of ban rules
    revoke_on_ban: boolean; // Whether to revoke all roles on ban
    post_cooldown: number; // Minimum seconds between posts/topic creation
    post_limit: number; // Maximum posts/topic creation per day
    message_cooldown: number; // Number of seconds between messages
    message_limit: number; // Maximum number of messages per day
  };
  governance: {
    // Governance configuration
    governors: string[]; // Array of governor addresses
    eligibility: GeneralEligibility; // Eligibility criteria for governance
  };
}

interface Message {
  id: string;
  topicId: string;
  author: string; // EVM address
  content: string;
  upvotes: string[]; // EVM addresses
  downvotes: string[]; // EVM addresses
}

interface Topic {
  id: string;
  title: string;
  author: string; // EVM address
  createdAt: number; // Timestamp
  messageIds: string[];
  proposalId?: string; // If a proposal is attached
}

interface VoteCount {
  total: number;
  for: number;
  against: number;
  abstain: number;
}

interface VoteResults {
  outcome: VoteOutcome;
  count: VoteCount;
  weighted: VoteCount;
}

interface Proposal {
  id: string;
  topicId: string;
  title: string;
  description: string;
  author: string;
  status: ProposalStatus; // if pending, can be accepted or rejected by governors
  startDate: number;
  endDate: number;
  eligibility: EligibilityCriteria[];
  votingPowerScheme: string; // "affine", "linear", etc.
  votes: Vote[];
  results: VoteResults;
}

interface Vote {
  proposalId: string;
  address: string; // user address
  balances: { [xtoken: string]: bigint };
  value: VoteValue;
  power: number; // voting power
  weighted: number; // power * vote (1 for, -1 against, 0 abstain)
  signature: string;
  timestamp: number;
}

interface JwtPayload {
  address: string;
  roles: Role[]; // for front-end conditional rendering/display only
  [key: string]: any;
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
}

interface User extends JwtPayload {
  ens: string;
  name: string;
  picture: string;
  balances: { [xtoken: string]: number };
  proposals: string[]; // Proposal IDs
  topics: string[]; // Topic IDs
  // messages: { [topicId: string]: { [messageId: string]: Message } }; // not stored on the in-memory user object to save memory
}

interface Network {
  name: string;
  slug: string;
  id: number;
  httpRpcs: string[];
}

export {
  VoteValue,
  Role,
  ProposalStatus,
  VotingPowerScheme,
  ModRule,
  ModAction,
  VoteOutcome,
  EligibilityCriteria,
  GeneralEligibility,
  Config,
  Message,
  Proposal,
  Topic,
  JwtPayload,
  User,
  Network,
  Vote,
  VoteCount,
  VoteResults
};
