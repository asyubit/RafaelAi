import OpenAI, { toFile } from "openai";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function bodyOf(req) {
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body || {};
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }
  if (!openai) {
    return res.status(500).json({ error: "OPENAI_API_KEY が未設定です。" });
  }

  const body = bodyOf(req);
  const action = String(body.action || "");

  try {
    if (action === "ask") {
      const question = String(body.question || "").trim();
      if (!question) return res.status(400).json({ error: "質問が空です。" });

      const response = await openai.responses.create({
        model: "gpt-5.6-luna",
        instructions: [
          "あなたは『ラファエル』という日本語音声AIです。",
          "神聖で静か、知的で上品、少し威厳のある話し方をしてください。",
          "返答の最初は必ず次のどれか一語から始めてください。",
          "正しい・肯定なら『是、』。誤り・否定なら『否、』。説明なら『解、』。判断できないなら『不明、』。",
          "通常は2〜4文程度で簡潔に答えてください。",
          "断定できない情報は断定しないでください。"
        ].join("\n"),
        input: question
      });

      return res.status(200).json({
        answer: response.output_text || "不明、うまく答えを作れませんでした。"
      });
    }

    if (action === "speak") {
      const text = String(body.text || "").trim().slice(0, 1800);
      if (!text) return res.status(400).json({ error: "読み上げる文章がありません。" });

      const audio = await openai.audio.speech.create({
        model: "gpt-4o-mini-tts",
        voice: "shimmer",
        input: text,
        instructions: "Japanese. Speak with a serene, sacred, feminine goddess-like voice. Calm, clear, elegant, intelligent, slightly solemn and dignified. Warm but not cute. Speak a little slowly with controlled emotion and a mysterious presence."
      });

      const buffer = Buffer.from(await audio.arrayBuffer());
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).send(buffer);
    }

    if (action === "transcribe") {
      const base64 = String(body.audio || "");
      const mime = String(body.mime || "audio/webm");
      if (!base64) return res.status(400).json({ error: "音声がありません。" });

      const buffer = Buffer.from(base64, "base64");
      const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
      const file = await toFile(buffer, `speech.${ext}`, { type: mime });
      const tr = await openai.audio.transcriptions.create({
        model: "gpt-4o-mini-transcribe",
        file,
        language: "ja"
      });
      return res.status(200).json({ text: tr.text || "" });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error?.message || "処理に失敗しました。" });
  }
}
