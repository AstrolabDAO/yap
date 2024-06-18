import { Message, Proposal, User } from "../../common/models";
import { getMessage, pushMessage, pushProposal } from "./io";
import { canMessage, canPostProposal } from "./security";

async function postProposal(p: Proposal, user: User): Promise<string> {

  if (!p.title || !p.description || !p.author || !p.startDate || !p.endDate) {
    throw new Error("Invalid proposal data. Missing required fields.");
  }

  if (!await canPostProposal(user)) {
    throw new Error("User is not eligible to post proposals.");
  }

  p.id = crypto.randomUUID();
  await pushProposal(p);

  return p.id;
}

async function editProposal(p: Proposal, user: User): Promise<void> {
  if (!p.id || !p.title || !p.description || !p.author || !p.startDate || !p.endDate) {
    throw new Error("Invalid proposal data. Missing required fields.");
  }

  if (!await canPostProposal(user)) {
    throw new Error("User is not eligible to post proposals.");
  }

  await pushProposal(p);
}

async function postMessage(user: User, topicId: string, content: string) {
  if (!content) {
    throw new Error("Message content cannot be empty.");
  }

  if (!await canMessage(user, topicId)) {
    throw new Error("User is not eligible to post messages.");
  }

  const m: Message = {
    id: crypto.randomUUID(),
    topicId,
    author: user.address,
    content,
    upvotes: [],
    downvotes: []
  }
  await pushMessage(topicId, user.address, m);
}

async function editMessage(user: User, messageId: string, content: string) {
  if (!content || !messageId) {
    throw new Error("Message id and content cannot be empty.");
  }

  const m = await getMessage(messageId);

  if (user.address != m.messageId) {
    throw new Error("Not author of the message.");
  }
  m.content = content;
  await pushMessage(m.topicId, user.address, m);
}


export { postProposal, postMessage, editProposal, editMessage };
