import WebSocket from 'ws';

const router = (wss: WebSocket.Server) => {
  wss.on('connection', (ws) => {
    console.log('WebSocket connection established');

    ws.on('close', () => {
      console.log('user disconnected');
    });

    ws.on('message', (message) => {
      const data = JSON.parse(message.toString());
      switch (data.event) {}
    });
  });
};

export default router;
