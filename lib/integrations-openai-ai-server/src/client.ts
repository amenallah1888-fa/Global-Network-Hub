import OpenAI from "openai";

const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const managedKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const standardKey = process.env.OPENAI_API_KEY;

function createClient(): OpenAI | null {
  if (baseURL && managedKey) {
    return new OpenAI({ apiKey: managedKey, baseURL });
  }
  if (standardKey) {
    return new OpenAI({ apiKey: standardKey });
  }
  return null;
}

export const openai = createClient();
