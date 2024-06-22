import { Ref } from "vue";
import { useWeb3Modal, useWeb3ModalAccount } from "@web3modal/ethers/vue";

import { Message, Proposal, Topic, User, Vote } from "../../common/models";
import { YAP_ENDPOINT } from "../../common/constants";
import { Blocky } from "../../common/rendering";
import state from "./state";

async function authFetch(url: string, options: RequestInit={}): Promise<Response> {
  const headers = {
    ...(options.headers ?? {}),
    ...(state.jwt.value && { Authorization: `Bearer ${state.jwt.value}` }),
    'Content-Type': 'application/json',
  };

  const res = await fetch(url, { ...options, headers });
  const newJwt = res.headers.get('Authorization')?.split('Bearer ')[1];

  if (newJwt) {
    state.setJwt(newJwt);
  }

  return res;
}

async function login(): Promise<User|null> {

  if (state.jwt.value) {
    // try to login with jwt only
    const { user } = await authFetch(`${YAP_ENDPOINT}/login`, { method: 'POST' })
      .then((res) => res.json());
    if (user) {
      state.setUser(user);
      return user;
    }
  }
  // fallback to web3modal
  const { address, isConnected } = useWeb3ModalAccount();
  if (!isConnected.value) {
    await useWeb3Modal().open({ view: 'Connect' });
  }

  let user: Partial<User> = state.get("user", address.value!);
  if (!user) {
    user = (await authFetch(`${YAP_ENDPOINT}/user/${address.value}`).then((res) => res.json())).user;
    if (!user) {
      // throw new Error(`Failed to fetch user ${o.address}`);
      user = {
        address: address.value,
        settings: state.loadSettings(),
        blocky: new Blocky({ seed: address.value!, scale: 32, size: 7 }).getDataUrl()
      };
    }
  }

  try {
    const message = `Login to our dApp: ${new Date().toISOString()}`;
    const signature = await state.getSigner().then(s => s.signMessage(message));
    const res = await authFetch(`${YAP_ENDPOINT}/login`, {
      method: 'POST',
      body: JSON.stringify({ signature, message, user }),
    }).then(r => r.json());

    if (!res.user) {
      throw new Error(`Failed to login user ${address.value}`);
    }
    console.log(`Logged in as ${res.user.name} (${res.user.address})`);
    state.setUser(res.user);
    return res.user;
  } catch (error) {
    console.error('Login failed', error) // broken flow, eg. signature rejected by user or mismatch
    return null;
  }
}

async function updateUser(): Promise<User> {
  const { address } = useWeb3ModalAccount();
  if (address.value !== state.user.value.address) { // state.get("user", address.value!)
    throw new Error("Web3modal user address does not match state.user.address, no update allowed.");
  }
  const { user } = await authFetch(`${YAP_ENDPOINT}/user/${address.value}`, {
    method: "PUT",
    body: JSON.stringify(state.user.value),
  }).then((res) => res.json());
  state.upsert("user", user);
  return user;
}

async function getMessages(o: { topicId?: string, userId?: string }): Promise<Ref<Message>[]> {
  if (!o.topicId && !o.userId) {
    throw new Error("Please provide a valid topicId or userId.");
  }
  let ids: string[] = [];
  if (o.topicId) {
    let topic = state.get("topic", o.topicId);
    if (!topic) {
      topic = (await authFetch(`${YAP_ENDPOINT}/topic/${o.topicId}`).then((res) => res.json())).topic;
      if (!topic) {
        throw new Error(`Failed to fetch topic ${o.topicId}`);
      }
      state.upsert("topic", topic);
    }
    ids = topic.messageIds;
    if (ids.map((id: string) => state.get("message", id)).some((m: Ref<Message>) => !m)) {
      const { messages } = await authFetch(`${YAP_ENDPOINT}/messages/*?topicId=${o.topicId}`).then((res) => res.json());
      state.upsertAll("message", messages);
    }
  } else {
    let user = state.get("user", o.userId!);
    if (!user) {
      user = await authFetch(`${YAP_ENDPOINT}/user/${o.userId}`);
      if (!user) {
        throw new Error(`Failed to fetch user ${o.userId}`);
      }
      state.upsert("user", user);
    }
    ids = user.messageIds;
    if (ids.map((id: string) => state.get("message", id)).some((m: Ref<Message>) => !m)) {
      const data = await authFetch(`${YAP_ENDPOINT}/messages/*?userId=${o.userId}`).then((res) => res.json());
      state.upsertAll("message", data);
    }
  }
  return state.getAll("message");
}

async function getVotes(o: { proposalId?: string, userId?: string }): Promise<Ref<Vote>[]> {
  if (!o.proposalId && !o.userId) {
    throw new Error("Please provide a valid topicId or userId.");
  }
  if (o.proposalId) {
    let proposal = state.get("proposal", o.proposalId);
    if (!proposal) {
      proposal = (await authFetch(`${YAP_ENDPOINT}/proposal/${o.proposalId}`).then((res) => res.json())).proposal;
      if (!proposal) {
        throw new Error(`Failed to fetch proposal ${o.proposalId}`);
      }
      state.upsert("proposal", proposal);
    }

    if (proposal.voteIds.map((id: string) => state.get("vote", id)).some((v: Ref<Vote>) => !v)) {
      const { votes } = await authFetch(`${YAP_ENDPOINT}/votes/*?proposalId=${o.proposalId}`).then((res) => res.json());
      state.upsertAll("vote", votes);
    }
  } else {
    let user = state.get("user", o.userId!) as User;
    if (!user) {
      user = (await fetch(`${YAP_ENDPOINT}/user/${o.userId}`).then((res) => res.json())).user;
      if (!user) {
        throw new Error(`Failed to fetch user ${o.userId}`);
      }
      state.upsert("user", user);
    }

    if (user.voteIds.map((id) => state.get("vote", id)).some((v: Ref<Vote>) => !v)) {
      const { votes } = (await authFetch(`${YAP_ENDPOINT}/votes/*?userId=${o.userId}`).then((res) => res.json())).votes;
      state.upsertAll("vote", votes);
    }
  }
  return state.getAll("vote");
}

async function getTopics(): Promise<Ref<Topic>[]> {
  let topics = state.getAll("topic");
  if (!topics) {
    const { topics } = await authFetch(`${YAP_ENDPOINT}/topic/*`).then((res) => res.json());
    state.upsertAll("topic", topics);
  }
  return state.getAll("topic");
}

async function getProposals(): Promise<Ref<Proposal>[]> {
  let proposals = state.getAll("proposal");
  if (!proposals) {
    proposals = (await authFetch(`${YAP_ENDPOINT}/proposal/*`).then((res) => res.json())).proposals;
    state.upsertAll("proposal", proposals);
  }
  return state.getAll("proposal");
}

export { getMessages, getVotes, getTopics, getProposals, updateUser, login };
