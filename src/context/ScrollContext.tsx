import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";

interface ScrollContextValue {
  scrollingDown: boolean;
}

const ScrollContext = createContext<ScrollContextValue>({ scrollingDown: false });

// Minimum pixels the user must scroll before we consider it intentional.
// A higher value prevents layout-shift reflows (e.g. submenu expanding)
// from falsely triggering the "hide navbar" state.
const DOWN_THRESHOLD = 12;
const UP_THRESHOLD = 4;
// Don't hide the navbar until the user has scrolled at least this far down.
const MIN_SCROLL_TO_HIDE = 120;

export function ScrollProvider({ children }: { children: ReactNode }) {
  const [scrollingDown, setScrollingDown] = useState(false);
  const lastY = useRef(typeof window !== "undefined" ? window.scrollY : 0);

  useEffect(() => {
    // Disable browser scroll restoration so page always starts at top on refresh
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    // Sync initial state — browser may restore scroll position on refresh
    lastY.current = window.scrollY;
    if (window.scrollY <= MIN_SCROLL_TO_HIDE) {
      setScrollingDown(false);
    }

    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;

      if (y < MIN_SCROLL_TO_HIDE) {
        // Always show navbar near the top of the page
        setScrollingDown(false);
        lastY.current = y;
      } else if (delta > DOWN_THRESHOLD) {
        // User scrolled down intentionally
        setScrollingDown(true);
        lastY.current = y;
      } else if (delta < -UP_THRESHOLD) {
        // User scrolled up — reveal navbar
        setScrollingDown(false);
        lastY.current = y;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <ScrollContext.Provider value={{ scrollingDown }}>
      {children}
    </ScrollContext.Provider>
  );
}

export function useScroll() {
  return useContext(ScrollContext);
}
