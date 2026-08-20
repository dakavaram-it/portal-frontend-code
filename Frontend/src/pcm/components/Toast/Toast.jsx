import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import Icon from '../Icon/Icon.jsx';
import { prefersReduced } from '../../lib/motion.js';
import './Toast.css';

export default function Toast({ toast }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!toast) return undefined;
    const el = ref.current;

    if (prefersReduced()) {
      el.style.opacity = '1';
      const t = setTimeout(() => { el.style.opacity = '0'; }, 2200);
      return () => clearTimeout(t);
    }

    gsap.killTweensOf(el);
    gsap.fromTo(el, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: .25, ease: 'power2.out' });
    gsap.to(el, { autoAlpha: 0, y: 12, duration: .3, delay: 2.2 });
    return undefined;
  }, [toast]);

  return (
    <div className="toast" role="status" aria-live="polite" ref={ref}>
      {toast && <Icon name="check" sm />}
      {toast ? toast.msg : ''}
    </div>
  );
}
