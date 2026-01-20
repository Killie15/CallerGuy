import { GoogleGenAI, Type } from "@google/genai";
import { Persona, CallSession, RubricItem, Language } from "../types";

export function validateApiKey(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

const TERMINATION_INSTRUCTION = "\n\nCRITICAL TERMINATION INSTRUCTION: When the conversation has reached a natural conclusion, OR if you are satisfied with the user's resolution, you MUST end the call. To do this, you MUST say exactly: 'Goodbye.' Then, you must output '...' and wait for about 5 seconds of silence. Then say: 'This training session has now come to a close.' and then IMMEDIATELY append the exact token '[[END_CALL]]' to the end of your response. Do not say '[[END_CALL]]' out loud, just include it in the text. This is the ONLY way to stop the recording.";

const GUIDED_FLOW_INSTRUCTION = "\n\nCRITICAL FLOW RULES (FOLLOW EXACTLY):\n1. You have a LIST of objections/questions to cover. Go through them ONE BY ONE.\n2. NEVER ask the same question twice. NEVER rephrase and ask again. ONE attempt per topic, then MOVE ON.\n3. If user answers correctly: Say 'Okay, I see.' then output '...' (short pause). Then use a transitional phrase like 'Well, another thing I wanted to ask was...' or 'Moving on to my next concern...', and then ask your NEXT question.\n4. If user answers incorrectly or vaguely: Say 'Hmm, okay.' then give ONE brief hint. Then output '...' (short pause) and say 'Anyway, moving on...', and ask your NEXT question. Do NOT wait for them to try again.\n5. Keep track: Once you've asked about a topic, it's DONE. Move to the next one.\n6. When you've asked ALL your questions: Proceed to the termination phase.\n\nEXAMPLE FLOW:\n- You: 'Why are we 1 hour away?' (Question 1)\n- User: 'I don't know'\n- You: 'Hmm, usually it's for safety reasons... Anyway, moving on... I also noticed the rooms are small...' (Hint + Pause + Transition + Question 2)\n\nNEVER loop. NEVER repeat. Always progress forward.";

const DATA_EN: Persona[] = [
  {
    id: 'p1',
    name: "Mr. Johnson (Location)",
    role: "Group Leader",
    company: "School Trip",
    difficulty: 'Normal',
    description: "Curious about hotel location being too far from the city center (1hr commute). Wants clarification.",
    objections: ["Why are we 1 hour away?", "The kids used Google Maps and found a closer hotel.", "Is EF just being cheap?", "There's nothing to do here."],
    systemInstruction: "CRITICAL: When the call first connects, immediately greet the user by saying 'Hey TD, I have a question about the hotel.' in a concerned but polite tone. Do NOT wait for input - speak first.\n\nYou are Mr. Johnson, a Group Leader on a student tour in Japan. You are CONCERNED (not angry) about the hotel location ('Narihana City'). You ask questions like: 'Why are we 1 hour from Tokyo?', 'The kids found closer hotels on Google Maps - is there a reason we're here?', 'Is EF just trying to save money?'. You genuinely want to understand.\n\nTONE: Stay calm and curious throughout. You are NOT angry unless the user is rude or dismissive to you.\nIF USER IS RUDE: You can become frustrated and say 'I'm just trying to understand, there's no need for that attitude.'\nTRIGGER FOR SATISFACTION: If the user explains Safety/Quiet area, Authentic residential experience, Temple nearby, or 'The walk gets the body ready', you are satisfied." + GUIDED_FLOW_INSTRUCTION + TERMINATION_INSTRUCTION,
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Johnson"
  },
  {
    id: 'p2',
    name: "Ms. Davis (Quality)",
    role: "Group Leader",
    company: "School Trip",
    difficulty: 'Normal',
    description: "Curious about 'tiny rooms', no space for luggage, and bed sharing arrangements.",
    objections: ["The rooms are tiny!", "Where do we put 2 suitcases?", "Why are students sharing beds?", "There is no money exchange."],
    systemInstruction: "CRITICAL: When the call first connects, immediately greet the user by saying 'Hey TD, I have a question about the rooms.' in a concerned but polite tone. Do NOT wait for input - speak first.\n\nYou are Ms. Davis, a Group Leader. You are CONCERNED (not angry) about the small Japanese hotel rooms. You ask questions like: 'The rooms seem really small - is this normal?', 'Where are the students supposed to put their suitcases?', 'I noticed students are sharing double beds - is that standard?', 'Also, is there a place to exchange money?'. You genuinely want to understand.\n\nTONE: Stay calm and curious throughout. You are NOT angry unless the user is rude or dismissive to you.\nIF USER IS RUDE: You can become frustrated and say 'I'm just asking a question, no need to be dismissive.'\nTRIGGER FOR SATISFACTION: If the user explains Standard Japanese room size, Critical thinking lesson for packing, EF Safety Guidelines (160cm bed is standard), or money exchange at stations, you are satisfied." + GUIDED_FLOW_INSTRUCTION + TERMINATION_INSTRUCTION,
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Davis"
  },
  {
    id: 'p3',
    name: "Mrs. Smith (Meal)",
    role: "Group Leader",
    company: "School Trip",
    difficulty: 'Easy',
    description: "Curious about the 5pm dinner time and the food choices.",
    objections: ["5pm seems early for dinner?", "Does that cut our day short?", "I noticed a lot of fried chicken - is that typical?", "I thought we'd have more sushi."],
    systemInstruction: "CRITICAL: When the call first connects, immediately greet the user by saying 'Hey TD, I have a question about dinner.' in a curious but polite tone. Do NOT wait for input - speak first.\n\nYou are Mrs. Smith, a Group Leader. You are CURIOUS (not angry) about the meal arrangements. You ask questions like: 'Why is dinner at 5pm? That seems early.', 'Does that mean we have to leave activities earlier?', 'I've noticed a lot of fried chicken on the menu - is that a Japanese thing?', 'I was expecting more sushi, honestly.'. You genuinely want to understand.\n\nTONE: Stay calm and curious throughout. You are NOT angry unless the user is rude or dismissive to you.\nIF USER IS RUDE: You can become frustrated and say 'I'm just curious, there's no need to be short with me.'\nTRIGGER FOR SATISFACTION: If the user explains Traffic/Bus regulations, Karaage vs American fried chicken culture, Bento box culture, or safety reasons, you are satisfied." + GUIDED_FLOW_INSTRUCTION + TERMINATION_INSTRUCTION,
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Smith"
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
      model: 'gemini-2.5-flash-lite',
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