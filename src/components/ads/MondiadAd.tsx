import { useEffect } from 'react';
import type { CSSProperties } from 'react';

type AdType = 'native' | 'banner';

const LOADER: Record<AdType, string> = {
  native: 'https://ss.mrmnd.com/native.js',
  banner: 'https://ss.mrmnd.com/banner.js',
};

interface MondiadAdProps {
  type: AdType;
  /** Mondiad zone id (data-mndazid for native, data-mndbanid for banner). */
  zoneId: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Renders a single Mondiad ad slot.
 *
 * The loader scripts in index.html <head> fill these slots on the initial
 * (prerendered) full-page load — which is the traffic that matters for SEO,
 * since visitors land directly on a blog post URL. This component additionally
 * re-appends the relevant loader on mount so the slot is also filled after
 * client-side SPA navigation, when the head script has already completed its
 * one-time scan.
 *
 * On the server (prerender) useEffect does not run, so this safely renders just
 * the empty slot div into the static HTML for the client script to populate.
 */
export function MondiadAd({ type, zoneId, className, style }: MondiadAdProps) {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = LOADER[type];
    script.async = true;
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
  }, [type, zoneId]);

  const slotAttr =
    type === 'native'
      ? { 'data-mndazid': zoneId }
      : { 'data-mndbanid': zoneId };

  return <div className={className} style={style} {...slotAttr} />;
}
