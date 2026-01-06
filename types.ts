export type Language = 'en' | 'ja';

export interface Persona {
  id: string;
  name: string;
  role: string;
  company: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert';
  description: string;
  objections: string[];
  systemInstruction: string;
  avatarUrl: string;
}

export interface RubricItem {
  category: string;
  score: number; // 0-10
  feedback: string;
}

export interface CallSession {
  id: string;
  timestamp: number;
  playerName: string;
  personaId: string;
  durationSeconds: number;
  transcript: string;
  overallScore: number; // 0-100
  rubric: RubricItem[];
  summary: string;
}

export interface AudioState {
  isPlaying: boolean;
  volume: number; // 0-1 for visualization
}

export enum AppState {
  DASHBOARD = 'DASHBOARD',
  IN_CALL = 'IN_CALL',
  FEEDBACK = 'FEEDBACK',
  LEADERBOARD = 'LEADERBOARD'
}