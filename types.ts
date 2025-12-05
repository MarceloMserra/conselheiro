export enum Role {
  USER = 'user',
  MODEL = 'model'
}

export enum UserProfile {
  MARCELO = 'Marcelo',
  FERNANDA = 'Fernanda'
}

export interface Source {
  title: string;
  uri: string;
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  timestamp: Date;
  isError?: boolean;
  sources?: Source[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  lastModified: number; // timestamp
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  currentUser: UserProfile;
}
