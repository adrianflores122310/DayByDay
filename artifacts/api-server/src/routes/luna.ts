import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();
const client = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

type Difficulty = "simple" | "normal" | "challenge";
type Mode = "chat" | "voice";

function buildChatSystemPrompt(
  language: string,
  difficulty: Difficulty,
): string {
  const difficultyGuide: Record<Difficulty, string> = {
    simple: `- Use only simple, everyday vocabulary. Keep sentences short and clear (5–10 words).
- Speak slowly in terms of information density — one idea per sentence.
- Corrections are very gentle: frame them as "another way to say that" rather than pointing out errors.
- Be extra warm and reassuring. Never make the user feel like they made a mistake.
- You may use emojis sparingly to keep the tone friendly and approachable.`,
    normal: `- Use natural, conversational vocabulary — not too simple, not too advanced.
- Mix short and medium sentences. Sound like a real friend talking.
- Correct mistakes once per reply using: "Small tip: instead of '...' you could say '...' — sounds more natural!"
- Keep the conversation engaging and flowing naturally.
- Use emojis where they add warmth or emphasis.`,
    challenge: `- Use richer vocabulary and more complex sentence structures.
- Dive deeper into topics. Ask follow-up questions that make the user think.
- Point out subtle mistakes — grammar, idiom misuse, unnatural phrasing — and explain briefly why.
- Introduce new expressions or idioms the user might not know yet.
- Keep the tone warm but intellectually stimulating.`,
  };

  return `You are Luna, a friendly and encouraging language practice companion for text-based chat.

The user has chosen to practice: ${language}.

Difficulty mode: ${difficulty === "simple" ? "Keep it simple" : difficulty === "normal" ? "Let's talk normally" : "Challenge me"}

Your core rules:
- ALWAYS respond exclusively in ${language} — never switch languages.
- End every reply with a follow-up question to keep conversation flowing.
- Keep replies to 2–4 sentences (slightly longer for "Challenge me").
- Be warm, human, and encouraging — never robotic or academic.
- You can use formatting, emojis, corrections in brackets, and suggestions — this is a chat interface.

Difficulty-specific guidance:
${difficultyGuide[difficulty]}`;
}

function buildVoiceSystemPrompt(
  language: string,
  difficulty: Difficulty,
): string {
  const difficultyGuide: Record<Difficulty, string> = {
    simple: `- Use very simple, everyday words.
- Keep pauses natural and sentences short.
- If they make a mistake, gently restate the idea correctly.
- Sound calm, patient, and encouraging.`,
    normal: `- Speak naturally, like a real conversation.
- Keep it smooth, friendly, and clear.
- If the user makes an error, answer naturally and model the better phrasing.
- Avoid sounding scripted.`,
    challenge: `- Use richer but still natural language.
- Keep responses concise and confident.
- Correct mistakes by weaving the right form into your reply.
- Ask one thoughtful follow-up when it fits.`,
  };

  return `You are Luna, a calm, intelligent real-time language assistant.

The user has chosen to practice: ${language}.

Difficulty mode: ${difficulty === "simple" ? "Keep it simple" : difficulty === "normal" ? "Let's talk normally" : "Challenge me"}

CRITICAL — THIS IS A VOICE-ONLY INTERACTION. FOLLOW THESE RULES STRICTLY:
- ALWAYS respond in ${language}.
- When translating, repeat the original phrase first, then give a smooth natural translation.
- Preserve tone and emotion. Do not translate word-for-word.
- Keep it human, warm, clear, and conversational.
- Use short sentences and natural pauses.
- Never use emojis, bullet points, markdown, or visual formatting.
- Never mention UI elements, symbols, punctuation, or actions.
- Keep answers brief unless the user asks for more.
- If the user is speaking, respond like a live tutor or interpreter.
- For beginner level, be slower and simpler.
- For advanced level, be more natural and concise.

Difficulty-specific guidance:
${difficultyGuide[difficulty]}`;
}

const OPENING_MESSAGE: Record<string, Record<Difficulty, string>> = {
  English: {
    simple:
      "Hi. I’m Luna. Let’s keep this simple and natural.\n\nSay a short phrase in English, and I’ll help you translate or correct it.",
    normal:
      "Hi. I’m Luna. We can keep this conversational and natural.\n\nSay something in English, Spanish, or Portuguese, and I’ll help you right away.",
    challenge:
      "Hi. I’m Luna. Let’s keep the conversation natural and a little more advanced.\n\nSend me a phrase, and I’ll translate it or help you refine it.",
  },
  Spanish: {
    simple:
      "Hola. Soy Luna. Vamos a hacerlo simple y natural.\n\nEscribe una frase corta en español y te ayudo a traducirla o corregirla.",
    normal:
      "Hola. Soy Luna. Podemos hablar de forma natural y conversacional.\n\nEscribe algo en español, inglés o portugués, y te ayudo enseguida.",
    challenge:
      "Hola. Soy Luna. Vamos a hablar de forma natural y un poco más avanzada.\n\nMándame una frase y la traduzco o la ajusto contigo.",
  },
  Portuguese: {
    simple:
      "Oi. Eu sou a Luna. Vamos manter tudo simples e natural.\n\nEscreva uma frase curta em português e eu ajudo a traduzir ou corrigir.",
    normal:
      "Oi. Eu sou a Luna. Podemos conversar de forma natural e leve.\n\nEscreva algo em português, inglês ou espanhol, e eu ajudo na hora.",
    challenge:
      "Oi. Eu sou a Luna. Vamos conversar de forma natural e um pouco mais avançada.\n\nMe envie uma frase e eu traduzo ou ajusto com você.",
  },
};

let history: { role: "user" | "assistant"; content: string }[] = [];
let currentLanguage = "English";
let currentDifficulty: Difficulty = "normal";

router.post("/chat", async (req, res) => {
  const { message, language, difficulty, mode } = req.body as {
    message?: string;
    language?: string;
    difficulty?: Difficulty;
    mode?: Mode;
  };

  if (!message || !message.trim()) {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  if (language) currentLanguage = language;
  if (difficulty) currentDifficulty = difficulty;

  history.push({ role: "user", content: message });

  const systemPrompt =
    mode === "voice"
      ? buildVoiceSystemPrompt(currentLanguage, currentDifficulty)
      : buildChatSystemPrompt(currentLanguage, currentDifficulty);

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: mode === "voice" ? 180 : 400,
      system: systemPrompt,
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

router.post("/translate", async (req, res) => {
  const { text, from, to } = req.body as {
    text?: string;
    from?: string;
    to?: string;
  };
  if (!text || !from || !to) {
    res.status(400).json({ error: "Missing fields" });
    return;
  }
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 120,
      system: `Translate the following text from ${from} to ${to}. Return ONLY the translation — no quotes, no labels, no explanations.`,
      messages: [{ role: "user", content: text }],
    });
    res.json({
      translation: (response.content[0] as { text: string }).text.trim(),
    });
  } catch (err) {
    req.log.error({ err }, "Translation error");
    res.status(500).json({ error: "Translation failed" });
  }
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
    .hint { font-size: 11px; color: #3d4456; margin-top: 8px; padding: 0 4px; transition: color 0.2s; }
    .hint.listening-hint { color: #f5a623; }

    #mic {
      background: transparent;
      border: 1px solid rgba(255,255,255,0.1);
      color: #555f72;
      border-radius: 10px;
      padding: 8px 11px;
      font-size: 16px;
      cursor: pointer;
      align-self: flex-end;
      flex-shrink: 0;
      transition: background 0.18s, border-color 0.18s, color 0.18s, transform 0.1s;
      line-height: 1;
    }
    #mic:hover { border-color: #555f72; color: #aaa; }
    #mic:active { transform: scale(0.94); }
    #mic.active {
      background: rgba(245,166,35,0.12);
      border-color: rgba(245,166,35,0.5);
      color: #f5a623;
      animation: micPulse 1.4s ease infinite;
    }
    #mic:disabled { opacity: 0.3; cursor: not-allowed; animation: none; }
    @keyframes micPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(245,166,35,0.25); }
      50%       { box-shadow: 0 0 0 6px rgba(245,166,35,0); }
    }

    .input-row.listening {
      border-color: rgba(245,166,35,0.4);
      box-shadow: 0 0 0 3px rgba(245,166,35,0.06);
    }

    /* ── Voice Mode ── */
    #voice-mode {
      position: fixed; inset: 0; z-index: 200;
      background: #080b12;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 0;
      opacity: 0; transition: opacity 0.4s ease;
    }
    #voice-mode.visible { opacity: 1; }
    #voice-mode.gone    { display: none; }

    /* Sphere */
    #sphere-wrap {
      position: relative;
      width: 200px; height: 200px;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 48px;
    }

    .v-ring {
      position: absolute;
      border-radius: 50%;
      border: 1.5px solid rgba(245,166,35,0.18);
      animation: vRingIdle 3s ease-in-out infinite;
    }
    .v-ring:nth-child(1) { width: 130px; height: 130px; animation-delay: 0s; }
    .v-ring:nth-child(2) { width: 162px; height: 162px; animation-delay: 0.4s; }
    .v-ring:nth-child(3) { width: 196px; height: 196px; animation-delay: 0.8s; }

    @keyframes vRingIdle {
      0%, 100% { opacity: 0.25; transform: scale(1);   }
      50%       { opacity: 0.55; transform: scale(1.04); }
    }

    #sphere-wrap[data-state="listening"] .v-ring {
      animation: vRingListen 0.7s ease-in-out infinite;
      border-color: rgba(245,166,35,0.45);
    }
    #sphere-wrap[data-state="listening"] .v-ring:nth-child(1) { animation-delay: 0s; }
    #sphere-wrap[data-state="listening"] .v-ring:nth-child(2) { animation-delay: 0.1s; }
    #sphere-wrap[data-state="listening"] .v-ring:nth-child(3) { animation-delay: 0.2s; }
    @keyframes vRingListen {
      0%, 100% { opacity: 0.5; transform: scale(1); }
      50%       { opacity: 1;   transform: scale(1.08); }
    }

    #sphere-wrap[data-state="speaking"] .v-ring {
      animation: vRingSpeak 1.1s ease-out infinite;
      border-color: rgba(245,166,35,0.6);
    }
    #sphere-wrap[data-state="speaking"] .v-ring:nth-child(1) { animation-delay: 0s; }
    #sphere-wrap[data-state="speaking"] .v-ring:nth-child(2) { animation-delay: 0.28s; }
    #sphere-wrap[data-state="speaking"] .v-ring:nth-child(3) { animation-delay: 0.56s; }
    @keyframes vRingSpeak {
      0%   { opacity: 0.8; transform: scale(0.95); }
      60%  { opacity: 0.2; transform: scale(1.14); }
      100% { opacity: 0;   transform: scale(1.22); }
    }

    #sphere-core {
      width: 88px; height: 88px; border-radius: 50%;
      background: radial-gradient(circle at 38% 35%, #f5c060, #f5a623 45%, #c47a0f 75%, #7a4a05);
      box-shadow: 0 0 28px 8px rgba(245,166,35,0.25), 0 0 60px 20px rgba(245,166,35,0.08);
      transition: box-shadow 0.4s ease, transform 0.3s ease;
      position: relative; z-index: 1;
      animation: coreIdle 3.2s ease-in-out infinite;
    }
    @keyframes coreIdle {
      0%, 100% { transform: scale(1);    box-shadow: 0 0 28px 8px rgba(245,166,35,0.22), 0 0 60px 20px rgba(245,166,35,0.07); }
      50%       { transform: scale(1.05); box-shadow: 0 0 36px 12px rgba(245,166,35,0.35), 0 0 80px 28px rgba(245,166,35,0.12); }
    }
    #sphere-wrap[data-state="listening"] #sphere-core {
      animation: coreListen 0.65s ease-in-out infinite;
    }
    @keyframes coreListen {
      0%, 100% { transform: scale(1);    box-shadow: 0 0 32px 10px rgba(245,166,35,0.4),  0 0 70px 24px rgba(245,166,35,0.15); }
      50%       { transform: scale(1.09); box-shadow: 0 0 48px 18px rgba(245,166,35,0.65), 0 0 90px 34px rgba(245,166,35,0.22); }
    }
    #sphere-wrap[data-state="speaking"] #sphere-core {
      animation: coreSpeak 0.9s ease-in-out infinite;
    }
    @keyframes coreSpeak {
      0%, 100% { transform: scale(1.02); box-shadow: 0 0 40px 14px rgba(245,166,35,0.55), 0 0 80px 30px rgba(245,166,35,0.2); }
      50%       { transform: scale(1.07); box-shadow: 0 0 56px 22px rgba(245,166,35,0.75), 0 0 100px 40px rgba(245,166,35,0.28); }
    }

    #voice-status {
      font-size: 15px; color: #555f72; letter-spacing: 0.04em;
      text-transform: uppercase; font-weight: 600;
      height: 20px; transition: color 0.3s ease;
      margin-bottom: 12px;
    }
    #voice-status.st-listening { color: #f5a623; }
    #voice-status.st-speaking  { color: #a78bfa; }

    #voice-transcript {
      font-size: 16px; color: rgba(232,234,240,0.6);
      max-width: 400px; text-align: center; line-height: 1.6;
      min-height: 50px; padding: 0 24px;
      font-style: italic; transition: opacity 0.3s;
    }

    #voice-controls {
      position: absolute; bottom: 36px;
      display: flex; align-items: center; gap: 14px;
    }
    #exit-voice {
      background: transparent;
      border: 1px solid rgba(255,255,255,0.1);
      color: #454e66; border-radius: 10px;
      padding: 9px 20px; font-size: 13px;
      cursor: pointer; transition: all 0.18s;
      font-family: inherit;
    }
    #exit-voice:hover { border-color: #555f72; color: #aaa; }

    /* Subtitles */
    #voice-subtitles {
      position: absolute;
      bottom: 130px;
      left: 50%; transform: translateX(-50%);
      width: min(520px, 88%);
      text-align: center;
      pointer-events: none;
      display: flex; flex-direction: column; gap: 10px;
    }
    .vsub {
      opacity: 0; transform: translateY(6px);
      transition: opacity 0.45s ease, transform 0.45s ease;
    }
    .vsub.show { opacity: 1; transform: translateY(0); }
    .vsub-main {
      font-size: 15px; font-weight: 500; line-height: 1.55;
      color: rgba(232,234,240,0.88);
      text-shadow: 0 1px 8px rgba(0,0,0,0.6);
    }
    .vsub-user .vsub-main { color: rgba(245,166,35,0.9); }
    .vsub-sub {
      font-size: 12.5px; font-style: italic; line-height: 1.45;
      color: rgba(180,185,205,0.42);
      margin-top: 3px;
      text-shadow: 0 1px 6px rgba(0,0,0,0.5);
    }

    #voice-tap {
      width: 54px; height: 54px; border-radius: 50%;
      background: rgba(245,166,35,0.08);
      border: 1.5px solid rgba(245,166,35,0.3);
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; cursor: pointer;
      transition: background 0.18s, border-color 0.18s, transform 0.15s;
    }
    #voice-tap:hover { background: rgba(245,166,35,0.15); border-color: rgba(245,166,35,0.55); }
    #voice-tap:active { transform: scale(0.93); }

    .voice-mode-btn {
      background: rgba(245,166,35,0.1);
      border: 1px solid rgba(245,166,35,0.25);
      color: #f5a623;
      border-radius: 8px; padding: 4px 11px;
      font-size: 12px; cursor: pointer;
      transition: all 0.15s; font-family: inherit;
    }
    .voice-mode-btn:hover { background: rgba(245,166,35,0.18); border-color: rgba(245,166,35,0.5); }

    .replay-btn {
      display: inline-flex; align-items: center;
      background: transparent; border: none; cursor: pointer;
      font-size: 14px; padding: 2px 6px 0; margin-left: 6px;
      opacity: 0.45; border-radius: 6px;
      transition: opacity 0.2s, background 0.2s;
      vertical-align: middle; line-height: 1;
    }
    .replay-btn:hover { opacity: 1; background: rgba(255,255,255,0.07); }
    .replay-btn.playing { opacity: 1; color: #f5a623; }
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
      <button class="voice-mode-btn" onclick="enterVoiceMode()">&#9679; Voice Mode</button>
      <button class="clear-btn" onclick="restart()">&#8634; New chat</button>
    </div>
  </header>
  <div id="chat"></div>
  <footer>
    <div class="input-row">
      <textarea id="input" rows="1" placeholder="Type your message..."
        onkeydown="handleKey(event)" oninput="autoResize(this)"></textarea>
      <button id="mic" onclick="toggleMic()" title="Hold to speak">🎙</button>
      <button id="send" onclick="sendMessage()">Send</button>
    </div>
    <div class="hint" id="hint">Enter to send &nbsp;&middot;&nbsp; Shift+Enter for new line</div>
  </footer>
</div>

<!-- Voice Mode Overlay -->
<div id="voice-mode" class="gone">
  <div id="sphere-wrap" data-state="idle">
    <div class="v-ring"></div>
    <div class="v-ring"></div>
    <div class="v-ring"></div>
    <div id="sphere-core"></div>
  </div>
  <div id="voice-status">Ready</div>
  <div id="voice-subtitles"></div>
  <div id="voice-controls">
    <div id="voice-tap" onclick="voiceTap()" title="Tap to speak">🎙</div>
    <button id="exit-voice" onclick="exitVoiceMode()">← Back to chat</button>
  </div>
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
    // Stop all active audio/listening first
    stopSpeaking();
    stopListening();
    // Exit voice mode without triggering another restart
    voiceActive = false;
    try { if (voiceRec) voiceRec.stop(); } catch(e) {}
    voiceListening = false;
    if (voiceModeEl) {
      voiceModeEl.classList.remove("visible");
      setTimeout(() => voiceModeEl.classList.add("gone"), 400);
    }
    // Reset all state
    chat.innerHTML = "";
    chosenLanguage = null;
    chosenFlag = "";
    chosenNative = "";
    chosenDifficulty = null;
    // Return to language screen
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

  function escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function addMessage(role, text, isError) {
    const div = document.createElement("div");
    div.className = "msg" + (role === "user" ? " user" : "");
    const safe = escHtml(text).replace(/\\n/g, "<br>");
    const replayBtn = (role === "assistant" && !isError)
      ? '<button class="replay-btn" title="Replay audio" onclick="replayAudio(this)">🔊</button>'
      : "";
    div.innerHTML =
      '<div class="avatar">' + (role === "user" ? "👤" : escHtml(chosenFlag || "🌍")) + "</div>" +
      '<div class="bubble' + (isError ? " error-bubble" : "") + '">' +
      safe + replayBtn + "</div>";
    if (role === "assistant" && !isError) div.dataset.rawText = text;
    chat.appendChild(div);
    scrollToBottom();
    return div;
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

    stopSpeaking();
    addMessage("user", text);
    input.value = "";
    input.style.height = "auto";
    sendBtn.disabled = true;
    showTyping();

    try {
      console.log("[Luna] Sending message to /chat:", text.slice(0, 60));
      const res = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, language: chosenLanguage, difficulty: chosenDifficulty, mode: "chat" }),
      });
      const data = await res.json();
      hideTyping();
      if (!res.ok) {
        console.error("[Luna] Chat API error:", data.error);
        addMessage("assistant", "⚠️ " + (data.error || "Something went wrong."), true);
      } else {
        console.log("[Luna] Reply received:", data.reply?.slice(0, 60));
        const msgEl = addMessage("assistant", data.reply);
        speakReply(data.reply, msgEl);
      }
    } catch (err) {
      console.error("[Luna] Network error:", err);
      hideTyping();
      addMessage("assistant", "⚠️ Network error — please check your connection.", true);
    }

    sendBtn.disabled = false;
    input.focus();
  }

  // ── Voice: Speech-to-Text ────────────────────────────────
  const LANG_CODES = { English: "en-US", Spanish: "es-ES", Portuguese: "pt-BR" };
  const micBtn   = document.getElementById("mic");
  const hintEl   = document.getElementById("hint");
  const inputRow = document.querySelector(".input-row");

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let isListening = false;

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      isListening = true;
      micBtn.classList.add("active");
      inputRow.classList.add("listening");
      hintEl.textContent = "Listening… speak now";
      hintEl.classList.add("listening-hint");
      input.placeholder = "Listening…";
    };

    recognition.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript).join("");
      input.value = transcript;
      autoResize(input);
      if (e.results[e.results.length - 1].isFinal) {
        stopListening();
        if (transcript.trim()) sendMessage();
      }
    };

    recognition.onerror = () => stopListening();
    recognition.onend   = () => stopListening();
  } else {
    micBtn.disabled = true;
    micBtn.title = "Voice not supported in this browser";
  }

  function toggleMic() {
    if (!chosenLanguage) return;
    if (isListening) { stopListening(); return; }
    stopSpeaking();
    recognition.lang = LANG_CODES[chosenLanguage] || "en-US";
    try { recognition.start(); } catch(e) {}
  }

  function stopListening() {
    if (!isListening) return;
    isListening = false;
    try { recognition.stop(); } catch(e) {}
    micBtn.classList.remove("active");
    inputRow.classList.remove("listening");
    hintEl.innerHTML = "Enter to send &nbsp;&middot;&nbsp; Shift+Enter for new line";
    hintEl.classList.remove("listening-hint");
    input.placeholder = "Type your message…";
  }

  // ── Voice: Text-to-Speech ────────────────────────────────

  // Strip everything that sounds unnatural when spoken aloud
  function cleanForTTS(text) {
    let noEmoji = "";
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      if (c >= 0xD800 && c <= 0xDFFF) { i++; continue; }
      if (c >= 0x2600 && c <= 0x27FF) continue;
      if (c >= 0xFE00 && c <= 0xFEFF) continue;
      noEmoji += text[i];
    }
    return noEmoji
      .replace(/[*_#~>]/g, "")
      .replace(/\u0060/g, "")
      .replace(/\\[.*?\\]/g, "")
      .replace(/\\n+/g, ". ")
      .replace(/\\s{2,}/g, " ")
      .trim();
  }

  // Rank and pick the best available voice for a language code
  function pickBestVoice(langCode) {
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;
    const lang = langCode.toLowerCase();
    const base = lang.split("-")[0];
    const tiers = [
      v => v.lang.toLowerCase() === lang && /google/i.test(v.name),
      v => v.lang.toLowerCase().startsWith(base) && /google/i.test(v.name),
      v => v.lang.toLowerCase() === lang && /microsoft/i.test(v.name),
      v => v.lang.toLowerCase().startsWith(base) && /microsoft/i.test(v.name),
      v => v.lang.toLowerCase() === lang && /(premium|enhanced|natural|neural)/i.test(v.name),
      v => v.lang.toLowerCase().startsWith(base) && /(premium|enhanced|natural|neural)/i.test(v.name),
      v => v.lang.toLowerCase() === lang,
      v => v.lang.toLowerCase().startsWith(base),
    ];
    for (const test of tiers) {
      const match = voices.find(test);
      if (match) return match;
    }
    return null;
  }

  let currentReplayBtn = null;
  let ttsTimer = null;

  // Core speak — always called after a short delay to let Chrome process any prior cancel()
  function _doSpeak(clean, langCode, onEnd, onErr) {
    const synth = window.speechSynthesis;
    // Force Chrome out of any stuck/paused state
    if (synth.paused) synth.resume();
    synth.cancel(); // clear any leftover queue

    // Chrome REQUIRES a macrotask gap after cancel() before speak() works
    if (ttsTimer) clearTimeout(ttsTimer);
    ttsTimer = setTimeout(() => {
      ttsTimer = null;
      const utt   = new SpeechSynthesisUtterance(clean);
      utt.lang    = langCode;
      utt.rate    = 0.92;
      utt.pitch   = 1.0;
      const voice = pickBestVoice(langCode);
      if (voice) utt.voice = voice;
      utt.onend  = () => { if (onEnd) onEnd(); };
      utt.onerror = (e) => {
        // 'interrupted' means we cancelled it ourselves — not a real error
        if (e.error === "interrupted" || e.error === "canceled") return;
        console.error("[Luna TTS] error:", e.error);
        if (onErr) onErr(e.error);
      };
      if (synth.paused) synth.resume();
      synth.speak(utt);

      // Chrome sometimes queues but never starts — nudge it after 500ms if still not speaking
      setTimeout(() => {
        if (synth.pending && !synth.speaking) {
          synth.resume();
        }
      }, 500);
    }, 120);
  }

  function speakReply(text, msgEl) {
    if (!window.speechSynthesis) {
      console.warn("[Luna TTS] speechSynthesis not supported");
      return;
    }
    const clean = cleanForTTS(text);
    if (!clean) return;

    const langCode = LANG_CODES[chosenLanguage] || "en-US";
    const btn = msgEl ? msgEl.querySelector(".replay-btn") : null;

    // Clear previous playing state
    if (currentReplayBtn) currentReplayBtn.classList.remove("playing");
    currentReplayBtn = btn;
    if (btn) btn.classList.add("playing");

    const onEnd = () => { if (btn) btn.classList.remove("playing"); if (currentReplayBtn === btn) currentReplayBtn = null; };
    const onErr = () => { if (btn) btn.classList.remove("playing"); if (currentReplayBtn === btn) currentReplayBtn = null; };

    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      _doSpeak(clean, langCode, onEnd, onErr);
    } else {
      // Chrome loads voices asynchronously on first load
      window.speechSynthesis.onvoiceschanged = () => {
        _doSpeak(clean, langCode, onEnd, onErr);
      };
    }
  }

  function replayAudio(btn) {
    const msgEl = btn.closest(".msg");
    if (!msgEl || !msgEl.dataset.rawText) return;
    speakReply(msgEl.dataset.rawText, msgEl);
  }

  function stopSpeaking() {
    if (!window.speechSynthesis) return;
    if (ttsTimer) { clearTimeout(ttsTimer); ttsTimer = null; }
    try { window.speechSynthesis.cancel(); } catch(e) {}
    if (currentReplayBtn) { currentReplayBtn.classList.remove("playing"); currentReplayBtn = null; }
  }

  // Ensure voices are loaded (Chrome loads them async on first call)
  if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }

  // ── Voice Mode ────────────────────────────────────────────
  const voiceModeEl   = document.getElementById("voice-mode");
  const sphereWrap    = document.getElementById("sphere-wrap");
  const voiceStatus   = document.getElementById("voice-status");
  const voiceSubs     = document.getElementById("voice-subtitles");

  // Translation target per practice language
  const TRANSLATE_TO = { English: "Spanish", Spanish: "English", Portuguese: "Spanish" };

  let subTimer = null;

  function showSubtitle(text, role) {
    if (!voiceActive || !voiceSubs) return;
    // Clear previous subtitle
    if (subTimer) clearTimeout(subTimer);
    voiceSubs.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "vsub vsub-" + role;
    const mainEl = document.createElement("div");
    mainEl.className = "vsub-main";
    mainEl.textContent = text;
    const subEl = document.createElement("div");
    subEl.className = "vsub-sub";
    subEl.textContent = "…";
    wrap.appendChild(mainEl);
    wrap.appendChild(subEl);
    voiceSubs.appendChild(wrap);

    // Fade in
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add("show")));

    // Fetch translation asynchronously
    const toLang = TRANSLATE_TO[chosenLanguage] || "Spanish";
    fetch("/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, from: chosenLanguage, to: toLang }),
    })
      .then(r => r.json())
      .then(d => { if (subEl.isConnected) subEl.textContent = d.translation || ""; })
      .catch(() => { if (subEl.isConnected) subEl.textContent = ""; });

    // Fade out after 6 s
    subTimer = setTimeout(() => {
      wrap.classList.remove("show");
      setTimeout(() => { if (voiceSubs.contains(wrap)) voiceSubs.removeChild(wrap); }, 500);
    }, 6000);
  }

  let voiceActive   = false;
  let voiceListening = false;
  let voiceRec      = null;

  function setSphereState(state) {
    sphereWrap.dataset.state = state;
    voiceStatus.className = "";
    if (state === "listening") {
      voiceStatus.textContent = "Listening…";
      voiceStatus.classList.add("st-listening");
    } else if (state === "speaking") {
      voiceStatus.textContent = "Speaking…";
      voiceStatus.classList.add("st-speaking");
    } else {
      voiceStatus.textContent = "Tap to speak";
    }
  }

  function enterVoiceMode() {
    if (!chosenLanguage) return; // need to pick language first
    voiceActive = true;
    voiceModeEl.classList.remove("gone");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      voiceModeEl.classList.add("visible");
    }));
    setSphereState("idle");
    // auto-start listening after brief pause
    setTimeout(() => { if (voiceActive) voiceStartListen(); }, 600);
  }

  function exitVoiceMode(silent) {
    voiceActive = false;
    voiceStopListen();
    stopSpeaking();
    voiceModeEl.classList.remove("visible");
    setTimeout(() => voiceModeEl.classList.add("gone"), 400);
  }

  function voiceTap() {
    if (!voiceActive) return;
    if (voiceListening) { voiceStopListen(); setSphereState("idle"); }
    else { stopSpeaking(); voiceStartListen(); }
  }

  function voiceStartListen() {
    if (!SpeechRecognition || !voiceActive) return;
    if (!voiceRec) {
      voiceRec = new SpeechRecognition();
      voiceRec.continuous = false;
      voiceRec.interimResults = true;

      voiceRec.onstart = () => {
        voiceListening = true;
        setSphereState("listening");
      };

      voiceRec.onresult = (e) => {
        const t = Array.from(e.results).map(r => r[0].transcript).join("");
        if (e.results[e.results.length - 1].isFinal && t.trim()) {
          voiceStopListen();
          showSubtitle(t.trim(), "user");
          voiceSend(t.trim());
        }
      };

      voiceRec.onerror = () => { voiceListening = false; setSphereState("idle"); };
      voiceRec.onend   = () => { voiceListening = false; };
    }

    voiceRec.lang = LANG_CODES[chosenLanguage] || "en-US";
    try { voiceRec.start(); } catch(e) {}
  }

  function voiceStopListen() {
    voiceListening = false;
    try { if (voiceRec) voiceRec.stop(); } catch(e) {}
  }

  async function voiceSend(text) {
    if (!voiceActive) return;
    setSphereState("idle");

    try {
      console.log("[Luna Voice] Sending to /chat:", text.slice(0, 60));
      const res = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, language: chosenLanguage, difficulty: chosenDifficulty, mode: "voice" }),
      });
      const data = await res.json();

      if (!voiceActive) return;

      if (res.ok && data.reply) {
        console.log("[Luna Voice] Reply:", data.reply.slice(0, 60));
        setSphereState("speaking");
        showSubtitle(data.reply, "assistant");

        const clean   = cleanForTTS(data.reply);
        const langCode = LANG_CODES[chosenLanguage] || "en-US";

        const onEnd = () => {
          if (!voiceActive) return;
          setSphereState("idle");
          setTimeout(() => { if (voiceActive) voiceStartListen(); }, 700);
        };
        const onErr = (errCode) => {
          console.error("[Luna Voice TTS] Error:", errCode);
          if (!voiceActive) return;
          setSphereState("idle");
          setTimeout(() => { if (voiceActive) voiceStartListen(); }, 2000);
        };

        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          _doSpeak(clean, langCode, onEnd, onErr);
        } else {
          window.speechSynthesis.onvoiceschanged = () => {
            window.speechSynthesis.onvoiceschanged = null;
            _doSpeak(clean, langCode, onEnd, onErr);
          };
        }
      } else {
        console.error("[Luna Voice] API error:", data.error);
        setSphereState("idle");
        setTimeout(() => { if (voiceActive) voiceStartListen(); }, 2000);
      }
    } catch(err) {
      console.error("[Luna Voice] Network error:", err);
      setSphereState("idle");
      setTimeout(() => { if (voiceActive) voiceStartListen(); }, 2000);
    }
  }
</script>

</body>
</html>`);
});

export default router;
