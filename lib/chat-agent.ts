// Chat runs stay on the worker version they started on, so an open chat keeps
// answering with old agent code after a deploy. The client sends this with
// every turn; a run built with a lower number hands the chat to the latest
// version before replying. Bump it whenever the agent's behavior must reach
// open chats, like a change to how usage is metered or limited.
export const CHAT_AGENT_VERSION = 16
