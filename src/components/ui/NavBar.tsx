import { SidebarIcon, NewChatIcon } from './icons';

interface NavBarProps {
  isSidebarOpen: boolean;
  onSidebarClick: () => void;
  newChatOnClick: () => void;
}

export const NavBar = ({
  isSidebarOpen,
  onSidebarClick,
  newChatOnClick,
}: NavBarProps) => {
  return (
    <div
      className={`absolute top-0 left-0 w-full bg-white z-10 h-20 py-3 px-5 flex justify-start items-center duration-300 ease-in-out transform ${
        isSidebarOpen ? 'hidden' : 'block'
      }`}
    >
      <div
        className="flex items-center justify-center rounded-md hover:bg-gray-100 p-1.5 cursor-pointer mr-2"
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
  );
};
