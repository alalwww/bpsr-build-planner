import { useRef, useState } from 'react';

export function useDragReorder(onReorder: (from: number, to: number) => void) {
  const dragIndexRef = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  return {
    dragOver,
    onDragStart: (i: number) => {
      dragIndexRef.current = i;
    },
    onDragOver: (e: React.DragEvent, i: number) => {
      e.preventDefault();
      setDragOver(i);
    },
    onDrop: (i: number) => {
      if (dragIndexRef.current != null && dragIndexRef.current !== i)
        onReorder(dragIndexRef.current, i);
      dragIndexRef.current = null;
      setDragOver(null);
    },
    onDragEnd: () => {
      dragIndexRef.current = null;
      setDragOver(null);
    },
    onDragLeave: () => setDragOver(null),
  };
}
