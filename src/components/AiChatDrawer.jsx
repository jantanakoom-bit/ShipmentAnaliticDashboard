import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { sendAiChatMessage } from "../lib/aiChat";

const MAX_VISIBLE_MESSAGES = 12;
const MAX_INPUT_LENGTH = 4000;
const CONVERSATION_STORAGE_KEY = "aiChatConversationId";
const MarkdownMessage = lazy(() => import("./MarkdownMessage"));

const WELCOME_MESSAGE = {
  role: "assistant",
  content: "Ask about TEU, carriers, shippers, routes, status, or the current dashboard filters.",
};

export default function AiChatDrawer({ filters, pageContext }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dataUsed, setDataUsed] = useState(null);
  const [conversationId, setConversationId] = useState(() => {
    try {
      return localStorage.getItem(CONVERSATION_STORAGE_KEY) || null;
    } catch {
      return null;
    }
  });
  const messagesRef = useRef(null);

  useEffect(() => {
    try {
      if (conversationId) {
        localStorage.setItem(CONVERSATION_STORAGE_KEY, conversationId);
      } else {
        localStorage.removeItem(CONVERSATION_STORAGE_KEY);
      }
    } catch {
      // localStorage unavailable — no-op
    }
  }, [conversationId]);

  const remainingChars = MAX_INPUT_LENGTH - input.length;
  const canSubmit = input.trim().length > 0 && input.length <= MAX_INPUT_LENGTH && !loading;
  const visibleMessages = useMemo(() => messages.slice(-MAX_VISIBLE_MESSAGES), [messages]);
  const lastVisibleMessage = visibleMessages.at(-1)?.content || "";

  useEffect(() => {
    if (!open || !messagesRef.current) {
      return;
    }

    const messageLog = messagesRef.current;
    const scrollOptions = { top: messageLog.scrollHeight, behavior: "smooth" };
    if (typeof messageLog.scrollTo === "function") {
      messageLog.scrollTo(scrollOptions);
      return;
    }
    messageLog.scrollTop = messageLog.scrollHeight;
  }, [lastVisibleMessage, loading, open]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    const userMessage = { role: "user", content: input.trim() };
    const nextMessages = [...messages, userMessage].slice(-MAX_VISIBLE_MESSAGES);
    setMessages(nextMessages);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const response = await sendAiChatMessage({
        messages: nextMessages.filter((message) => message.role === "user" || message.role === "assistant"),
        filters,
        pageContext,
        conversationId,
      });
      setMessages((current) => [...current, { role: "assistant", content: response.answer }].slice(-MAX_VISIBLE_MESSAGES));
      setDataUsed(response.dataUsed || null);
      if (response.conversationId) {
        setConversationId(response.conversationId);
      }
    } catch (submitError) {
      setError(submitError.message || "Unable to generate AI response");
    } finally {
      setLoading(false);
    }
  }

  function handleNewChat() {
    setConversationId(null);
    setMessages([WELCOME_MESSAGE]);
    setDataUsed(null);
    setError("");
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <>
      <button
        type="button"
        className="ai-chat-launcher"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="ai-chat-drawer"
      >
        AI
      </button>

      {open ? (
        <aside id="ai-chat-drawer" className="ai-chat-drawer" aria-label="AI shipment assistant">
          <div className="ai-chat-head">
            <div>
              <div className="ai-chat-title">AI Assistant</div>
              <div className="ai-chat-sub">Shipment analytics</div>
            </div>
            <div className="ai-chat-head-actions">
              <button type="button" className="ai-chat-new" onClick={handleNewChat} aria-label="Start new conversation">
                + New
              </button>
              <button type="button" className="ai-chat-close" onClick={() => setOpen(false)} aria-label="Close AI assistant">
                x
              </button>
            </div>
          </div>

          <div ref={messagesRef} className="ai-chat-messages" role="log" aria-live="polite">
            {visibleMessages.map((message, index) => (
              <div key={`${message.role}-${index}-${message.content.slice(0, 20)}`} className={`ai-chat-message ${message.role}`}>
                {message.role === "assistant" ? (
                  <Suspense fallback={message.content}>
                    <MarkdownMessage content={message.content} />
                  </Suspense>
                ) : message.content}
              </div>
            ))}
            {loading ? <div className="ai-chat-message assistant">Analyzing shipment data...</div> : null}
          </div>

          {dataUsed ? (
            <div className="ai-chat-data-used">
              Data used: {(dataUsed.tools || []).join(", ") || "dashboard context"}
              {Number.isFinite(dataUsed.rowsMatched) ? ` · ${dataUsed.rowsMatched} rows` : ""}
              {dataUsed.rowLimitApplied ? " · row limit applied" : ""}
            </div>
          ) : null}

          {error ? <div className="ai-chat-error">{error}</div> : null}

          <form className="ai-chat-form" onSubmit={handleSubmit}>
            <div className="ai-chat-composer">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about selected shipment data..."
                maxLength={MAX_INPUT_LENGTH + 1}
                rows={3}
              />
              <div className="ai-chat-composer-actions">
                <span className={remainingChars < 0 ? "ai-chat-count over" : "ai-chat-count"}>
                  {remainingChars} chars
                </span>
                <button type="submit" disabled={!canSubmit}>
                  Send
                </button>
              </div>
            </div>
          </form>
        </aside>
      ) : null}
    </>
  );
}
