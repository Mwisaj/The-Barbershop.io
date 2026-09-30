import { useEffect, useState } from 'react';
import video from '../../images/hero.mp4';
import poster from '../../images/hero-poster.jpg';

export function HeroMedia() {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setAnimate(!preference.matches && !navigator.connection?.saveData);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  const className = 'absolute inset-0 -z-20 h-full w-full object-cover object-center';
  return animate
    ? <video className={className} autoPlay muted loop playsInline poster={poster} preload="metadata" aria-hidden="true"><source src={video} type="video/mp4" /></video>
    : <img className={className} src={poster} alt="" fetchPriority="high" />;
}
