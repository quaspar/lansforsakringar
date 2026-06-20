import { useEffect, useState } from "react";

/** Returns true while the given media query matches. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** Prototype breakpoint: below 820px the sidebar becomes an overlay drawer. */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 819px)");
}
