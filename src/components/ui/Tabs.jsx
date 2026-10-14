import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from './cn';

/**
 * Tabs — controlled tab list with arrow-key navigation.
 * items: [{ value, label, icon?, badge? }]. Render the matching panel with
 * <TabPanel value=... activeValue=...> using the same idPrefix.
 *
 * On narrow screens the list scrolls horizontally; edge fades and scroll
 * buttons appear only when tabs are hidden on that side, and the active tab
 * is kept in view.
 */
export function Tabs({ items, value, onValueChange, label, idPrefix = 'tab', className }) {
  const listRef = useRef(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const updateEdges = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const start = el.scrollLeft > 2;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return undefined;
    updateEdges();
    el.addEventListener('scroll', updateEdges, { passive: true });
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateEdges) : null;
    observer?.observe(el);
    return () => {
      el.removeEventListener('scroll', updateEdges);
      observer?.disconnect();
    };
  }, [updateEdges, items.length]);

  // Keep the selected tab visible when it changes (e.g. via ?tab= deep link).
  useEffect(() => {
    const el = listRef.current;
    const active = el?.querySelector('[aria-selected="true"]');
    if (!el || !active) return;
    const { offsetLeft, offsetWidth } = active;
    if (offsetLeft < el.scrollLeft || offsetLeft + offsetWidth > el.scrollLeft + el.clientWidth) {
      el.scrollTo({ left: offsetLeft - 24, behavior: 'auto' });
    }
  }, [value]);

  const scrollBy = (direction) => {
    const el = listRef.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: direction * el.clientWidth * 0.7, behavior: reduce ? 'auto' : 'smooth' });
  };

  const handleKeyDown = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = items.findIndex((item) => item.value === value);
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % items.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = items.length - 1;
    onValueChange(items[next].value);
    listRef.current?.querySelectorAll('[role="tab"]')[next]?.focus();
  };

  // Scroll buttons are a pointer/touch affordance; keyboard users move with arrows.
  const edgeButton = (side) => (
    <button
      type="button"
      tabIndex={-1}
      aria-hidden="true"
      onClick={() => scrollBy(side === 'start' ? -1 : 1)}
      className={cn(
        'absolute top-0 z-10 flex h-10 w-10 items-center text-fg-muted transition-opacity hover:text-fg',
        side === 'start'
          ? 'left-0 justify-start bg-gradient-to-r from-canvas via-canvas/90 to-transparent'
          : 'right-0 justify-end bg-gradient-to-l from-canvas via-canvas/90 to-transparent',
        edges[side] ? 'opacity-100' : 'pointer-events-none opacity-0'
      )}
    >
      {side === 'start' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
    </button>
  );

  return (
    <div className={cn('relative border-b border-line', className)}>
      {edgeButton('start')}
      <div
        ref={listRef}
        role="tablist"
        aria-label={label}
        onKeyDown={handleKeyDown}
        className="-mb-px flex gap-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const selected = item.value === value;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              id={`${idPrefix}-${item.value}`}
              aria-selected={selected}
              aria-controls={`${idPrefix}-panel-${item.value}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onValueChange(item.value)}
              className={cn(
                'relative inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap px-3 text-sm font-medium transition-colors touch:h-11 [&_svg]:h-4 [&_svg]:w-4',
                "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:transition-opacity after:content-['']",
                selected
                  ? 'text-fg after:bg-gradient-to-r after:from-accent-text after:to-accent-2 after:opacity-100 [&_svg]:text-accent-text'
                  : 'text-fg-muted after:bg-line-strong after:opacity-0 hover:text-fg hover:after:opacity-100'
              )}
            >
              {item.icon}
              {item.label}
              {item.badge}
            </button>
          );
        })}
      </div>
      {edgeButton('end')}
    </div>
  );
}

export function TabPanel({ value, activeValue, idPrefix = 'tab', className, children }) {
  if (value !== activeValue) return null;
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${value}`}
      aria-labelledby={`${idPrefix}-${value}`}
      tabIndex={0}
      className={className}
    >
      {children}
    </div>
  );
}
