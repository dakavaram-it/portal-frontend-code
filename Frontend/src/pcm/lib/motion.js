import { useLayoutEffect } from 'react';
import gsap from 'gsap';

export const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Runs the gsap calls in `build` scoped to `scopeRef`, skipped when the user asked for reduced motion.
   Selector strings inside `build` resolve within the scope element. */
export function useAnim(scopeRef, build, deps) {
  useLayoutEffect(() => {
    if (prefersReduced()) return undefined;
    const ctx = gsap.context(build, scopeRef);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
