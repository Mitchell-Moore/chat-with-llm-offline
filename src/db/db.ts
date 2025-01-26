import Dexie, { EntityTable } from 'dexie';

interface Chat {
  id: number;
  title?: string;
  timestamp: Date; // Timestamp of the chat creation
}

interface Message {
  id: number;
  chatId: number; // ID of the chat session
  role: 'user' | 'assistant'; // Role of the sender
  content: string; // Chat message content
  timestamp: Date; // Timestamp of the message
}

const db = new Dexie('database') as Dexie & {
  chats: EntityTable<
    Chat,
    'id' // primary key "id" (for the typings only)
  >;
  messages: EntityTable<
    Message,
    'id' // primary key "id" (for the typings only)
  >;
};

// Schema declaration:
db.version(1).stores({
  chats: '++id, title, timestamp', // primary key "id" (for the runtime!)
  messages: '++id, chatId, role, content, timestamp', // primary key "id" (for the runtime!)
});

export type { Chat, Message };
export { db };
