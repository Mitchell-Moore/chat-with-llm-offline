import { MessageComponent } from '@/components/ui/message';

export default function Chat({
  messages,
}: {
  messages: { role: string; content: string }[];
}) {
  return (
    <div className="flex flex-row justify-center pb-20 h-dvh bg-white dark:bg-zinc-900">
      <div className="flex flex-col justify-between items-center gap-4">
        <div className="flex flex-col gap-4 h-full w-dvw items-center overflow-y-scroll">
          {messages?.map((message, index) => (
            <MessageComponent
              key={`${index}`}
              role={message.role}
              content={message.content}
            />
          ))}
          <div className="flex-shrink-0 min-w-[24px] min-h-[24px]" />
        </div>
      </div>
    </div>
  );
}
