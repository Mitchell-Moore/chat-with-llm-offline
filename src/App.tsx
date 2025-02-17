import { useEffect, useRef, useState } from 'react';
import Progress from '@/components/ui/Progress';
import Chat from '@/components/ui/Chat';
import { SideBar } from '@/components/ui/SideBar';
import { StopIcon, ArrowRightIcon } from '@/components/ui/icons';
import {
  createChat,
  getCurrentChat,
  getMessages,
  saveMessage,
} from './db/actions';
import { NavBar } from './components/ui/NavBar';

function App() {
  const worker = useRef<Worker | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Remove if not needed, or use it in your code
  const IS_WEBGPU_AVAILABLE = !!navigator.gpu;
  const STICKY_SCROLL_THRESHOLD = 120;

  // Model loading and progress
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [progressItems, setProgressItems] = useState<
    { file: string; progress: number; total: number }[]
  >([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<number | undefined>();

  // Inputs and outputs
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: string; content: string }[]>(
    []
  );
  const [tps, setTps] = useState<number | null>(null);
  const [numTokens, setNumTokens] = useState<number>(0);
  const creatingChatRef = useRef(false);

  async function loadCurrentChat() {
    let chat = await getCurrentChat();

    if (!chat) {
      if (creatingChatRef.current) {
        return;
      }

      creatingChatRef.current = true;

      await createChat({});
      chat = await getCurrentChat();
    }

    if (chat) {
      setCurrentChatId(chat.id);
      const chatMessages = await getMessages(chat.id);
      setMessages(
        chatMessages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }))
      );
    }
  }

  useEffect(() => {
    // Load current chat and its messages
    loadCurrentChat();
  }, []);

  useEffect(() => {
    // Create the worker if it does not yet exist.
    if (!worker.current) {
      worker.current = new Worker(new URL('./worker.js', import.meta.url), {
        type: 'module',
      });
      worker.current.postMessage({ type: 'check' }); // Do a feature check
    }

    const onMessageReceived = (e: MessageEvent) => {
      switch (e.data.status) {
        case 'loading':
          // Model file start load: add a new progress item to the list.
          setStatus('loading');
          setLoadingMessage(e.data.data);
          break;

        case 'initiate':
          setProgressItems((prev) => [...prev, e.data]);
          break;

        case 'progress':
          // Model file progress: update one of the progress items.
          setProgressItems((prev) =>
            prev.map((item) => {
              if (item.file === e.data.file) {
                return { ...item, ...e.data };
              }
              return item;
            })
          );
          break;

        case 'done':
          // Model file loaded: remove the progress item from the list.
          setProgressItems((prev) =>
            prev.filter((item) => item.file !== e.data.file)
          );
          break;

        case 'ready':
          // Pipeline ready: the worker is ready to accept messages.
          setStatus('ready');
          break;

        case 'start':
          {
            // Start generation
            setMessages((prev) => [
              ...prev,
              { role: 'assistant', content: '' },
            ]);
          }
          break;

        case 'update':
          {
            // Generation update: update the output text.
            // Parse messages
            const { output, tps, numTokens } = e.data;
            setTps(tps);
            setNumTokens(numTokens);
            setMessages((prev) => {
              const cloned = [...prev];
              const last = cloned.at(-1);
              if (last) {
                cloned[cloned.length - 1] = {
                  ...last,
                  content: last.content + output,
                };
              }
              return cloned;
            });
          }
          break;

        case 'complete':
          // Generation complete: re-enable the "Generate" button
          setIsRunning(false);
          break;

        case 'error':
          setError(e.data.data);
          break;
      }
    };

    const onErrorReceived = (e: ErrorEvent) => {
      console.error('Worker error:', e);
    };

    // Attach the callback function as an event listener.
    worker.current.addEventListener('message', onMessageReceived);
    worker.current.addEventListener('error', onErrorReceived);

    // Define a cleanup function for when the component is unmounted.
    return () => {
      worker?.current?.removeEventListener('message', onMessageReceived);
      worker?.current?.removeEventListener('error', onErrorReceived);
    };
  }, []);

  // Send the messages to the worker thread whenever the `messages` state changes.
  useEffect(() => {
    if (messages.filter((x) => x.role === 'user').length === 0) {
      // No user messages yet: do nothing.
      return;
    }
    if (messages.at(-1)?.role === 'assistant') {
      // Do not update if the last message is from the assistant
      return;
    }
    setTps(null);
    worker?.current?.postMessage({ type: 'generate', data: messages });
  }, [messages, isRunning]);

  useEffect(() => {
    if (!chatContainerRef.current || !isRunning) return;
    const element = chatContainerRef.current;
    if (
      element.scrollHeight - element.scrollTop - element.clientHeight <
      STICKY_SCROLL_THRESHOLD
    ) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages, isRunning]);

  useEffect(() => {
    if (!isRunning && messages.length > 0 && status === 'ready') {
      getCurrentChat()
        .then((chat) => {
          const lastMessage = messages.at(-1);
          if (chat && lastMessage) {
            saveMessage({
              chatId: chat.id,
              role: 'assistant',
              content: lastMessage.content,
            });
          }
        })
        .catch((e) => {
          console.error('Error saving message', e);
        });
    }
  }, [messages, isRunning, status]);

  function onEnter(message: string) {
    setMessages((prev) => [...prev, { role: 'user', content: message }]);
    setTps(null);
    setIsRunning(true);
    setInput('');
    getCurrentChat()
      .then((chat) => {
        if (chat) {
          saveMessage({
            chatId: chat.id,
            role: 'user',
            content: message,
          });
        }
      })
      .catch((e) => {
        console.error('Error saving message', e);
      });
  }

  function onInterrupt() {
    // NOTE: We do not set isRunning to false here because the worker
    // will send a 'complete' message when it is done.
    worker?.current?.postMessage({ type: 'interrupt' });
  }

  async function newChatOnClick() {
    await createChat({});
    setMessages([]);
    setIsRunning(false);
    setStatus('ready');
    loadCurrentChat();
  }

  function onSidebarClick() {
    setIsSidebarOpen(!isSidebarOpen);
  }

  async function handleChatSelect(chatId: number) {
    const chatMessages = await getMessages(chatId);
    setMessages(
      chatMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))
    );
    setCurrentChatId(chatId);
  }

  return IS_WEBGPU_AVAILABLE ? (
    <div className="flex h-screen overflow-hidden text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 relative w-full ">
      <SideBar
        isSidebarOpen={isSidebarOpen}
        onSidebarClick={onSidebarClick}
        newChatOnClick={newChatOnClick}
        currentChatId={currentChatId}
        onChatSelect={handleChatSelect}
      />
      <div
        className={`flex flex-col mx-auto items-center justify-end transition-all duration-300 ease-in-out w-full ${
          isSidebarOpen ? 'pl-50' : 'pl-0'
        }`}
      >
        <NavBar
          isSidebarOpen={isSidebarOpen}
          onSidebarClick={onSidebarClick}
          newChatOnClick={newChatOnClick}
        />
        {status === null && (
          <div className="h-full overflow-auto scrollbar-thin flex justify-center items-center flex-col relative">
            <div className="flex flex-col items-center mb-1 max-w-[440px] text-center">
              <h1 className="text-4xl font-bold mb-1">Powered by Llama-3.2</h1>
              <h2 className="font-semibold">
                A private and powerful AI chatbot <br />
                that runs locally in your browser.
              </h2>
            </div>

            <div className="flex flex-col items-center px-4">
              <p className="max-w-[514px] mb-4">
                <br />
                You are about to load{' '}
                <a
                  href="https://huggingface.co/onnx-community/Llama-3.2-1B-Instruct-q4f16"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium underline"
                >
                  Llama-3.2-1B-Instruct
                </a>
                , a 1.24 billion parameter LLM that is optimized for inference
                on the web. Once downloaded, the model (1.15&nbsp;GB) will be
                cached and reused when you revisit the page.
                <br />
                <br />
                Everything runs directly in your browser using{' '}
                <a
                  href="https://huggingface.co/docs/transformers.js"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  🤗&nbsp;Transformers.js
                </a>{' '}
                and ONNX Runtime Web, meaning your conversations aren&#39;t sent
                to a server. You can even disconnect from the internet after the
                model has loaded!
                <br />
                Want to learn more? Check out the demos source code on{' '}
                <a
                  href="https://github.com/huggingface/transformers.js-examples/tree/main/llama-3.2-webgpu"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  GitHub
                </a>
                !
              </p>

              {error && (
                <div className="text-red-500 text-center mb-2">
                  <p className="mb-1">
                    Unable to load model due to the following error:
                  </p>
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <button
                className="border px-4 py-2 rounded-lg bg-blue-400 text-white hover:bg-blue-500 disabled:bg-blue-100 disabled:cursor-not-allowed select-none cursor-pointer"
                onClick={() => {
                  worker?.current?.postMessage({ type: 'load' });
                  setStatus('loading');
                }}
                disabled={status !== null || error !== null}
              >
                Load model
              </button>
            </div>
          </div>
        )}
        {status === 'loading' && (
          <>
            <div className="w-full max-w-[500px] text-left mx-auto p-4 bottom-0 mt-auto">
              <p className="text-center mb-1">{loadingMessage}</p>
              {progressItems.map(({ file, progress, total }, i) => (
                <Progress
                  key={i}
                  text={file}
                  percentage={progress}
                  total={total}
                />
              ))}
            </div>
          </>
        )}

        {status === 'ready' && (
          <div
            ref={chatContainerRef}
            className="overflow-y-auto scrollbar-thin w-full flex flex-col items-center h-full"
          >
            <Chat messages={messages} />
            <p className="text-center text-sm min-h-6 text-gray-500 dark:text-gray-300">
              {tps && messages.length > 0 && (
                <>
                  {!isRunning && (
                    <span>
                      Generated {numTokens} tokens in{' '}
                      {(numTokens / tps).toFixed(2)} seconds&nbsp;&#40;
                    </span>
                  )}
                  {
                    <>
                      <span className="font-medium text-center mr-1 text-black dark:text-white">
                        {tps.toFixed(2)}
                      </span>
                      <span className="text-gray-500 dark:text-gray-300">
                        tokens/second&#41;
                      </span>
                    </>
                  }
                </>
              )}
            </p>
          </div>
        )}

        <div className="mt-2 border dark:bg-gray-700 rounded-lg w-[600px] max-w-[80%] max-h-[200px] mx-auto relative mb-3 flex">
          <textarea
            ref={textareaRef}
            className="scrollbar-thin w-[550px] dark:bg-gray-700 px-3 py-4 rounded-lg bg-transparent border-none outline-none text-gray-800 disabled:text-gray-400 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 disabled:placeholder-gray-200 resize-none disabled:cursor-not-allowed"
            placeholder="Type your message..."
            rows={1}
            value={input}
            disabled={status !== 'ready' || isRunning}
            title={
              status === 'ready' ? 'Model is ready' : 'Model not loaded yet'
            }
            onKeyDown={(e) => {
              if (
                input.length > 0 &&
                !isRunning &&
                e.key === 'Enter' &&
                !e.shiftKey
              ) {
                e.preventDefault(); // Prevent default behavior of Enter key
                onEnter(input);
              }
            }}
            onInput={(e) => setInput(e.currentTarget.value)}
          />
          {isRunning ? (
            <div className="cursor-pointer" onClick={onInterrupt}>
              <StopIcon className="h-8 w-8 p-1 rounded-md text-gray-800 dark:text-gray-100 absolute right-3 bottom-3" />
            </div>
          ) : input.length > 0 ? (
            <div className="cursor-pointer" onClick={() => onEnter(input)}>
              <ArrowRightIcon
                className={`h-8 w-8 p-1 bg-gray-800 dark:bg-gray-100 text-white dark:text-black rounded-md absolute right-3 bottom-3`}
              />
            </div>
          ) : (
            <div>
              <ArrowRightIcon
                className={`h-8 w-8 p-1 bg-gray-200 dark:bg-gray-600 text-gray-50 dark:text-gray-800 rounded-md absolute right-3 bottom-3`}
              />
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center mb-3">
          Disclaimer: Generated content may be inaccurate or false.
        </p>
      </div>
    </div>
  ) : (
    <div className="fixed w-screen h-screen bg-black z-10 bg-opacity-[92%] text-white text-2xl font-semibold flex justify-center items-center text-center">
      WebGPU is not supported
      <br />
      by this browser :&#40;
    </div>
  );
}

export default App;
