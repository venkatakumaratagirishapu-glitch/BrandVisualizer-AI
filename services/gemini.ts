
import { GoogleGenAI } from "@google/genai";
import { MarketingMedium, AspectRatio } from "../types";

// Advanced config interface for creative controls
export interface AdvancedConfig {
  temperature?: number;
  topK?: number;
  topP?: number;
  seed?: number;
}

// Initialize the Gemini API client using the environment variable exclusively.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const visualizeProduct = async (
  sourceImageBase64: string,
  medium: MarketingMedium,
  description: string,
  aspectRatio: AspectRatio = "1:1",
  advancedConfig: AdvancedConfig = {}
): Promise<string> => {
  try {
    // Extract base64 data correctly (remove prefix if present)
    const base64Data = sourceImageBase64.split(',')[1] || sourceImageBase64;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: 'image/png',
            },
          },
          {
            text: `Place this product/logo design onto a high-quality ${medium}. ${description} 
                   The design from the source image must be clearly visible, sharp, and perfectly integrated into the surface of the ${medium}. 
                   Maintain the original colors, typography, and proportions of the uploaded product logo. 
                   The lighting and shadows should look realistic and professional for a marketing campaign.
                   The final image should have a ${aspectRatio} aspect ratio.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio
        },
        temperature: advancedConfig.temperature,
        topK: advancedConfig.topK,
        topP: advancedConfig.topP,
        seed: advancedConfig.seed
      }
    });

    // Check for finish reason or safety blocks if content is missing
    if (response.candidates && response.candidates[0].finishReason === 'SAFETY') {
      throw new Error("SAFETY_BLOCK: Content was blocked by safety filters. Try a different image or prompt.");
    }

    // Find the image part in the response
    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    
    throw new Error("EMPTY_RESPONSE: The model responded successfully but did not include an image part.");
  } catch (error: any) {
    const errorMessage = error.message || "Unknown error";
    
    // Pattern matching for specific API errors
    if (errorMessage.includes("429")) {
      throw new Error("RATE_LIMIT: API rate limit exceeded. Please wait a minute before retrying.");
    } else if (errorMessage.includes("401")) {
      throw new Error("AUTH_ERROR: Invalid API key. Please contact support or check your environment variables.");
    } else if (errorMessage.includes("403")) {
      throw new Error("PERMISSION_ERROR: Access denied. Check your project permissions or billing status.");
    } else if (errorMessage.includes("400")) {
      throw new Error("BAD_REQUEST: The request was invalid. This may be due to a large image or restricted content.");
    } else if (errorMessage.includes("500") || errorMessage.includes("503")) {
      throw new Error("SERVER_ERROR: Gemini servers are currently busy or unavailable.");
    }
    
    console.error("Gemini API Error Detail:", error);
    throw error;
  }
};
