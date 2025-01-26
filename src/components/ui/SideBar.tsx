import { useEffect } from 'react';
import { useState } from 'react';
import { getChats } from '../../db/actions';
import { NewChatIcon } from './icons';

import { SidebarIcon } from './icons';
import { Chat } from '../../db/db';

interface SideBarProps {
  isSidebarOpen: boolean;
  onSidebarClick: () => void;
  newChatOnClick: () => void;
  onChatSelect: (chatId: number) => void;
  currentChatId: number | undefined;
}

export const SideBar = ({
  isSidebarOpen,
  onSidebarClick,
  newChatOnClick,
  onChatSelect,
  currentChatId,
}: SideBarProps) => {
  const [chats, setChats] = useState<Chat[]>([]);

  useEffect(() => {
    async function loadChats() {
      const chatList = await getChats();

      const sortedChats = chatList.sort((a, b) => {
        // Put current chat at the top
        if (a.id === currentChatId) {
          return -1;
        }
        if (b.id === currentChatId) {
          return 1;
        }
        // Sort remaining chats by timestamp descending
        return -1;
      });

      setChats(sortedChats);
    }

    loadChats();
  }, []);

  return (
    <div
      className={`bg-gray-50 w-64 transition-all duration-300 ease-in-out transform ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } fixed top-0 left-0 h-full z-20`}
    >
      <div className="px-3">
        <div className="w-full h-20 flex justify-end items-center">
          <div
            className="flex items-center  rounded-md hover:bg-gray-100 p-1.5 cursor-pointer "
            onClick={onSidebarClick}
          >
            <SidebarIcon />
          </div>
          <div
            className="flex items-center justify-center rounded-md hover:bg-gray-100 p-1.5 cursor-pointer"
            onClick={newChatOnClick}
          >
            <NewChatIcon />
          </div>
        </div>
        <div className=" space-y-0.5 overflow-y-scroll h-[calc(100vh-100px)]">
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => onChatSelect?.(chat.id)}
              className={`p-2 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 ${
                currentChatId === chat.id ? 'bg-gray-200 dark:bg-gray-700' : ''
              }`}
            >
              Chat {chat.title}
              <div className="text-sm text-gray-500">
                {chat.timestamp &&
                  new Date(chat.timestamp).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
