import { useLayoutEffect, useRef, useState } from "react";

// useTicks lays n slices over the width of a box, 2 px apart, each the same
// whole number of pixels wide, at most 8, so that they look alike in a
// narrow column and on a wide page: slices sharing the width evenly would be
// some fraction wide, and the browser rounds each edge on its own, so that
// neighbours come out a pixel apart. What is left over goes before the
// first slice. Until the box is measured, or where it is too narrow, the
// slices share the width.
export function useTicks(n: number, gap = 2) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = Math.min(8, Math.floor((el.clientWidth - gap * (n - 1)) / n));
      setWidth(w >= 1 ? w : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [n, gap]);
  const box = width == null ? { gap: 1 } : { gap, justifyContent: "flex-end" as const };
  const tick = width == null ? { flex: "1 1 0" } : { width, flex: "none" };
  return [ref, box, tick] as const;
}
