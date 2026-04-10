import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function getJoke(mood: string, zone: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `The user is feeling ${mood}. They want a joke from the "${zone}" zone. Tell a funny, uplifting joke to make them happy. Keep it short and clean.`,
      config: {
        systemInstruction: "You are a professional comedian who specializes in uplifting and clean humor. Your goal is to make people smile based on their current mood and preferred humor style.",
      }
    });
    return response.text || "I couldn't think of a joke right now, but remember: you're awesome!";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Oops! My funny bone is broken. Try again in a moment!";
  }
}
