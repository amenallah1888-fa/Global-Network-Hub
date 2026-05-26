import OpenAI, { toFile } from "openai";
import { Buffer } from "node:buffer";
import { spawn } from "child_process";
import { writeFile, unlink, readFile } from "fs/promises";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { join } from "path";

const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const managedKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const standardKey = process.env.OPENAI_API_KEY;

function createClient(): OpenAI | null {
  if (baseURL && managedKey) return new OpenAI({ apiKey: managedKey, baseURL });
  if (standardKey) return new OpenAI({ apiKey: standardKey });
  return null;
}

export const openai = createClient();

export type AudioFormat = "wav" | "mp3" | "webm" | "mp4" | "ogg" | "unknown";

export function detectAudioFormat(buffer: Buffer): AudioFormat {
  if (buffer.length < 12) return "unknown";
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return "wav";
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return "webm";
  if (
    (buffer[0] === 0xff && (buffer[1] === 0xfb || buffer[1] === 0xfa || buffer[1] === 0xf3)) ||
    (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33)
  ) return "mp3";
  if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) return "mp4";
  if (buffer[0] === 0x4f && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) return "ogg";
  return "unknown";
}

export async function convertToWav(audioBuffer: Buffer): Promise<Buffer> {
  const inputPath = join(tmpdir(), `input-${randomUUID()}`);
  const outputPath = join(tmpdir(), `output-${randomUUID()}.wav`);
  try {
    await writeFile(inputPath, audioBuffer);
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", ["-i", inputPath, "-vn", "-f", "wav", "-ar", "16000", "-ac", "1", "-acodec", "pcm_s16le", "-y", outputPath]);
      ffmpeg.stderr.on("data", () => {});
      ffmpeg.on("close", (code) => { if (code === 0) resolve(); else reject(new Error(`ffmpeg exited with code ${code}`)); });
      ffmpeg.on("error", reject);
    });
    return await readFile(outputPath);
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

export async function ensureCompatibleFormat(audioBuffer: Buffer): Promise<{ buffer: Buffer; format: "wav" | "mp3" }> {
  const detected = detectAudioFormat(audioBuffer);
  if (detected === "wav") return { buffer: audioBuffer, format: "wav" };
  if (detected === "mp3") return { buffer: audioBuffer, format: "mp3" };
  const wavBuffer = await convertToWav(audioBuffer);
  return { buffer: wavBuffer, format: "wav" };
}

export async function voiceChat(
  audioBuffer: Buffer,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy",
  inputFormat: "wav" | "mp3" = "wav",
  outputFormat: "wav" | "mp3" = "mp3"
): Promise<{ transcript: string; audioResponse: Buffer }> {
  if (!openai) throw new Error("OpenAI client not configured");
  const audioBase64 = audioBuffer.toString("base64");
  const response = await openai.chat.completions.create({
    model: "gpt-audio",
    modalities: ["text", "audio"],
    audio: { voice, format: outputFormat },
    messages: [{ role: "user", content: [{ type: "input_audio", input_audio: { data: audioBase64, format: inputFormat } }] }],
  });
  const message = response.choices[0]?.message as any;
  return {
    transcript: message?.audio?.transcript || message?.content || "",
    audioResponse: Buffer.from(message?.audio?.data ?? "", "base64"),
  };
}

export async function voiceChatStream(
  audioBuffer: Buffer,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy",
  inputFormat: "wav" | "mp3" = "wav"
): Promise<AsyncIterable<{ type: "transcript" | "audio"; data: string }>> {
  if (!openai) throw new Error("OpenAI client not configured");
  const audioBase64 = audioBuffer.toString("base64");
  const stream = await openai.chat.completions.create({
    model: "gpt-audio",
    modalities: ["text", "audio"],
    audio: { voice, format: "pcm16" },
    messages: [{ role: "user", content: [{ type: "input_audio", input_audio: { data: audioBase64, format: inputFormat } }] }],
    stream: true,
  });
  return (async function* () {
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta as any;
      if (!delta) continue;
      if (delta?.audio?.transcript) yield { type: "transcript", data: delta.audio.transcript };
      if (delta?.audio?.data) yield { type: "audio", data: delta.audio.data };
    }
  })();
}

export async function textToSpeech(text: string, voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy", format: "wav" | "mp3" | "flac" | "opus" | "pcm16" = "wav"): Promise<Buffer> {
  if (!openai) throw new Error("OpenAI client not configured");
  const response = await openai.chat.completions.create({
    model: "gpt-audio",
    modalities: ["text", "audio"],
    audio: { voice, format },
    messages: [
      { role: "system", content: "You are an assistant that performs text-to-speech." },
      { role: "user", content: `Repeat the following text verbatim: ${text}` },
    ],
  });
  const audioData = (response.choices[0]?.message as any)?.audio?.data ?? "";
  return Buffer.from(audioData, "base64");
}

export async function textToSpeechStream(text: string, voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy"): Promise<AsyncIterable<string>> {
  if (!openai) throw new Error("OpenAI client not configured");
  const stream = await openai.chat.completions.create({
    model: "gpt-audio",
    modalities: ["text", "audio"],
    audio: { voice, format: "pcm16" },
    messages: [
      { role: "system", content: "You are an assistant that performs text-to-speech." },
      { role: "user", content: `Repeat the following text verbatim: ${text}` },
    ],
    stream: true,
  });
  return (async function* () {
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta as any;
      if (delta?.audio?.data) yield delta.audio.data;
    }
  })();
}

export async function speechToText(audioBuffer: Buffer, format: "wav" | "mp3" | "webm" = "wav"): Promise<string> {
  if (!openai) throw new Error("OpenAI client not configured");
  const file = await toFile(audioBuffer, `audio.${format}`);
  const response = await openai.audio.transcriptions.create({ file, model: "gpt-4o-mini-transcribe" });
  return response.text;
}

export async function speechToTextStream(audioBuffer: Buffer, format: "wav" | "mp3" | "webm" = "wav"): Promise<AsyncIterable<string>> {
  if (!openai) throw new Error("OpenAI client not configured");
  const file = await toFile(audioBuffer, `audio.${format}`);
  const stream = await openai.audio.transcriptions.create({ file, model: "gpt-4o-mini-transcribe", stream: true });
  return (async function* () {
    for await (const event of stream) {
      if (event.type === "transcript.text.delta") yield event.delta;
    }
  })();
}
