import { UserSettings } from "./models";

const ASTROLAB_CDN = "https://cdn.astrolab.fi"
const YAP_ENDPOINT = "http://127.0.0.1:40042" // "https://api.yap.astrolab.fi"
const DEFAULT_ABI = ["function balanceOf(address) view returns (uint)"];
const NATIVE_ALIAS = "0x0000000000000000000000000000000000000001";
const W3M_PROJECTID = "2f0ff1893bae6d2f220397f005075a1f";
const DEFAULT_USER_SETTINGS: UserSettings = {
  theme: "dark",
  locale: "en",
  currency: "usd",
  notifications: {
    reputation: true,
    proposals: true,
    messages: false, // any DAO message
    replies: true,
    topics: false, // any DAO topic
    votes: true, // any DAO vote
  },
  sessionRefresh: true,
};

export { ASTROLAB_CDN, YAP_ENDPOINT, DEFAULT_ABI, NATIVE_ALIAS, W3M_PROJECTID, DEFAULT_USER_SETTINGS };
