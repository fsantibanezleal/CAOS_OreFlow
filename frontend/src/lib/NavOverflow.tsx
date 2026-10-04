import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { useShellLang } from '@fasl-work/caos-app-shell';

/**
 * Shows that the route links scroll (U-37; shell known defect 10's override hides the nav's scrollbar, so on a phone
 * "Introdu" was cut mid-word with nothing to say the other pages were there). The nav declares which of its ends
 * hides links, `data-fade-start` and `data-fade-end`, and the stylesheet fades that end; the current page's link is
 * scrolled into view on every route and language change. Rendered inside AppShell.
 */
export function NavOverflow(): null {
  const { pathname } = useLocation();
  const lang = useShellLang();
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>('.site-header .main-nav');
    if (!nav) return undefined;
    const update = () => {
      const hidden = nav.scrollWidth - nav.clientWidth;
      nav.dataset.fadeStart = hidden > 1 && nav.scrollLeft > 1 ? '1' : '0';
      nav.dataset.fadeEnd = hidden > 1 && nav.scrollLeft < hidden - 1 ? '1' : '0';
    };
    const active = nav.querySelector<HTMLElement>('.nav-link.active');
    if (active) {
      // the link's own box against the nav's, so the document never scrolls with it
      const left = active.offsetLeft - nav.offsetLeft;
      if (left < nav.scrollLeft || left + active.offsetWidth > nav.scrollLeft + nav.clientWidth) {
        nav.scrollLeft = Math.max(0, left - (nav.clientWidth - active.offsetWidth) / 2);
      }
    }
    update();
    nav.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(nav);
    return () => { nav.removeEventListener('scroll', update); observer.disconnect(); };
  }, [pathname, lang]);
  return null;
}
