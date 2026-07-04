import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";

interface ScrollContextValue {
  scrollingDown: boolean;
}

const ScrollContext = createContext<ScrollContextValue>({ scrollingDown: false });

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
    if (window.scrollY > 10) {
      setScrollingDown(false);
    }

    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;

      if (y < 10) {
        setScrollingDown(false);
      } else if (delta > 4) {
        setScrollingDown(true);
        lastY.current = y;
      } else if (delta < -4) {
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
