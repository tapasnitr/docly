'use client';

import { useEffect, useRef, useState } from 'react';

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

  // Callers pass a new `onDone` closure every render (e.g. an inline
  // `() => setAnswerStarted(true)`), so it's read through a ref rather than
  // a dependency - depending on it directly would restart the effect (and
  // the typing animation) on every parent re-render.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    setCount(0);
    let charsShown = 0;
    let interval: ReturnType<typeof setInterval> | undefined;

    const timeout = setTimeout(() => {
      interval = setInterval(() => {
        charsShown += 1;
        // Plain value, not a functional updater - onDoneRef.current() is a
        // side effect (it calls setState on the parent), and React
        // double-invokes functional updaters in dev mode to check they're
        // pure, which fired that side effect at the wrong time and warned
        // "Cannot update a component while rendering a different component".
        setCount(charsShown);
        if (charsShown >= text.length) {
          clearInterval(interval);
          onDoneRef.current?.();
        }
      }, speed);
    }, startDelay);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [text, startDelay, speed]);

  return <span className={className}>{text.slice(0, count)}</span>;
}
