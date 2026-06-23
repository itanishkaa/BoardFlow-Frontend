import { useEffect } from 'react';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { useCanvasStore } from './store/useCanvasStore';

function App() {
  const initSocket = useCanvasStore((state) => state.initSocket);
  const disconnectSocket = useCanvasStore((state) => state.disconnectSocket);

  useEffect(() => {
    initSocket('sandbox-room-1');

    return () => {
      disconnectSocket();
    };
  }, [initSocket, disconnectSocket]);

  return (
    <div className="app-shell">
      <Canvas />
      <Toolbar />
      <div className="info-banner">
        <span className="info-banner__brand">BoardFlow v0.1</span>
        <span className="info-banner__divider">|</span>
        <span>Left-Click + Drag to pan • Scroll to zoom • Realtime Sync Active</span>
      </div>
    </div>
  );
}

export default App;
