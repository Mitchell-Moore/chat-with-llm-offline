import { useEffect, useRef, useState } from 'react';

function App() {
  const worker = useRef<Worker | null>(null);

  // Remove if not needed, or use it in your code
  const IS_WEBGPU_AVAILABLE = !!navigator.gpu;

  // Model loading and progress
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [progressItems, setProgressItems] = useState<
    { file: string; progress: number }[]
  >([]);
  const [isRunning, setIsRunning] = useState(false);

  // Inputs and outputs
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: string; content: string }[]>(
    []
  );
  const [tps, setTps] = useState<number | null>(null);
  const [numTokens, setNumTokens] = useState<number | null>(null);

  useEffect(() => {
    // Create the worker if it does not yet exist.
    if (!worker.current) {
      worker.current = new Worker(new URL('./worker.js', import.meta.url), {
        type: 'module',
      });
      worker.current.postMessage({ type: 'check' }); // Do a feature check
    }

    const onMessageReceived = (e) => {
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
  }, []);

  return IS_WEBGPU_AVAILABLE ? (
    <></>
  ) : (
    <div className="fixed w-screen h-screen bg-black z-10 bg-opacity-[92%] text-white text-2xl font-semibold flex justify-center items-center text-center">
      WebGPU is not supported
      <br />
      by this browser :&#40;
    </div>
  );
}

export default App;
