import { YAP_ENDPOINT } from "../../common/constants";
import { Message, User, Vote } from "../../common/models";
import state from "./state";

async function getMessages(o: { topicId?: string, userId?: string }): Promise<Message[]> {
  if (!o.topicId && !o.userId) {
    throw new Error("Please provide a valid topicId or userId.");
  }
  let messages: Message[] = [];
  if (o.topicId) {
    let topic = state.get("topic", o.topicId);
    if (!topic) {
      topic = await fetch(`${YAP_ENDPOINT}/topic/${o.topicId}`);
      if (!topic) {
        throw new Error(`Failed to fetch topic ${o.topicId}`);
      }
      state.upsert("topic", topic);
    }

    const ids = topic.messageIds;
    messages = ids.map((id) => state.get("message", id));
    if (messages.some((m) => !m)) {
      messages = await fetch(`${YAP_ENDPOINT}/messages/*?topicId=${o.topicId}`).then((res) => res.json());
      for (const m of messages) {
        state.upsert("message", m);
      }
    }
  } else {
    let user = state.get("user", o.userId);
    if (!user) {
      user = await fetch(`${YAP_ENDPOINT}/user/${o.userId}`);
      if (!user) {
        throw new Error(`Failed to fetch user ${o.userId}`);
      }
      state.upsert("user", user);
    }

  }
  return messages;
}


async function getVotes(o: { proposalId?: string, userId?: string }): Promise<Vote[]> {
  if (!o.proposalId && !o.userId) {
    throw new Error("Please provide a valid topicId or userId.");
  }
  let votes: Vote[] = [];
  if (o.proposalId) {
    let proposal = state.get("proposal", o.proposalId);
    if (!proposal) {
      proposal = await fetch(`${YAP_ENDPOINT}/proposal/${o.proposalId}`);
      if (!proposal) {
        throw new Error(`Failed to fetch proposal ${o.proposalId}`);
      }
      state.upsert("proposal", proposal);
    }

    const ids = proposal.voteIds;
    votes = ids.map((id) => state.get("vote", id));
    if (votes.some((v) => !v)) {
      votes = await fetch(`${YAP_ENDPOINT}/votes/*?proposalId=${o.proposalId}`).then((res) => res.json());
      for (const v of votes) {
        state.upsert("vote", v);
      }
    }
  } else {
    let user = state.get("user", o.userId) as User;
    if (!user) {
      user = await fetch(`${YAP_ENDPOINT}/user/${o.userId}`).then((res) => res.json());
      if (!user) {
        throw new Error(`Failed to fetch user ${o.userId}`);
      }
      state.upsert("user", user);
    }
    const ids = user.voteIds;
    votes = ids.map((id) => state.get("vote", id));
    if (votes.some((v) => !v)) {
      votes = await fetch(`${YAP_ENDPOINT}/votes/*?userId=${o.userId}`).then((res) => res.json());
      for (const v of votes) {
        state.upsert("vote", v);
      }
    }
  }
  return votes;
}

async function getTopics(): Promise<Topic[]> {
  let topics = state.getAll("topic");
  if (!topics) {
    topics = await fetch(`${YAP_ENDPOINT}/topic/*`).then((res) => res.json());
    state.upsertAll("topic", topics);
  }
  return topics;
}

async function getProposals(): Promise<Proposal[]> {
  let proposals = state.getAll("proposal");
  if (!proposals) {
    proposals = await fetch(`${YAP_ENDPOINT}/proposal/*`).then((res) => res.json());
    state.upsertAll("proposal", proposals);
  }
  return proposals;
}

export { getMessages, getVotes, getTopics, getProposals };
