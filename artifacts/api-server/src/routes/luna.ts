import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();
const client = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

type Difficulty = "simple" | "normal" | "challenge";

function buildSystemPrompt(language: string, difficulty: Difficulty): string {
  const difficultyGuide: Record<Difficulty, string> = {
    simple: `- Use only simple, everyday vocabulary. Keep sentences short and clear (5–10 words).
- Speak slowly in terms of information density — one idea per sentence.
- Corrections are very gentle: frame them as "another way to say that" rather than pointing out errors.
- Be extra warm and reassuring. Never make the user feel like they made a mistake.`,
    normal: `- Use natural, conversational vocabulary — not too simple, not too advanced.
- Mix short and medium sentences. Sound like a real friend talking.
- Correct mistakes once per reply using: "Small tip: instead of '...' you could say '...' — sounds more natural!"
- Keep the conversation engaging and flowing naturally.`,
    challenge: `- Use richer vocabulary and more complex sentence structures.
- Dive deeper into topics. Ask follow-up questions that make the user think.
- Point out subtle mistakes — grammar, idiom misuse, unnatural phrasing — and explain briefly why.
- Introduce new expressions or idioms the user might not know yet.
- Keep the tone warm but intellectually stimulating.`,
  };

  return `You are Luna, a friendly and encouraging language practice companion.

The user has chosen to practice: ${language}.

Difficulty mode: ${difficulty === "simple" ? "Keep it simple" : difficulty === "normal" ? "Let's talk normally" : "Challenge me"}

Your core rules:
- ALWAYS respond exclusively in ${language} — never switch languages.
- End every reply with a follow-up question to keep conversation flowing.
- Keep replies to 2–4 sentences (slightly longer for "Challenge me").
- Be warm, human, and encouraging — never robotic or academic.

Difficulty-specific guidance:
${difficultyGuide[difficulty]}`;
}

const OPENING_MESSAGE: Record<string, Record<Difficulty, string>> = {
  English: {
    simple:
      "Hi there! 👋 I'm Luna. We'll keep things nice and easy today — no pressure, just good practice.\n\nLet's start simple: what's your favorite thing to do on weekends?",
    normal:
      "Hey! 👋 I'm Luna, and I'm really glad you're here. Let's just have a natural conversation and practice your English along the way.\n\nSo — what's been on your mind lately?",
    challenge:
      "Hello! 👋 I'm Luna, and I love that you picked the challenge mode. We're going to have some real conversations today — the kind that actually stretch your English.\n\nTo kick things off: what's something you've been thinking about a lot recently, and why?",
  },
  Spanish: {
    simple:
      "¡Hola! 👋 Soy Luna. Hoy vamos a ir tranquilos, sin prisa — solo buena práctica.\n\nEmpecemos con algo fácil: ¿cuál es tu comida favorita?",
    normal:
      "¡Hola! 👋 Soy Luna, y me alegra mucho que estés aquí. Vamos a conversar de forma natural mientras practicamos tu español.\n\n¿De qué te gustaría hablar hoy?",
    challenge:
      "¡Hola! 👋 Soy Luna, y me encanta que hayas elegido el modo desafío. Hoy vamos a tener conversaciones de verdad — las que realmente mejoran tu español.\n\nPara empezar: ¿hay algún tema sobre el que tengas una opinión fuerte? Cuéntame.",
  },
  Portuguese: {
    simple:
      "Oi! 👋 Sou a Luna. Hoje vamos devagar, sem pressa — só prática boa e tranquila.\n\nVamos começar com algo simples: qual é a sua comida favorita?",
    normal:
      "Oi! 👋 Sou a Luna, e fico muito feliz que você esteja aqui. Vamos conversar de forma natural enquanto praticamos o seu português.\n\nSobre o que você gostaria de falar hoje?",
    challenge:
      "Oi! 👋 Sou a Luna, e adorei que você escolheu o modo desafio. Vamos ter conversas de verdade hoje — as que realmente fazem a diferença no seu português.\n\nPara começar: tem algum assunto sobre o qual você tem uma opinião forte? Me conta.",
  },
};

let history: { role: "user" | "assistant"; content: string }[] = [];
let currentLanguage = "English";
let currentDifficulty: Difficulty = "normal";

router.post("/chat", async (req, res) => {
  const { message, language, difficulty } = req.body as {
    message?: string;
    language?: string;
    difficulty?: Difficulty;
  };

  if (!message || !message.trim()) {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  if (language) currentLanguage = language;
  if (difficulty) currentDifficulty = difficulty;

  history.push({ role: "user", content: message });

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: buildSystemPrompt(currentLanguage, currentDifficulty),
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
  currentDifficulty = "normal";
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

    /* ── Shared screen base ── */
    .screen {
      position: fixed;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 10;
      transition: opacity 0.4s ease, transform 0.4s ease;
    }
    .screen.hidden {
      opacity: 0;
      transform: translateY(-16px);
      pointer-events: none;
    }
    .screen.gone { display: none; }

    /* ── Welcome / Difficulty shared elements ── */
    .screen-logo { font-size: 46px; margin-bottom: 20px; animation: floatIn 0.55s ease both; }
    .screen-title {
      font-size: 21px;
      font-weight: 700;
      letter-spacing: -0.03em;
      color: #f0f2f8;
      text-align: center;
      padding: 0 24px;
      animation: floatIn 0.6s 0.05s ease both;
    }
    .screen-sub {
      font-size: 13px;
      color: #454e66;
      margin-top: 8px;
      margin-bottom: 38px;
      text-align: center;
      animation: floatIn 0.6s 0.1s ease both;
    }

    .cards {
      display: flex;
      flex-direction: column;
      gap: 11px;
      width: 100%;
      max-width: 340px;
      padding: 0 20px;
    }

    /* ── Language cards ── */
    .lang-card {
      display: flex;
      align-items: center;
      gap: 16px;
      background: #151822;
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 16px;
      padding: 17px 20px;
      cursor: pointer;
      transition: background 0.18s, border-color 0.18s, transform 0.15s;
      animation: floatIn 0.55s ease both;
      user-select: none;
    }
    .lang-card:nth-child(1) { animation-delay: 0.14s; }
    .lang-card:nth-child(2) { animation-delay: 0.2s; }
    .lang-card:nth-child(3) { animation-delay: 0.26s; }
    .lang-card:hover { background: #1c2030; border-color: rgba(245,166,35,0.35); transform: translateY(-2px); }
    .lang-card:active { transform: scale(0.98); }

    .lang-flag { font-size: 26px; line-height: 1; }
    .lang-info { flex: 1; }
    .lang-name { font-size: 15px; font-weight: 600; color: #e8eaf0; }
    .lang-native { font-size: 12px; color: #454e66; margin-top: 2px; }
    .card-arrow { font-size: 16px; color: #2d3448; transition: color 0.18s, transform 0.18s; }
    .lang-card:hover .card-arrow { color: #f5a623; transform: translateX(3px); }

    /* ── Difficulty cards ── */
    .diff-card {
      background: #151822;
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 16px;
      padding: 18px 22px;
      cursor: pointer;
      transition: background 0.18s, border-color 0.18s, transform 0.15s;
      animation: floatIn 0.55s ease both;
      user-select: none;
    }
    .diff-card:nth-child(1) { animation-delay: 0.12s; }
    .diff-card:nth-child(2) { animation-delay: 0.19s; }
    .diff-card:nth-child(3) { animation-delay: 0.26s; }
    .diff-card:hover { background: #1c2030; border-color: rgba(245,166,35,0.35); transform: translateY(-2px); }
    .diff-card:active { transform: scale(0.98); }

    .diff-header { display: flex; align-items: center; justify-content: space-between; }
    .diff-label { font-size: 15px; font-weight: 600; color: #e8eaf0; }
    .diff-desc { font-size: 12px; color: #454e66; margin-top: 5px; line-height: 1.5; }
    .diff-tag {
      font-size: 11px;
      padding: 3px 9px;
      border-radius: 20px;
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    .tag-simple   { background: rgba(74,222,128,0.1); color: #4ade80; }
    .tag-normal   { background: rgba(245,166,35,0.12); color: #f5a623; }
    .tag-challenge { background: rgba(167,139,250,0.12); color: #a78bfa; }

    .back-btn {
      background: transparent;
      border: none;
      color: #3d4456;
      font-size: 13px;
      cursor: pointer;
      margin-bottom: 28px;
      padding: 4px 8px;
      border-radius: 6px;
      transition: color 0.15s;
      animation: floatIn 0.5s 0.05s ease both;
    }
    .back-btn:hover { color: #7a8499; }

    @keyframes floatIn {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── App shell ── */
    #app {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      height: 100dvh;
      opacity: 0;
      transition: opacity 0.4s ease;
      pointer-events: none;
      position: relative;
      z-index: 1;
    }
    #app.visible { opacity: 1; pointer-events: all; }

    header {
      width: 100%;
      max-width: 700px;
      padding: 16px 20px 13px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      flex-shrink: 0;
    }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand-icon { font-size: 22px; }
    .brand-name { font-size: 16px; font-weight: 700; letter-spacing: -0.03em; color: #f5a623; }
    .brand-sub { font-size: 11px; color: #555f72; margin-top: 1px; }

    .header-right { display: flex; align-items: center; gap: 7px; }
    .meta-badge {
      font-size: 11px; color: #555f72;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 20px;
      padding: 3px 10px;
    }
    .clear-btn {
      background: transparent;
      border: 1px solid rgba(255,255,255,0.1);
      color: #555f72;
      border-radius: 8px;
      padding: 4px 11px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .clear-btn:hover { border-color: #555f72; color: #aaa; }

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

    .msg { display: flex; gap: 10px; align-items: flex-start; animation: fadeUp 0.22s ease; }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .msg.user { flex-direction: row-reverse; }

    .avatar {
      width: 32px; height: 32px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 15px; flex-shrink: 0;
      background: rgba(245,166,35,0.12);
      border: 1px solid rgba(245,166,35,0.2);
    }
    .msg.user .avatar { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.08); }

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
      background: #f5a623; border-color: #f5a623;
      color: #1a0e00; border-radius: 14px 4px 14px 14px; font-weight: 500;
    }

    .typing .bubble { display: flex; gap: 5px; align-items: center; padding: 14px 16px; }
    .dot {
      width: 6px; height: 6px; background: #555f72;
      border-radius: 50%; animation: bounce 1.2s ease infinite;
    }
    .dot:nth-child(2) { animation-delay: 0.2s; }
    .dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-6px); }
    }

    .error-bubble { background: rgba(248,113,113,0.1); border-color: rgba(248,113,113,0.25); color: #f87171; }

    footer {
      width: 100%; max-width: 700px;
      padding: 13px 20px 18px;
      border-top: 1px solid rgba(255,255,255,0.07);
      flex-shrink: 0;
    }
    .input-row {
      display: flex; gap: 10px;
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
      flex: 1; background: transparent; border: none; outline: none;
      color: #e8eaf0; font-size: 14.5px; font-family: inherit;
      resize: none; max-height: 110px; line-height: 1.5;
    }
    #input::placeholder { color: #3d4456; }
    #send {
      background: #f5a623; color: #1a0e00; border: none;
      border-radius: 10px; padding: 8px 18px; font-size: 14px;
      font-weight: 700; cursor: pointer; align-self: flex-end;
      transition: background 0.15s, transform 0.1s; flex-shrink: 0;
    }
    #send:hover { background: #e8941a; }
    #send:active { transform: scale(0.96); }
    #send:disabled { opacity: 0.45; cursor: not-allowed; }
    .hint { font-size: 11px; color: #3d4456; margin-top: 8px; padding: 0 4px; }
  </style>
</head>
<body>

<!-- Step 1: Language Selection -->
<div class="screen" id="screen-lang">
  <div class="screen-logo">🌍</div>
  <div class="screen-title">Choose how you want to practice today</div>
  <div class="screen-sub">This is your space to practice without pressure.</div>
  <div class="cards">
    <div class="lang-card" onclick="pickLanguage('English','🇺🇸','English')">
      <div class="lang-flag">🇺🇸</div>
      <div class="lang-info">
        <div class="lang-name">English</div>
        <div class="lang-native">American English</div>
      </div>
      <div class="card-arrow">›</div>
    </div>
    <div class="lang-card" onclick="pickLanguage('Spanish','🇪🇸','Español')">
      <div class="lang-flag">🇪🇸</div>
      <div class="lang-info">
        <div class="lang-name">Spanish</div>
        <div class="lang-native">Español</div>
      </div>
      <div class="card-arrow">›</div>
    </div>
    <div class="lang-card" onclick="pickLanguage('Portuguese','🇧🇷','Português')">
      <div class="lang-flag">🇧🇷</div>
      <div class="lang-info">
        <div class="lang-name">Portuguese</div>
        <div class="lang-native">Português</div>
      </div>
      <div class="card-arrow">›</div>
    </div>
  </div>
</div>

<!-- Step 2: Difficulty Selection -->
<div class="screen hidden gone" id="screen-diff">
  <div class="screen-logo" id="diff-flag">🌍</div>
  <div class="screen-title">How do you want to be challenged?</div>
  <div class="screen-sub">You can always start fresh if you change your mind.</div>
  <div class="cards">
    <div class="diff-card" onclick="pickDifficulty('simple')">
      <div class="diff-header">
        <div class="diff-label">Keep it simple</div>
        <span class="diff-tag tag-simple">Easy</span>
      </div>
      <div class="diff-desc">Short sentences, gentle guidance, no pressure at all.</div>
    </div>
    <div class="diff-card" onclick="pickDifficulty('normal')">
      <div class="diff-header">
        <div class="diff-label">Let's talk normally</div>
        <span class="diff-tag tag-normal">Balanced</span>
      </div>
      <div class="diff-desc">Natural conversation with friendly corrections when useful.</div>
    </div>
    <div class="diff-card" onclick="pickDifficulty('challenge')">
      <div class="diff-header">
        <div class="diff-label">Challenge me</div>
        <span class="diff-tag tag-challenge">Advanced</span>
      </div>
      <div class="diff-desc">Richer vocabulary, deeper questions, and sharper corrections.</div>
    </div>
  </div>
  <button class="back-btn" style="margin-top:20px;" onclick="goBack()">← Change language</button>
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
      <span class="meta-badge" id="meta-badge"></span>
      <button class="clear-btn" onclick="restart()">&#8634; New chat</button>
    </div>
  </header>
  <div id="chat"></div>
  <footer>
    <div class="input-row">
      <textarea id="input" rows="1" placeholder="Type your message..."
        onkeydown="handleKey(event)" oninput="autoResize(this)"></textarea>
      <button id="send" onclick="sendMessage()">Send</button>
    </div>
    <div class="hint">Enter to send &nbsp;&middot;&nbsp; Shift+Enter for new line</div>
  </footer>
</div>

<script>
  const screenLang = document.getElementById("screen-lang");
  const screenDiff = document.getElementById("screen-diff");
  const appEl      = document.getElementById("app");
  const chat       = document.getElementById("chat");
  const input      = document.getElementById("input");
  const sendBtn    = document.getElementById("send");
  const metaBadge  = document.getElementById("meta-badge");
  const diffFlag   = document.getElementById("diff-flag");

  let chosenLanguage   = null;
  let chosenFlag       = "";
  let chosenNative     = "";
  let chosenDifficulty = null;

  const OPENING = {
    English: {
      simple:    "Hi there! 👋 I'm Luna. We'll keep things nice and easy today — no pressure, just good practice.\\n\\nLet's start simple: what's your favorite thing to do on weekends?",
      normal:    "Hey! 👋 I'm Luna, and I'm really glad you're here. Let's have a natural conversation and practice your English along the way.\\n\\nSo — what's been on your mind lately?",
      challenge: "Hello! 👋 I'm Luna, and I love that you picked challenge mode. We're going to have real conversations today — the kind that actually stretch your English.\\n\\nTo kick things off: what's something you've been thinking about a lot recently, and why?"
    },
    Spanish: {
      simple:    "¡Hola! 👋 Soy Luna. Hoy vamos a ir tranquilos, sin prisa — solo buena práctica.\\n\\nEmpecemos con algo fácil: ¿cuál es tu comida favorita?",
      normal:    "¡Hola! 👋 Soy Luna, y me alegra mucho que estés aquí. Vamos a conversar de forma natural mientras practicamos tu español.\\n\\n¿De qué te gustaría hablar hoy?",
      challenge: "¡Hola! 👋 Soy Luna, y me encanta que hayas elegido el modo desafío. Hoy vamos a tener conversaciones de verdad.\\n\\nPara empezar: ¿hay algún tema sobre el que tengas una opinión fuerte? Cuéntame."
    },
    Portuguese: {
      simple:    "Oi! 👋 Sou a Luna. Hoje vamos devagar, sem pressa — só prática boa e tranquila.\\n\\nVamos começar com algo simples: qual é a sua comida favorita?",
      normal:    "Oi! 👋 Sou a Luna, e fico muito feliz que você esteja aqui. Vamos conversar de forma natural enquanto praticamos o seu português.\\n\\nSobre o que você gostaria de falar hoje?",
      challenge: "Oi! 👋 Sou a Luna, e adorei que você escolheu o modo desafio. Vamos ter conversas de verdade hoje.\\n\\nPara começar: tem algum assunto sobre o qual você tem uma opinião forte? Me conta."
    }
  };

  const DIFF_LABELS = { simple: "Easy", normal: "Balanced", challenge: "Advanced" };

  function transitionScreens(from, to, cb) {
    from.classList.add("hidden");
    setTimeout(() => {
      from.classList.add("gone");
      to.classList.remove("gone");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          to.classList.remove("hidden");
          if (cb) cb();
        });
      });
    }, 400);
  }

  function pickLanguage(lang, flag, native) {
    chosenLanguage = lang;
    chosenFlag     = flag;
    chosenNative   = native;
    diffFlag.textContent = flag;
    transitionScreens(screenLang, screenDiff);
  }

  async function pickDifficulty(diff) {
    chosenDifficulty = diff;
    metaBadge.textContent = chosenFlag + " " + chosenNative + " · " + DIFF_LABELS[diff];

    transitionScreens(screenDiff, { classList: { add: () => {}, remove: () => {} } }, null);
    screenDiff.classList.add("hidden");
    setTimeout(() => {
      screenDiff.classList.add("gone");
      appEl.classList.add("visible");
      input.focus();
    }, 400);

    await fetch("/clear", { method: "POST" });

    const opening = (OPENING[chosenLanguage] || OPENING.English)[diff] || OPENING.English.normal;
    addMessage("assistant", opening);
  }

  function goBack() {
    chosenDifficulty = null;
    transitionScreens(screenDiff, screenLang);
  }

  function restart() {
    chat.innerHTML = "";
    chosenLanguage = null;
    chosenFlag = "";
    chosenNative = "";
    chosenDifficulty = null;
    appEl.classList.remove("visible");
    screenDiff.classList.add("gone");
    screenDiff.classList.add("hidden");
    screenLang.classList.remove("gone");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      screenLang.classList.remove("hidden");
    }));
    fetch("/clear", { method: "POST" });
  }

  function autoResize(el) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 110) + "px";
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function scrollToBottom() { chat.scrollTop = chat.scrollHeight; }

  function addMessage(role, text, isError) {
    const div = document.createElement("div");
    div.className = "msg" + (role === "user" ? " user" : "");
    div.innerHTML =
      '<div class="avatar">' + (role === "user" ? "👤" : chosenFlag || "🌍") + "</div>" +
      '<div class="bubble' + (isError ? " error-bubble" : "") + '">' +
      text.replace(/\\n/g, "<br>") + "</div>";
    chat.appendChild(div);
    scrollToBottom();
  }

  function showTyping() {
    const div = document.createElement("div");
    div.className = "msg typing"; div.id = "typing";
    div.innerHTML = '<div class="avatar">' + (chosenFlag || "🌍") + "</div>" +
      '<div class="bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>';
    chat.appendChild(div);
    scrollToBottom();
  }

  function hideTyping() { const el = document.getElementById("typing"); if (el) el.remove(); }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text || !chosenLanguage || !chosenDifficulty) return;

    addMessage("user", text);
    input.value = "";
    input.style.height = "auto";
    sendBtn.disabled = true;
    showTyping();

    try {
      const res = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, language: chosenLanguage, difficulty: chosenDifficulty }),
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
