import { useEffect, useRef, useState } from 'react';

export function useDraggable() {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const startOffset = useRef({ x: 0, y: 0 });
  const startMouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setOffset({
        x: startOffset.current.x + e.clientX - startMouse.current.x,
        y: startOffset.current.y + e.clientY - startMouse.current.y,
      });
    };
    const onUp = () => {
      dragging.current = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const onDragHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startOffset.current = { ...offset };
    startMouse.current = { x: e.clientX, y: e.clientY };
  };

  return { offset, onDragHandleMouseDown };
}
