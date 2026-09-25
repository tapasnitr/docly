'use client';

import { useEffect, useState } from 'react';

interface TypedTextProps {
  text: string;
  startDelay?: number;
  speed?: number;
  onDone?: () => void;
  className?: string;
}

// Reveals `text` one character at a time, simulating an LLM streaming a
// response. Used by the hero AI preview and the AI section's chat demo -
// both are illustrative "Demo Workspace" mockups, not a live model call.
export function TypedText({ text, startDelay = 0, speed = 18, onDone, className }: TypedTextProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(0);
    let interval: ReturnType<typeof setInterval>;
    const timeout = setTimeout(() => {
      interval = setInterval(() => {
        setCount((current) => {
          if (current >= text.length) {
            clearInterval(interval);
            onDone?.();
            return current;
          }
          return current + 1;
        });
      }, speed);
    }, startDelay);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, startDelay, speed]);

  return <span className={className}>{text.slice(0, count)}</span>;
}
