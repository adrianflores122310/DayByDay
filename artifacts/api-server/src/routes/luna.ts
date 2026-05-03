import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();
const client = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

function buildSystemPrompt(language: string): string {
  return `You are Luna, a friendly and encouraging language practice companion.

The user has chosen to practice: ${language}.

Your rules:
- ALWAYS respond exclusively in ${language} — never switch to another language, even if the user writes in a different one
- Have natural, warm conversations to help the user practice
- Gently correct grammar or vocabulary mistakes using this format:
  "Small tip: instead of '...' you can say '...' — sounds more natural!"
- Correct only 1 mistake per reply (don't overwhelm them)
- Keep replies short and conversational (2–4 sentences)
- End every reply with a follow-up question to keep the conversation going
- Be encouraging and celebrate effort and progress
- Adapt your tone and cultural references to feel natural in ${language}`;
}

const OPENING_MESSAGE: Record<string, string> = {
  English:
    "Hey, great choice! 👋 I'm Luna, and I'm here to help you practice English in a relaxed, pressure-free way.\n\nTell me — what's something you've been up to lately?",
  Spanish:
    "¡Hola! Qué buena elección 👋 Soy Luna, y estoy aquí para ayudarte a practicar español de forma natural y sin presión.\n\n¿Cuéntame, qué has estado haciendo últimamente?",
  Portuguese:
    "Olá! Que ótima escolha 👋 Sou a Luna, e estou aqui para te ajudar a praticar português de forma natural e sem pressão.\n\nMe conta — o que você tem feito ultimamente?",
};

let history: { role: "user" | "assistant"; content: string }[] = [];
let currentLanguage = "English";

router.post("/chat", async (req, res) => {
  const { message, language } = req.body as {
    message?: string;
    language?: string;
  };

  if (!message || !message.trim()) {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  if (language) currentLanguage = language;

  history.push({ role: "user", content: message });

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: buildSystemPrompt(currentLanguage),
      messages: history.slice(-20),
    });

    const reply = (response.content[0] as { text: string }).text;
    history.push({ role: "assistant", content: reply });

    res.json({ reply });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err }, "Anthropic API error");
    res.status(500).json({
      error: errMsg.includes("API key")
        ? "Invalid API key. Add ANTHROPIC_API_KEY to Replit Secrets."
        : "Something went wrong. Check the console.",
    });
  }
});

router.post("/clear", (_req, res) => {
  history = [];
  currentLanguage = "English";
  res.json({ ok: true });
});

router.get("/", (_req, res) => {
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
      overflow: hidden;
    }

    /* ── Welcome screen ── */
    #welcome {
      position: fixed;
      inset: 0;
      background: #0f1117;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0;
      z-index: 100;
      transition: opacity 0.45s ease, transform 0.45s ease;
    }
    #welcome.hiding {
      opacity: 0;
      transform: translateY(-18px);
      pointer-events: none;
    }

    .welcome-logo {
      font-size: 48px;
      margin-bottom: 22px;
      animation: floatIn 0.6s ease both;
    }
    .welcome-title {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.03em;
      color: #f0f2f8;
      text-align: center;
      animation: floatIn 0.65s 0.05s ease both;
    }
    .welcome-sub {
      font-size: 13.5px;
      color: #454e66;
      margin-top: 8px;
      margin-bottom: 42px;
      text-align: center;
      animation: floatIn 0.65s 0.1s ease both;
    }

    .lang-cards {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 100%;
      max-width: 340px;
      padding: 0 20px;
    }

    .lang-card {
      display: flex;
      align-items: center;
      gap: 16px;
      background: #151822;
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 16px;
      padding: 18px 22px;
      cursor: pointer;
      transition: background 0.18s, border-color 0.18s, transform 0.15s;
      animation: floatIn 0.6s ease both;
      user-select: none;
    }
    .lang-card:nth-child(1) { animation-delay: 0.15s; }
    .lang-card:nth-child(2) { animation-delay: 0.22s; }
    .lang-card:nth-child(3) { animation-delay: 0.29s; }

    .lang-card:hover {
      background: #1c2030;
      border-color: rgba(245,166,35,0.35);
      transform: translateY(-2px);
    }
    .lang-card:active { transform: translateY(0) scale(0.98); }

    .lang-flag { font-size: 28px; line-height: 1; }
    .lang-info { flex: 1; }
    .lang-name {
      font-size: 16px;
      font-weight: 600;
      color: #e8eaf0;
      letter-spacing: -0.01em;
    }
    .lang-native {
      font-size: 12px;
      color: #454e66;
      margin-top: 2px;
    }
    .lang-arrow {
      font-size: 16px;
      color: #2d3448;
      transition: color 0.18s, transform 0.18s;
    }
    .lang-card:hover .lang-arrow {
      color: #f5a623;
      transform: translateX(3px);
    }

    @keyframes floatIn {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── App shell (hidden until language chosen) ── */
    #app {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      height: 100dvh;
      opacity: 0;
      transition: opacity 0.4s ease;
      pointer-events: none;
    }
    #app.visible {
      opacity: 1;
      pointer-events: all;
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
      flex-shrink: 0;
    }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand-icon { font-size: 24px; }
    .brand-name {
      font-size: 17px;
      font-weight: 700;
      letter-spacing: -0.03em;
      color: #f5a623;
    }
    .brand-sub { font-size: 12px; color: #555f72; margin-top: 1px; }
    .header-right { display: flex; align-items: center; gap: 8px; }
    .lang-badge {
      font-size: 12px;
      color: #666;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 20px;
      padding: 3px 10px;
    }
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
    #chat::-webkit-scrollbar { width: 4px; }
    #chat::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 99px; }

    .msg {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      animation: fadeUp 0.22s ease;
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
      flex-shrink: 0;
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
    .hint { font-size: 11px; color: #3d4456; margin-top: 8px; padding: 0 4px; }
  </style>
</head>
<body>

<!-- Welcome Screen -->
<div id="welcome">
  <div class="welcome-logo">🌍</div>
  <div class="welcome-title">Choose how you want to practice today</div>
  <div class="welcome-sub">This is your space to practice without pressure.</div>
  <div class="lang-cards">
    <div class="lang-card" onclick="selectLanguage('English', '🇺🇸', 'English')">
      <div class="lang-flag">🇺🇸</div>
      <div class="lang-info">
        <div class="lang-name">English</div>
        <div class="lang-native">American English</div>
      </div>
      <div class="lang-arrow">›</div>
    </div>
    <div class="lang-card" onclick="selectLanguage('Spanish', '🇪🇸', 'Español')">
      <div class="lang-flag">🇪🇸</div>
      <div class="lang-info">
        <div class="lang-name">Spanish</div>
        <div class="lang-native">Español</div>
      </div>
      <div class="lang-arrow">›</div>
    </div>
    <div class="lang-card" onclick="selectLanguage('Portuguese', '🇧🇷', 'Português')">
      <div class="lang-flag">🇧🇷</div>
      <div class="lang-info">
        <div class="lang-name">Portuguese</div>
        <div class="lang-native">Português</div>
      </div>
      <div class="lang-arrow">›</div>
    </div>
  </div>
</div>

<!-- App Shell -->
<div id="app">
  <header>
    <div class="brand">
      <div class="brand-icon">🌍</div>
      <div>
        <div class="brand-name">Luna</div>
        <div class="brand-sub">Language Practice</div>
      </div>
    </div>
    <div class="header-right">
      <span class="lang-badge" id="lang-badge"></span>
      <button class="clear-btn" onclick="returnToWelcome()">&#8634; New chat</button>
    </div>
  </header>

  <div id="chat"></div>

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
    <div class="hint">Enter to send &nbsp;&middot;&nbsp; Shift+Enter for new line</div>
  </footer>
</div>

<script>
  const welcomeEl = document.getElementById("welcome");
  const appEl     = document.getElementById("app");
  const chat      = document.getElementById("chat");
  const input     = document.getElementById("input");
  const sendBtn   = document.getElementById("send");
  const langBadge = document.getElementById("lang-badge");

  let chosenLanguage = null;
  let chosenFlag = "";

  const OPENING = {
    English:    "Hey, great choice! 👋 I'm Luna, and I'm here to help you practice English in a relaxed, pressure-free way.\\n\\nTell me — what's something you've been up to lately?",
    Spanish:    "¡Hola! Qué buena elección 👋 Soy Luna, y estoy aquí para ayudarte a practicar español de forma natural y sin presión.\\n\\n¿Cuéntame, qué has estado haciendo últimamente?",
    Portuguese: "Olá! Que ótima escolha 👋 Sou a Luna, e estou aqui para te ajudar a praticar português de forma natural e sem pressão.\\n\\nMe conta — o que você tem feito ultimamente?"
  };

  async function selectLanguage(lang, flag, nativeName) {
    chosenLanguage = lang;
    chosenFlag = flag;

    langBadge.textContent = flag + " " + nativeName;

    // Fade out welcome, fade in app
    welcomeEl.classList.add("hiding");
    setTimeout(() => {
      welcomeEl.style.display = "none";
      appEl.classList.add("visible");
      input.focus();
    }, 450);

    // Clear server history and set language
    await fetch("/api/clear", { method: "POST" });

    // Show Luna's opening message
    const opening = OPENING[lang] || OPENING.English;
    addMessage("assistant", opening);
  }

  function returnToWelcome() {
    chat.innerHTML = "";
    chosenLanguage = null;
    appEl.classList.remove("visible");
    welcomeEl.style.display = "flex";
    requestAnimationFrame(() => {
      welcomeEl.classList.remove("hiding");
    });
    fetch("/api/clear", { method: "POST" });
  }

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

  function addMessage(role, text, isError) {
    const div = document.createElement("div");
    div.className = "msg" + (role === "user" ? " user" : "");
    div.innerHTML =
      '<div class="avatar">' + (role === "user" ? "👤" : chosenFlag || "🌍") + "</div>" +
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
      '<div class="avatar">' + (chosenFlag || "🌍") + "</div>" +
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
    if (!text || !chosenLanguage) return;

    addMessage("user", text);
    input.value = "";
    input.style.height = "auto";
    sendBtn.disabled = true;
    showTyping();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, language: chosenLanguage }),
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
</script>

</body>
</html>`);
});

export default router;
