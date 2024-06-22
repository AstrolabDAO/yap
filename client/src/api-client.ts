import { Ref } from "vue";
import { useWeb3Modal, useWeb3ModalAccount } from "@web3modal/ethers/vue";

import { YAP_ENDPOINT } from "../../common/constants";
import { Message, Proposal, Topic, User, Vote } from "../../common/models";
import state from "./state";
import { ethers } from "ethers";
import { Blocky } from "../../common/rendering";

async function login(o: { address: string }): Promise<User> {

  const { address, isConnected } = useWeb3ModalAccount();
  let user = state.get("user", o.address);
  if (!user) {
    user = await fetch(`${YAP_ENDPOINT}/user/${o.address}`).then((res) => res.json());
    if (!user) {
      // throw new Error(`Failed to fetch user ${o.address}`);
    }
    const blocky = new Blocky({ seed: address!, scale: 32, size: 7 });
    
    // state.upsert("user", user);
  }
  if (!isConnected.value) {
    await useWeb3Modal().open();
  }

  try {

    // Create a Web3Provider using ethers v6
    const provider = new ethers.BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()

    // Create a unique message to sign
    const message = `Login to our dApp: ${new Date().toISOString()}`

    // Request signature from user
    const signature = await signer.signMessage(message)

    // Send the signature and message to the backend
    const response = await axios.post('/login', { signature, message })
    
    // Handle the response
    if (response.data.user) {
      console.log('Logged in successfully', response.data.user)
      // Store the JWT token from the Authorization header
      const token = response.headers['authorization'].split(' ')[1]
      localStorage.setItem('jwt_token', token)
      // You might want to update your app's state here
    }
  } catch (error) {
    console.error('Login failed', error)
    // Handle errors (e.g., user rejected signature request)
  }
}

async function getMessages(o: { topicId?: string, userId?: string }): Promise<Ref<Message>[]> {
  if (!o.topicId && !o.userId) {
    throw new Error("Please provide a valid topicId or userId.");
  }
  let ids: string[] = [];
  if (o.topicId) {
    let topic = state.get("topic", o.topicId);
    if (!topic) {
      topic = await fetch(`${YAP_ENDPOINT}/topic/${o.topicId}`);
      if (!topic) {
        throw new Error(`Failed to fetch topic ${o.topicId}`);
      }
      state.upsert("topic", topic);
    }
    ids = topic.messageIds;
    if (ids.map((id: string) => state.get("message", id)).some((m: Ref<Message>) => !m)) {
      const data = await fetch(`${YAP_ENDPOINT}/messages/*?topicId=${o.topicId}`).then((res) => res.json());
      state.upsertAll("message", data);
    }
  } else {
    let user = state.get("user", o.userId!);
    if (!user) {
      user = await fetch(`${YAP_ENDPOINT}/user/${o.userId}`);
      if (!user) {
        throw new Error(`Failed to fetch user ${o.userId}`);
      }
      state.upsert("user", user);
    }
    ids = user.messageIds;
    if (ids.map((id: string) => state.get("message", id)).some((m: Ref<Message>) => !m)) {
      const data = await fetch(`${YAP_ENDPOINT}/messages/*?userId=${o.userId}`).then((res) => res.json());
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
      proposal = await fetch(`${YAP_ENDPOINT}/proposal/${o.proposalId}`);
      if (!proposal) {
        throw new Error(`Failed to fetch proposal ${o.proposalId}`);
      }
      state.upsert("proposal", proposal);
    }

    if (proposal.voteIds.map((id: string) => state.get("vote", id)).some((v: Ref<Vote>) => !v)) {
      const data = await fetch(`${YAP_ENDPOINT}/votes/*?proposalId=${o.proposalId}`).then((res) => res.json());
      state.upsertAll("vote", data);
    }
  } else {
    let user = state.get("user", o.userId!) as User;
    if (!user) {
      user = await fetch(`${YAP_ENDPOINT}/user/${o.userId}`).then((res) => res.json());
      if (!user) {
        throw new Error(`Failed to fetch user ${o.userId}`);
      }
      state.upsert("user", user);
    }

    if (user.voteIds.map((id) => state.get("vote", id)).some((v: Ref<Vote>) => !v)) {
      const data = await fetch(`${YAP_ENDPOINT}/votes/*?userId=${o.userId}`).then((res) => res.json());
      state.upsertAll("vote", data);
    }
  }
  return state.getAll("vote");
}

async function getTopics(): Promise<Ref<Topic>[]> {
  let topics = state.getAll("topic");
  if (!topics) {
    const data = await fetch(`${YAP_ENDPOINT}/topic/*`).then((res) => res.json());
    state.upsertAll("topic", data);
  }
  return state.getAll("topic");
}

async function getProposals(): Promise<Ref<Proposal>[]> {
  let proposals = state.getAll("proposal");
  if (!proposals) {
    proposals = await fetch(`${YAP_ENDPOINT}/proposal/*`).then((res) => res.json());
    state.upsertAll("proposal", proposals);
  }
  return state.getAll("proposal");
}

export { getMessages, getVotes, getTopics, getProposals };
