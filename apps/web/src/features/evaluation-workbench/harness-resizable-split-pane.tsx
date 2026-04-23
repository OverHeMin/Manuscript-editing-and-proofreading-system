import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

interface DragState {
  rect: DOMRect;
  startPosition: number;
  startRatio: number;
}

export interface HarnessResizableSplitPaneProps {
  direction: "horizontal" | "vertical";
  primary: ReactNode;
  secondary: ReactNode;
  className?: string;
  primaryClassName?: string;
  secondaryClassName?: string;
  handleClassName?: string;
  separatorLabel?: string;
  initialRatio?: number;
  minRatio?: number;
  maxRatio?: number;
}

export function HarnessResizableSplitPane({
  direction,
  primary,
  secondary,
  className,
  primaryClassName,
  secondaryClassName,
  handleClassName,
  separatorLabel,
  initialRatio = 0.5,
  minRatio = 0.28,
  maxRatio = 0.72,
}: HarnessResizableSplitPaneProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const [ratio, setRatio] = useState(() => clampRatio(initialRatio, minRatio, maxRatio));

  useEffect(() => {
    setRatio((current) => clampRatio(current, minRatio, maxRatio));
  }, [maxRatio, minRatio]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      const dragState = dragStateRef.current;
      if (dragState == null) {
        return;
      }

      updateRatio(
        direction === "horizontal" ? event.clientX : event.clientY,
        dragState,
      );
    }

    function handlePointerUp() {
      dragStateRef.current = null;
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [direction, maxRatio, minRatio]);

  function updateRatio(position: number, dragState: DragState) {
    const span =
      direction === "horizontal" ? dragState.rect.width : dragState.rect.height;
    if (span <= 0) {
      return;
    }

    const delta = position - dragState.startPosition;
    setRatio(clampRatio(dragState.startRatio + delta / span, minRatio, maxRatio));
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const root = rootRef.current;
    if (root == null) {
      return;
    }

    event.preventDefault();
    dragStateRef.current = {
      rect: root.getBoundingClientRect(),
      startPosition: direction === "horizontal" ? event.clientX : event.clientY,
      startRatio: ratio,
    };
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 0.05 : 0.02;
    const decrementKey = direction === "horizontal" ? "ArrowLeft" : "ArrowUp";
    const incrementKey = direction === "horizontal" ? "ArrowRight" : "ArrowDown";

    if (event.key === decrementKey) {
      event.preventDefault();
      setRatio((current) => clampRatio(current - step, minRatio, maxRatio));
    }

    if (event.key === incrementKey) {
      event.preventDefault();
      setRatio((current) => clampRatio(current + step, minRatio, maxRatio));
    }
  }

  const style = {
    "--harness-split-ratio": `${Math.round(ratio * 1000) / 10}%`,
  } as CSSProperties;

  return (
    <div
      ref={rootRef}
      className={joinClassNames(
        "evaluation-workbench-split-pane",
        `is-${direction}`,
        className,
      )}
      style={style}
    >
      <div
        className={joinClassNames(
          "evaluation-workbench-split-panel",
          "is-primary",
          primaryClassName,
        )}
      >
        {primary}
      </div>
      <div
        role="separator"
        aria-label={
          separatorLabel ??
          (direction === "horizontal" ? "调整左右区域宽度" : "调整上下区域高度")
        }
        aria-orientation={direction === "horizontal" ? "vertical" : "horizontal"}
        aria-valuemin={Math.round(minRatio * 100)}
        aria-valuemax={Math.round(maxRatio * 100)}
        aria-valuenow={Math.round(ratio * 100)}
        tabIndex={0}
        className={joinClassNames(
          "evaluation-workbench-split-handle",
          `is-${direction}`,
          handleClassName,
        )}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
      >
        <span className="evaluation-workbench-split-grip" aria-hidden="true" />
      </div>
      <div
        className={joinClassNames(
          "evaluation-workbench-split-panel",
          "is-secondary",
          secondaryClassName,
        )}
      >
        {secondary}
      </div>
    </div>
  );
}

function clampRatio(value: number, minRatio: number, maxRatio: number) {
  return Math.min(maxRatio, Math.max(minRatio, value));
}

function joinClassNames(...values: Array<string | undefined>) {
  return values.filter((value) => value && value.trim().length > 0).join(" ");
}
