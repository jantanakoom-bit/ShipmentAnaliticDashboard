import { lazy, Suspense, useMemo, useState } from "react";
import { sendAiChatMessage } from "../lib/aiChat";

const MAX_VISIBLE_MESSAGES = 12;
const MAX_INPUT_LENGTH = 4000;
const MarkdownMessage = lazy(() => import("./MarkdownMessage"));

export default function AiChatDrawer({ filters, pageContext }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Ask about TEU, carriers, shippers, routes, status, or the current dashboard filters.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dataUsed, setDataUsed] = useState(null);

  const remainingChars = MAX_INPUT_LENGTH - input.length;
  const canSubmit = input.trim().length > 0 && input.length <= MAX_INPUT_LENGTH && !loading;
  const visibleMessages = useMemo(() => messages.slice(-MAX_VISIBLE_MESSAGES), [messages]);

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
      });
      setMessages((current) => [...current, { role: "assistant", content: response.answer }].slice(-MAX_VISIBLE_MESSAGES));
      setDataUsed(response.dataUsed || null);
    } catch (submitError) {
      setError(submitError.message || "Unable to generate AI response");
    } finally {
      setLoading(false);
    }
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
            <button type="button" className="ai-chat-close" onClick={() => setOpen(false)} aria-label="Close AI assistant">
              x
            </button>
          </div>

          <div className="ai-chat-messages" role="log" aria-live="polite">
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
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about selected shipment data..."
              maxLength={MAX_INPUT_LENGTH + 1}
              rows={3}
            />
            <div className="ai-chat-form-row">
              <span className={remainingChars < 0 ? "ai-chat-count over" : "ai-chat-count"}>
                {remainingChars} chars
              </span>
              <button type="submit" disabled={!canSubmit}>
                Send
              </button>
            </div>
          </form>
        </aside>
      ) : null}
    </>
  );
}
