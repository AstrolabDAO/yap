type Role = "adm" | "gov" | "mod"; // Admin, Governor, Moderator
type Resource = "user" | "topic" | "proposal" | "message" | "vote" | "snapshot" | "airdrop";
type Status = "pending" | "active" | "closed" | "paused" | "canceled";
type Interval = "s1" | "s5" | "s15" | "s30" | "m1" | "m5" | "m10" | "m15" | "m30" | "h1" | "h4" | "h8" | "h12" | "D1" | "W1" | "M1" | "M3" | "M6" | "Y1" | 'forever';
type MovingAverage =
  | "simple"
  | "exponential"
  | "weighted"
  | "smoothed"
  | "linearRegression";
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
type WsMethod = "subscribe" | "unsubscribe" | "create" | "update" | "delete";
type Theme = "light" | "dark" | "astrolab" | "radyal";
interface ThemeConfig {
  name: Theme;
  titleFont: string;
  bodyFont: string;
  monoFont: string;
  primary: string;
  secondary: string;
  success: string;
  failure: string;
  warning: string;
  info: string;
  dark: { [depth: number|string]: string };
  fg0: string;
  fg1: string;
  fg2: string;
  fg3: string;
  bg0: string;
  bg1: string;
  bg2: string;
  bg3: string;
}
type Currency = "usd" | "eur" | "eth" | "btc";
type Locale = "en" | "es" | "fr" | "de" | "it" | "ja" | "ko" | "pt" | "ru" | "zh";
type PrimitiveType = 'string' | 'number' | 'boolean' | 'null' | 'array' | 'any' | 'array<string>' | 'array<number>' | 'array<boolean>' | 'array<any>';
type Schema = PrimitiveType | { [key: string]: Schema } | Schema[];
type ValidationOption = { allowPartial?: boolean, allowExtend?: boolean };
type EligibilityCriteria = EligibilityCriterion[];
interface GeneralEligibility {
  aliases: { [xtoken: string]: string }; // Mapping of token identifiers (eg. eth:weth) to addresses
  messaging: EligibilityCriteria; // Eligibility criteria for messaging
  proposing: EligibilityCriteria; // Eligibility criteria for posting
  voting: EligibilityCriteria; // Eligibility criteria for voting
}

interface EligibilityCriterion {
  xtoken: string; // Token identifier
  min_balance: number; // Minimum token balance
  min_duration: number | Interval; // Minimum duration in days
  balance_multiplier: number; // Balance factor
  duration_multiplier: number; // Duration factor
}

interface ModRule {
  after: number; // Number of messages before action
  duration: number | Interval; // Duration of action in seconds
}

interface Config {
  server: {
    port: number; // Port to run the server on
    host: string; // Hostname to bind to
    jwt_session_salt: string; // Salt for JWT session tokens
    jwt_refresh_salt: string; // Salt for JWT refresh tokens
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
    proposal_cooldown: number | Interval; // Minimum seconds between posts/topic creation
    daily_proposal_limit: number; // Maximum posts/topic creation per day
    message_cooldown: number | Interval; // Number of seconds between messages
    daily_message_limit: number; // Maximum number of messages per day
    edit_timeout: number | Interval; // Number of seconds to allow editing of messages
  };
  governance: {
    // Governance configuration
    governors: string[]; // Array of governor addresses
    eligibility: GeneralEligibility; // Eligibility criteria for governance
  };
}

interface Authored {
  id: string;
  author: string; // EVM address
  createdAt: number; // Timestamp
  updatedAt: number; // Timestamp
}

interface Message extends Authored {
  topicId: string;
  content: string;
  upvotes: string[]; // EVM addresses
  downvotes: string[]; // EVM addresses
}

interface Topic extends Message {
  title: string;
  messageIds: string[];
  proposalId?: string; // If a proposal is attached
}

interface Snapshot {
  id: string;
  airDropId: string;
  proposalId: string;
  timestamp: number;
  blockNumbers: { [xtoken: string]: number };
  balances: { [address: string]: { [xtoken: string]: number } };
  usdBalances: { [address: string]: { [xtoken: string]: number } };
  totalSupply: { [xtoken: string]: bigint };
  usdTotalSupply: { [xtoken: string]: number }; // == market cap
}

interface SnapshotConfig {
  interval: number;
  randomize: boolean;
  weightFunction: MovingAverage;
  startDate: number;
  endDate: number;
  xtokens: string[];
}

interface Snaphshoted {
  id: string;
  topicId: string;
  title: string;
  description: string;
  startDate: number;
  endDate: number;
  snapshotConfig: SnapshotConfig;
  eligibility: EligibilityCriteria;
  snapshotIds: string[];
  status: Status; // if pending, can be accepted or rejected by governors
}

interface AirDrop extends Snaphshoted {}

interface VoteResult {
  count: number;
  totalWeight: number;
  participation: number; // count (in $ or token count) / total eligible market caps
  countByChoice: { [choice: string]: number };
  weightByChoice: { [choice: string]: number };
  outcome: "pending" | "passed" | "failed"; // failed if proposal is canceled or closed and participation < quorum
  choice: string; // choice with highest weight (winner)
}

interface Proposal extends Authored, Snaphshoted {
  votingPowerScheme: string; // "affine", "linear", etc.
  choices: number[]; // eg. 0: for, 1: against, 2: abstain, 0: choice A, 1: choice B, etc.
  labels: string[]; // eg. "for", "against", "abstain", "choice A", "choice B", etc.
  voteIds: string[];
  result: VoteResult;
  quorum: number; // minimum percentage of total vote count required (% of eligible tokens, not weighted voting power)
}

interface Vote {
  id: string;
  proposalId: string;
  address: string; // user address
  balances: { [xtoken: string]: bigint };
  value: number;
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

interface UserModeration {
  // spamCount is separate from moderation actions (retrieve with getUserSpamCount())
  muted: { since: number; until: number; by: string; count: number};
  banned: { since: number; until: number; by: string; count: number }
}

interface UserSettings {
  theme: Theme;
  locale: Locale;
  currency: Currency;
  notifications: {
    reputation: boolean,
    proposals: boolean,
    messages: boolean,
    replies: boolean,
    topics: boolean,
    votes: boolean,
  };
  sessionRefresh: boolean; // jwt autorefresh
}

interface User extends JwtPayload {
  ens: string;
  name: string; // display name/alias
  picture: string;
  title: string;
  joined: number; // Timestamp
  topicIds: string[]; // Topic IDs
  proposalIds: string[]; // Proposal IDs
  voteIds: string[]; // Vote IDs
  badges: string[];
  reputation: number;
  moderation: UserModeration;
  settings: UserSettings;
  balances?: { [xtoken: string]: number };
}

interface Network {
  name: string;
  slug: string;
  id: number;
  icon?: string;
  httpRpcs: string[];
  explorers: string[];
}

export {
  Schema,
  Resource,
  ValidationOption,
  Locale,
  Currency,
  Theme,
  ThemeConfig,
  MovingAverage,
  WsMethod,
  Interval,
  Authored,
  Role,
  Status,
  VotingPowerScheme,
  ModRule,
  ModAction,
  VoteResult,
  EligibilityCriterion,
  EligibilityCriteria,
  GeneralEligibility,
  Config,
  Message,
  Proposal,
  Topic,
  JwtPayload,
  UserSettings,
  UserModeration,
  User,
  Network,
  Vote,
  Snapshot,
  SnapshotConfig,
  AirDrop,
};
