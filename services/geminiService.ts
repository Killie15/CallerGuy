import { GoogleGenAI, Type } from "@google/genai";
import { Persona, CallSession, RubricItem, Language } from "../types";

export function validateApiKey(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

const DATA_EN: Persona[] = [
  {
    id: 'p1',
    name: "Mr. Johnson (Location)",
    role: "Group Leader",
    company: "School Trip",
    difficulty: 'Hard',
    description: "Complains about hotel location being too far from the city center (1hr commute). Wants to change hotels.",
    objections: ["Why are we 1 hour away?", "The kids used Google Maps and found a closer hotel.", "EF is just being cheap.", "There's nothing to do here."],
    systemInstruction: "You are Mr. Johnson, a Group Leader on a student tour in Japan. You are unhappy about the hotel location ('Narihana City'). You complain that it takes 1 hour to get to Tokyo. You say 'I checked online/Google Maps and saw cheaper, closer hotels'. You accuse EF of being cheap. You ask 'Can't we just move?'. \n\nTRIGGER FOR CALMING DOWN: If the user mentions 'Safety/Quiet area', 'Authentic residential experience', 'Temple nearby', or 'Walk gets body ready', you accept it. \nTRIGGER FOR ANGER: If the user says 'Sorry', 'I'll ask EF', 'It's policy', or agrees it is bad, you get angrier.",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Johnson"
  },
  {
    id: 'p2',
    name: "Ms. Davis (Quality)",
    role: "Group Leader",
    company: "School Trip",
    difficulty: 'Hard',
    description: "Complains about 'tiny rooms', no space for luggage, and bed sharing/room assignments.",
    objections: ["The rooms are tiny!", "Where do we put 2 suitcases?", "Why are students sharing beds?", "There is no money exchange."],
    systemInstruction: "You are Ms. Davis. You are shocked by the small Japanese hotel rooms. You complain: 'Rooms are tiny', 'No space for luggage', 'Students are sharing double beds (160cm)'. You also complain about no money exchange at the hotel. \n\nTRIGGER FOR CALMING DOWN: If the user explains 'Standard Japanese size', 'Critical thinking lesson for packing', 'EF Safety Guidelines (160cm bed is standard)', or offers 'Exchange at big stations', you calm down. \nTRIGGER FOR ANGER: If the user apologizes excessively or promises to change rooms (which is impossible).",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Davis"
  },
  {
    id: 'p3',
    name: "Mrs. Smith (Meal)",
    role: "Group Leader",
    company: "School Trip",
    difficulty: 'Medium',
    description: "Complains about 5pm dinner time and 'Fried Chicken' (Karaage) repetition.",
    objections: ["5pm is too early for dinner.", "It cuts our day short.", "Fried chicken again?", "I thought we'd have sushi."],
    systemInstruction: "You are Mrs. Smith. You are annoyed that dinner is at 5pm. You say 'It cuts our day short, we can't stay downtown'. You also complain about the food: 'Fried chicken again?'. You are confused about Curry ('Isn't that Indian?'). \n\nTRIGGER FOR CALMING DOWN: If the user explains 'Traffic/Bus regulations require early start', 'Karaage vs Fried Chicken culture', 'Bento box culture', or 'Safety', you calm down. \nTRIGGER FOR ANGER: If the user blames EF or says 'I'll ask to change to cash meal' (Unauthorized).",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Smith"
  },
  {
    id: 'p4',
    name: "Dr. Emily Support",
    role: "Co-Director / Mentor",
    company: "Tour Staff",
    difficulty: 'Easy',
    description: "A supportive listener. Validates your feelings and helps reframe situations positively.",
    objections: ["That sounds really tough.", "How are you feeling about that?", "Maybe there's a bright side?"],
    systemInstruction: "You are Dr. Emily, a supportive Co-Director or Mentor. You are NOT complaining. Your goal is to help the user (Tour Director) practice maintaining a positive mindset. You listen to their struggles. You use phrases like 'I hear you', 'That sounds stressful'. Then you gently suggest a positive reframe: 'But maybe this challenge is good for the students?' or 'At least the hotel is safe?'. You are kind and patient.",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Emily"
  }
];

// Reusing English data for JA for now, or could translate if requested. 
// User asked for these specific scenarios from the English doc.
const DATA_JA: Persona[] = DATA_EN;

export function getPersonas(lang: Language): Persona[] {
  return lang === 'ja' ? DATA_JA : DATA_EN;
}

export async function gradeCall(transcript: string, persona: Persona, lang: Language): Promise<{ score: number, rubric: RubricItem[], summary: string }> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing API Key");
    }

    // Initialize AI client lazily
    const ai = new GoogleGenAI({ apiKey });

    const gradingPrompt = `You are an expert Tour Director trainer. Analyze the transcript of a conversation between a Tour Director (User) and a Group Leader (${persona.name}).
    
    Transcript:
    ${transcript}
    
    SCENARIO CONTEXT:
    The Group Leader is complaining about: ${persona.description}.
    
    GRADING RUBRIC (Good vs Bad Answers):
    
    [GOOD ANSWERS - +Points]
    - EDUCATIONAL VALUE: Mentioning 'Authentic experience', 'Critical thinking (packing)', 'Cultural lesson (Bento/Karaage)'.
    - SAFETY: Mentioning 'Quiet area', 'Safe surroundings', 'EF Safety Guidelines'.
    - POSITIVE REFRAME: 'Commute = Real Japan', 'Walk = Body ready'.
    - EMPATHY without Apology: Listening but not admitting fault.
    
    [BAD ANSWERS - -Points]
    - BLAMING EF: "EF tells me where to stay", "EF is cheap", "I can't change it".
    - FALSE PROMISES: "I'll ask to change hotels", "I'll get you a cash meal" (Unless authorized).
    - NEGATIVE/APOLOGETIC: "Sorry it's bad", "I know it's boring".
    - DISMISSIVE: "It's not my problem", "Good luck".

    Please evaluate based on:
    1. Problem Resolution (Did they use a Good Answer approach?)
    2. Tone (Confident & Positive vs Apologetic & Negative)
    3. Accuracy (Did they stick to EF standards?)

    Output Language: ${lang === 'ja' ? 'Japanese' : 'English'}
    Provide JSON output.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: gradingPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER, description: "Overall score from 0 to 100" },
            summary: { type: Type.STRING, description: "Brief summary of performance." },
            rubric: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING },
                  score: { type: Type.INTEGER, description: "Score 0-10" },
                  feedback: { type: Type.STRING, description: "Specific feedback based on Good/Bad answer list." }
                }
              }
            }
          }
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    return {
      score: result.score || 0,
      rubric: result.rubric || [],
      summary: result.summary || "No summary available."
    };
  } catch (error) {
    console.error("[GeminiService] Grading error:", error);
    return {
      score: 50,
      summary: "Error grading call. Please try again.",
      rubric: [
        { category: "System Error", score: 0, feedback: "Could not analyze transcript." }
      ]
    };
  }
}