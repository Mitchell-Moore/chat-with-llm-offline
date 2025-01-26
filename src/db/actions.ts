import { db, Chat, Message } from './db';

export const createChat = async (chat: Omit<Chat, 'id' | 'timestamp'>) => {
  const newChatId = await db.chats.add({
    title: chat.title,
    timestamp: new Date(),
  });
  localStorage.setItem('chatId', newChatId.toString());
  return newChatId;
};

export const getCurrentChat = async () => {
  const chatId = localStorage.getItem('chatId');
  if (!chatId) {
    return null;
  }
  return await db.chats.get(Number(chatId));
};

export const getChat = async (chatId: number) => {
  return await db.chats.get(chatId);
};

export const saveMessage = async (
  message: Omit<Message, 'id' | 'timestamp'>
) => {
  await db.messages.add({
    chatId: message.chatId,
    role: message.role,
    content: message.content,
    timestamp: new Date(),
  });
};

export const getMessages = async (chatId: number) => {
  return await db.messages.where('chatId').equals(chatId).sortBy('timestamp');
};
