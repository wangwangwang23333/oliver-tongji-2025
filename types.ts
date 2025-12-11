export enum Gender {
  Male = 'Male',
  Female = 'Female',
}

export enum TimeSlot {
  Morning = 'Morning',
  Afternoon = 'Afternoon',
  Evening = 'Evening',
}

export interface CharacterStats {
  academic: number;
  research: number;
  social: number;
  mood: number;
  energy: number;
  money: number;
}

export interface Relationship {
  name: string;
  affinity: number;
  status: 'Stranger' | 'Acquaintance' | 'Friend' | 'Close Friend' | 'Dating' | 'Partner';
  description: string;
}

export interface Message {
  id: string;
  sender: string;
  content: string;
  isRead: boolean;
  timestamp: string;
}

export interface Wish {
  id: string;
  type: 'career' | 'love' | 'social';
  label: string;
  description: string;
  targetValue?: number; // For stat checks
  targetId?: string; // For relationship checks
  isCompleted: boolean;
}

export interface GameState {
  playerName: string;
  gender: Gender;
  week: number;
  day: number;
  timeSlot: TimeSlot;
  stats: CharacterStats;
  lastWeekStats: CharacterStats;
  relationships: Relationship[];
  messages: Message[];
  wishes: Wish[]; // New: Birthday wishes
  history: LogEntry[];
  isGameOver: boolean;
  gameEnding?: { // Structured ending
    career: string;
    love: string;
    birthday: string;
  }; 
}

export interface LogEntry {
  id: string;
  text: string;
  type: 'narrative' | 'event' | 'system' | 'choice';
  turn: number;
  feedback?: {
    stats: string;
    time: string;
  };
}

export interface GameActionResponse {
  narrative: string;
  statChanges: Partial<CharacterStats>;
  relationshipUpdates?: { name: string; change: number }[];
  sms?: { sender: string; content: string };
  eventTriggered?: boolean;
  choices?: string[];
}
