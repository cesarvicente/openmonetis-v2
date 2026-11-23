import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type DashboardDragItem,
  getDashboardDragShift,
  getDashboardDragTargetIndex,
} from "./dashboard.presentation";

type DragState = {
  fromIndex: number;
  offset: number;
  targetIndex: number;
};

const autoScrollEdgePx = 72;
const autoScrollMaxStepPx = 18;
const shiftTransition = "transform 150ms ease-out";

/**
 * Arrastar e soltar por ponteiro (mouse, caneta ou toque) dentro de uma lista com rolagem. A ordem só
 * muda ao soltar; durante o arraste os itens são deslocados apenas visualmente.
 */
export function useDashboardWidgetDrag(onDrop: (fromIndex: number, targetIndex: number) => void) {
  const listRef = useRef<HTMLOListElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const itemsRef = useRef<DashboardDragItem[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);

  useEffect(() => () => cancelRef.current?.(), []);

  function startDrag(event: ReactPointerEvent, fromIndex: number) {
    const list = listRef.current;
    const scroller = scrollerRef.current;
    if (!list || !scroller || event.button !== 0 || cancelRef.current) return;
    event.preventDefault();

    const items = Array.from(list.children, (child) => {
      const { offsetHeight, offsetTop } = child as HTMLElement;
      return { height: offsetHeight, top: offsetTop };
    });
    const dragged = items[fromIndex];
    if (!dragged) return;
    itemsRef.current = items;

    const { pointerId } = event;
    const first = items[0];
    const last = items[items.length - 1];
    const minOffset = first.top - dragged.top;
    const maxOffset = last.top + last.height - dragged.top - dragged.height;
    let clientY = event.clientY;
    const startY = clientY - list.getBoundingClientRect().top;
    let state: DragState = { fromIndex, offset: 0, targetIndex: fromIndex };
    let frame = 0;
    setDrag(state);

    function autoScroll(container: HTMLElement) {
      const { bottom, top } = container.getBoundingClientRect();
      const overflowTop = top + autoScrollEdgePx - clientY;
      const overflowBottom = clientY - (bottom - autoScrollEdgePx);
      const overflow = overflowTop > 0 ? -overflowTop : Math.max(0, overflowBottom);
      if (overflow === 0) return;
      const ratio = Math.max(-1, Math.min(1, overflow / autoScrollEdgePx));
      container.scrollTop += ratio * autoScrollMaxStepPx;
    }

    function update(container: HTMLElement, listElement: HTMLElement) {
      autoScroll(container);
      const pointerY = clientY - listElement.getBoundingClientRect().top;
      const offset = Math.max(minOffset, Math.min(maxOffset, pointerY - startY));
      const targetIndex = getDashboardDragTargetIndex(items, fromIndex, offset);
      if (offset !== state.offset || targetIndex !== state.targetIndex) {
        state = { fromIndex, offset, targetIndex };
        setDrag(state);
      }
    }

    function loop() {
      if (scroller && list) update(scroller, list);
      frame = requestAnimationFrame(loop);
    }

    function finish(drop: boolean) {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleCancel);
      window.removeEventListener("keydown", handleKeyDown, true);
      cancelRef.current = null;
      setDrag(null);
      if (drop && state.targetIndex !== fromIndex) onDrop(fromIndex, state.targetIndex);
    }

    function handleMove(moveEvent: PointerEvent) {
      if (moveEvent.pointerId === pointerId) clientY = moveEvent.clientY;
    }

    function handleUp(upEvent: PointerEvent) {
      if (upEvent.pointerId !== pointerId) return;
      clientY = upEvent.clientY;
      if (scroller && list) update(scroller, list);
      finish(true);
    }

    function handleCancel(cancelEvent: PointerEvent) {
      if (cancelEvent.pointerId === pointerId) finish(false);
    }

    // Esc cancela só o arraste, sem fechar o painel.
    function handleKeyDown(keyEvent: KeyboardEvent) {
      if (keyEvent.key !== "Escape") return;
      keyEvent.preventDefault();
      keyEvent.stopImmediatePropagation();
      finish(false);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleCancel);
    window.addEventListener("keydown", handleKeyDown, true);
    cancelRef.current = () => finish(false);
    frame = requestAnimationFrame(loop);
  }

  function getItemStyle(index: number): CSSProperties | undefined {
    if (!drag) return undefined;
    if (index === drag.fromIndex) return { transform: `translateY(${drag.offset}px)` };
    const shift = getDashboardDragShift(itemsRef.current, index, drag.fromIndex, drag.targetIndex);
    return { transform: `translateY(${shift}px)`, transition: shiftTransition };
  }

  return {
    draggedIndex: drag?.fromIndex ?? null,
    getItemStyle,
    listRef,
    scrollerRef,
    startDrag,
  };
}
