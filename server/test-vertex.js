import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION || 'global',
});

const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: 'Reply with exactly: Lunelle Vertex AI test successful',
});

console.log(response.text);