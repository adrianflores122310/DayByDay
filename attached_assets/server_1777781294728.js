// ============================================================
// AI Language Practice App — server.js
// Single file. Runs on Replit out of the box.
// ============================================================

const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
app.use(express.json());

// Anthropic client — reads ANTHROPIC_API_KEY from environment
const client = new Anthropic();

// ── System prompt: friendly language tutor ──────────────────
const SYSTEM_PROMPT = `You are Luna, a friendly and encouraging language practice companion.

Your job:
- Have natural conversations to help the user practice a language
- Gently correct grammar mistakes using this format:
  "Small tip: instead of '...' you can say '...' — sounds more natural!"
- Only correct 1 mistake per reply (don't overwhelm them)
- Always respond in the language the user is trying to practice
- Keep replies short and conversational (2–4 sentences)
- End every reply with a follow-up question to keep conversation going
- Celebrate effort and progress

If the user hasn't specified a language, ask them which language they want to practice.`;

// ── In-memory conversation history ─────────────────────────
// Simple array — resets when server restarts (fine for MVP)
let history = [];

// ── API: send a chat message ────────────────────────────────
app.post("/chat", async (req, res) => {
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  // Add user message to history
  history.push({ role: "user", content: message });

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: history.slice(-20), // keep last 20 messages for context
    });

    const reply = response.content[0].text;

    // Add assistant reply to history
    history.push({ role: "assistant", content: reply });

    res.json({ reply });
  } catch (err) {
    console.error("Anthropic API error:", err.message);
    res.status(500).json({
      error: err.message.includes("API key")
        ? "Invalid API key. Add ANTHROPIC_API_KEY to Replit Secrets."
        : "Something went wrong. Check the console.",
    });
  }
});

// ── API: clear conversation history ────────────────────────
app.post("/clear", (req, res) => {
  history = [];
  res.json({ ok: true });
});

// ── Serve the HTML frontend (inline) ───────────────────────
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Luna — Language Practice</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #0f1117;
      color: #e8eaf0;
      height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    /* ── Header ── */
    header {
      width: 100%;
      max-width: 700px;
      padding: 18px 20px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255,255,255,0.07);
    }

    .brand { display: flex; align-items: center; gap: 10px; }
    .brand-icon { font-size: 26px; }
    .brand-name {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.03em;
      color: #f5a623;
    }
    .brand-sub { font-size: 12px; color: #555f72; margin-top: 1px; }

    .clear-btn {
      background: transparent;
      border: 1px solid rgba(255,255,255,0.1);
      color: #666;
      border-radius: 8px;
      padding: 5px 12px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .clear-btn:hover { border-color: #666; color: #aaa; }

    /* ── Chat area ── */
    #chat {
      flex: 1;
      width: 100%;
      max-width: 700px;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      scroll-behavior: smooth;
    }

    /* Scrollbar */
    #chat::-webkit-scrollbar { width: 4px; }
    #chat::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 99px; }

    .msg {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      animation: fadeUp 0.2s ease;
    }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .msg.user { flex-direction: row-reverse; }

    .avatar {
      width: 32px; height: 32px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 15px;
      flex-shrink: 0;
      background: rgba(245,166,35,0.12);
      border: 1px solid rgba(245,166,35,0.2);
    }

    .msg.user .avatar {
      background: rgba(255,255,255,0.05);
      border-color: rgba(255,255,255,0.08);
    }

    .bubble {
      max-width: 75%;
      background: #1c2030;
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 4px 14px 14px 14px;
      padding: 11px 15px;
      font-size: 14.5px;
      line-height: 1.65;
      color: #dde1ec;
    }

    .msg.user .bubble {
      background: #f5a623;
      border-color: #f5a623;
      color: #1a0e00;
      border-radius: 14px 4px 14px 14px;
      font-weight: 500;
    }

    /* Typing dots */
    .typing .bubble {
      display: flex; gap: 5px; align-items: center;
      padding: 14px 16px;
    }
    .dot {
      width: 6px; height: 6px;
      background: #555f72;
      border-radius: 50%;
      animation: bounce 1.2s ease infinite;
    }
    .dot:nth-child(2) { animation-delay: 0.2s; }
    .dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-6px); }
    }

    /* Error bubble */
    .error-bubble {
      background: rgba(248,113,113,0.1);
      border-color: rgba(248,113,113,0.25);
      color: #f87171;
    }

    /* ── Input bar ── */
    footer {
      width: 100%;
      max-width: 700px;
      padding: 14px 20px 20px;
      border-top: 1px solid rgba(255,255,255,0.07);
    }

    .input-row {
      display: flex;
      gap: 10px;
      background: #1c2030;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 14px;
      padding: 10px 10px 10px 16px;
      transition: border-color 0.2s;
    }
    .input-row:focus-within {
      border-color: rgba(245,166,35,0.5);
      box-shadow: 0 0 0 3px rgba(245,166,35,0.08);
    }

    #input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: #e8eaf0;
      font-size: 14.5px;
      font-family: inherit;
      resize: none;
      max-height: 110px;
      line-height: 1.5;
    }
    #input::placeholder { color: #3d4456; }

    #send {
      background: #f5a623;
      color: #1a0e00;
      border: none;
      border-radius: 10px;
      padding: 8px 18px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      align-self: flex-end;
      transition: background 0.15s, transform 0.1s;
      flex-shrink: 0;
    }
    #send:hover { background: #e8941a; }
    #send:active { transform: scale(0.96); }
    #send:disabled { opacity: 0.45; cursor: not-allowed; }

    .hint {
      font-size: 11px;
      color: #3d4456;
      margin-top: 8px;
      padding: 0 4px;
    }
  </style>
</head>
<body>

<header>
  <div class="brand">
    <div class="brand-icon">🌍</div>
    <div>
      <div class="brand-name">Luna</div>
      <div class="brand-sub">Language Practice</div>
    </div>
  </div>
  <button class="clear-btn" onclick="clearChat()">↺ New chat</button>
</header>

<div id="chat">
  <!-- Welcome message -->
  <div class="msg">
    <div class="avatar">🌍</div>
    <div class="bubble">
      Hey! I'm Luna, your language practice companion 👋<br><br>
      Which language would you like to practice today — English, Spanish, Portuguese, or another?
    </div>
  </div>
</div>

<footer>
  <div class="input-row">
    <textarea
      id="input"
      rows="1"
      placeholder="Type your message..."
      onkeydown="handleKey(event)"
      oninput="autoResize(this)"
    ></textarea>
    <button id="send" onclick="sendMessage()">Send</button>
  </div>
  <div class="hint">Enter to send &nbsp;·&nbsp; Shift+Enter for new line</div>
</footer>

<script>
  const chat = document.getElementById("chat");
  const input = document.getElementById("input");
  const sendBtn = document.getElementById("send");

  function autoResize(el) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 110) + "px";
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function scrollToBottom() {
    chat.scrollTop = chat.scrollHeight;
  }

  function addMessage(role, text, isError = false) {
    const div = document.createElement("div");
    div.className = "msg" + (role === "user" ? " user" : "");
    div.innerHTML =
      '<div class="avatar">' + (role === "user" ? "👤" : "🌍") + "</div>" +
      '<div class="bubble' + (isError ? " error-bubble" : "") + '">' +
      text.replace(/\\n/g, "<br>") +
      "</div>";
    chat.appendChild(div);
    scrollToBottom();
    return div;
  }

  function showTyping() {
    const div = document.createElement("div");
    div.className = "msg typing";
    div.id = "typing";
    div.innerHTML =
      '<div class="avatar">🌍</div>' +
      '<div class="bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>';
    chat.appendChild(div);
    scrollToBottom();
  }

  function hideTyping() {
    const el = document.getElementById("typing");
    if (el) el.remove();
  }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    addMessage("user", text);
    input.value = "";
    input.style.height = "auto";
    sendBtn.disabled = true;
    showTyping();

    try {
      const res = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();
      hideTyping();

      if (!res.ok) {
        addMessage("assistant", "⚠️ " + (data.error || "Something went wrong."), true);
      } else {
        addMessage("assistant", data.reply);
      }
    } catch (err) {
      hideTyping();
      addMessage("assistant", "⚠️ Network error — is the server running?", true);
    }

    sendBtn.disabled = false;
    input.focus();
  }

  async function clearChat() {
    await fetch("/clear", { method: "POST" });
    // Remove all messages except welcome
    const msgs = chat.querySelectorAll(".msg");
    msgs.forEach((m, i) => { if (i > 0) m.remove(); });
  }

  input.focus();
</script>

</body>
</html>`);
});

// ── Start server ────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🌍 Luna is running → http://localhost:${PORT}`);
  console.log(
    process.env.ANTHROPIC_API_KEY
      ? "✅ ANTHROPIC_API_KEY found"
      : "⚠️  ANTHROPIC_API_KEY not set — add it to Replit Secrets"
  );
});
