import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { API_URL } from "../lib/api";

export default function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { from: "bot", text: "Hi! I can answer questions about JKUAT partnerships — how to start an MoU, the approval process, templates, reporting and renewals. What would you like to know?" }
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, open]);

  async function ask(event) {
    event.preventDefault();
    const question = input.trim();
    if (!question || busy) return;
    setMessages((m) => [...m, { from: "user", text: question }]);
    setInput("");
    setBusy(true);
    try {
      const response = await fetch(`${API_URL}/chatbot/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question })
      });
      const data = await response.json();
      setMessages((m) => [...m, { from: "bot", text: data.answer, related: data.related || [] }]);
    } catch {
      setMessages((m) => [...m, { from: "bot", text: "Sorry, I could not reach the assistant. Please try again or email linkages@jkuat.ac.ke." }]);
    } finally {
      setBusy(false);
    }
  }

  function askRelated(question) {
    setInput(question);
  }

  return (
    <div className="chatbot-root">
      {open && (
        <div className="chatbot-panel">
          <div className="chatbot-head">
            <div><strong>Linkages assistant</strong><span>Process guidance only — not legal advice</span></div>
            <button className="icon-button" onClick={() => setOpen(false)} aria-label="Close assistant"><X size={17} /></button>
          </div>
          <div className="chatbot-messages">
            {messages.map((msg, index) => (
              <div key={index} className={`chat-msg chat-${msg.from}`}>
                <p>{msg.text}</p>
                {msg.related?.length > 0 && (
                  <div className="chat-related">{msg.related.map((q) => <button key={q} type="button" onClick={() => askRelated(q)}>{q}</button>)}</div>
                )}
              </div>
            ))}
            {busy && <div className="chat-msg chat-bot"><p>Thinking…</p></div>}
            <div ref={endRef} />
          </div>
          <form className="chatbot-input" onSubmit={ask}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about partnerships…" />
            <button className="primary-button" disabled={busy || !input.trim()} aria-label="Send"><Send size={16} /></button>
          </form>
        </div>
      )}
      <button className="chatbot-fab" onClick={() => setOpen((v) => !v)} aria-label="Open partnership assistant">
        <MessageCircle size={22} /> {open ? "" : "Ask about partnerships"}
      </button>
    </div>
  );
}
