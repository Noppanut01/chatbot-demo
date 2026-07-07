require("dotenv").config();
const crypto = require("crypto");
const express = require("express");
const axios = require("axios");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// LINE requires the raw body to verify the signature, so we keep it around
// instead of letting express.json() throw it away.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

function isValidSignature(req) {
  const signature = req.get("x-line-signature");
  if (!signature || !CHANNEL_SECRET) return false;
  const hash = crypto
    .createHmac("SHA256", CHANNEL_SECRET)
    .update(req.rawBody)
    .digest("base64");
  return hash === signature;
}

// In a group/room, LINE marks the mentionee with isSelf: true when the bot
// itself is tagged — that's how we tell "someone @mentioned the bot" apart
// from an ordinary message or an @mention of another member.
function isBotMentioned(message) {
  return Boolean(message.mention?.mentionees?.some((m) => m.isSelf));
}

// Strip the "@BotName" text out before sending it to Gemini, so the model
// answers the actual question instead of reacting to the mention itself.
function stripSelfMentions(message) {
  const selfRanges = (message.mention?.mentionees || []).filter((m) => m.isSelf);
  let text = message.text;
  for (const { index, length } of [...selfRanges].sort((a, b) => b.index - a.index)) {
    text = text.slice(0, index) + text.slice(index + length);
  }
  return text.trim();
}

async function getReplyText(userMessage) {
  const interaction = await ai.interactions.create({
    model: "gemini-2.5-flash",
    input: userMessage,
  });
  return interaction.output_text;
}

const LINE_TEXT_MAX_LENGTH = 5000;

async function replyToLine(replyToken, text) {
  const truncatedText =
    text.length > LINE_TEXT_MAX_LENGTH
      ? text.slice(0, LINE_TEXT_MAX_LENGTH - 1) + "…"
      : text;

  await axios.post(
    "https://api.line.me/v2/bot/message/reply",
    {
      replyToken,
      messages: [{ type: "text", text: truncatedText }],
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
      },
    }
  );
}

app.post("/webhook", async (req, res) => {
  if (!isValidSignature(req)) {
    return res.status(401).send("invalid signature");
  }

  // Serverless platforms freeze the function once a response is sent, so
  // every reply must finish before we respond — no fire-and-forget here.
  const events = req.body.events || [];
  for (const event of events) {
    if (event.type !== "message" || event.message.type !== "text") continue;

    const isGroupOrRoom = event.source.type === "group" || event.source.type === "room";
    // In 1-on-1 chat every message is meant for the bot; in a group/room
    // only reply when someone actually @mentions it, to avoid spamming
    // everyone else's messages.
    if (isGroupOrRoom && !isBotMentioned(event.message)) continue;

    const userText = isGroupOrRoom
      ? stripSelfMentions(event.message)
      : event.message.text;

    const replyText = await getReplyText(userText);
    try {
      await replyToLine(event.replyToken, replyText);
    } catch (err) {
      console.error("LINE reply failed:", err.response?.data || err.message);
    }
  }

  res.status(200).send("OK");
});

app.get("/", (_req, res) => {
  res.send("LINE OA chatbot demo is running");
});

module.exports = app;
