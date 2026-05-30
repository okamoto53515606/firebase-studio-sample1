import { googleAI } from '@genkit-ai/google-genai';
import { genkit } from 'genkit';

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-3.1-pro-preview',
});
