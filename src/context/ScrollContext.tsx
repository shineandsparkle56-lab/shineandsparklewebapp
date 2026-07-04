import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";

interface ScrollContextValue {
  scrollingDown: boolean;
}

const ScrollContext = createContext<ScrollContextValue>({ scrollingDown: false });

export function ScrollProvider({ children }: { children: ReactNode }) {
  const [scrollingDown, setScrollingDown] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;

      if (y < 10) {
        // Always show at the very top
        setScrollingDown(false);
      } else if (delta > 4) {
        // Scrolling down with enough momentum — hide
        setScrollingDown(true);
        lastY.current = y;
      } else if (delta < -4) {
        // Scrolling up with enough momentum — show
        setScrollingDown(false);
        lastY.current = y;
      }
      // Ignore tiny jitter (|delta| <= 4)
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
