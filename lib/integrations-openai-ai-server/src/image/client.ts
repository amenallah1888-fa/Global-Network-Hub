import fs from "node:fs";
import OpenAI, { toFile } from "openai";
import { Buffer } from "node:buffer";

const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const managedKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const standardKey = process.env.OPENAI_API_KEY;

function createClient(): OpenAI | null {
  if (baseURL && managedKey) return new OpenAI({ apiKey: managedKey, baseURL });
  if (standardKey) return new OpenAI({ apiKey: standardKey });
  return null;
}

export const openai = createClient();

export async function generateImageBuffer(
  prompt: string,
  size: "1024x1024" | "512x512" | "256x256" = "1024x1024"
): Promise<Buffer> {
  if (!openai) throw new Error("OpenAI client not configured");
  const response = await openai.images.generate({
    model: "gpt-image-1",
    prompt,
    size,
  });
  const base64 = response.data[0]?.b64_json ?? "";
  return Buffer.from(base64, "base64");
}

export async function editImages(
  imageFiles: string[],
  prompt: string,
  outputPath?: string
): Promise<Buffer> {
  if (!openai) throw new Error("OpenAI client not configured");
  const images = await Promise.all(
    imageFiles.map((file) =>
      toFile(fs.createReadStream(file), file, { type: "image/png" })
    )
  );

  const response = await openai.images.edit({
    model: "gpt-image-1",
    image: images,
    prompt,
  });

  const imageBase64 = response.data[0]?.b64_json ?? "";
  const imageBytes = Buffer.from(imageBase64, "base64");

  if (outputPath) {
    fs.writeFileSync(outputPath, imageBytes);
  }

  return imageBytes;
}
