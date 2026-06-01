import { useEffect, useRef, useState } from 'react';

export const useWebsocket = (url: string) => {
  const [data, setData] = useState<any | null>(null);
  const [connected, setConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    ws.current = new WebSocket(url);

    ws.current.onopen = () => {
      setConnected(true);
      console.log('WS Connection established: ' + url);
    };

    ws.current.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        setData(payload);
      } catch (err) {
        console.error('WS JSON parse error:', err);
      }
    };

    ws.current.onclose = () => {
      setConnected(false);
      console.log('WS Connection closed. Reconnecting shortly...');
    };

    return () => {
      if (ws.current) ws.current.close();
    };
  }, [url]);

  const sendMessage = (message: any) => {
    if (ws.current && connected) {
      ws.current.send(JSON.stringify(message));
    }
  };

  return { data, connected, sendMessage };
};
