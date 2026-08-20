import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { prefersReduced } from '../../lib/motion.js';
import './Counter.css';

/* Counts to `value`, and on filter changes counts from the previous figure
   rather than 0 — a figure that drops should read as a drop. */
export default function Counter({ value, format }) {
  const ref = useRef(null);
  const prev = useRef(0);

  useLayoutEffect(() => {
    const el = ref.current;
    const from = prev.current;
    prev.current = value;

    if (prefersReduced() || from === value) {
      el.textContent = format(value);
      return undefined;
    }

    const proxy = { n: from };
    const tween = gsap.to(proxy, {
      n: value,
      duration: .6,
      ease: 'power2.out',
      onUpdate: () => { el.textContent = format(Math.round(proxy.n)); }
    });
    return () => tween.kill();
  }, [value, format]);

  return <span ref={ref}>{format(value)}</span>;
}
