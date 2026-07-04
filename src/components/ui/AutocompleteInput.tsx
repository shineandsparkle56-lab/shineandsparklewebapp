import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface AutocompleteInputProps {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Mount the dropdown inside this element instead of document.body.
   *  Pass the Sheet / Dialog content ref so the dropdown stays within
   *  the same Radix stacking context and is never clipped or hidden behind it. */
  portalContainer?: HTMLElement | null;
}

export function AutocompleteInput({
  value,
  onChange,
  options,
  placeholder,
  className = "",
  disabled = false,
  portalContainer,
}: AutocompleteInputProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const selectingRef = useRef(false);

  // Sync query when committed value changes externally (e.g. parent clears city)
  useEffect(() => {
    setQuery(value);
  }, [value]);

  const updatePosition = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropHeight = 192;

    if (spaceBelow >= dropHeight || spaceBelow >= spaceAbove) {
      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    } else {
      setDropdownStyle({
        position: "fixed",
        bottom: window.innerHeight - rect.top + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    }
  }, []);

  useEffect(() => {
    if (open) {
      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
    }
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  // Close + revert on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        inputRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) return;
      setOpen(false);
      setQuery(value);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [value]);

  const filtered = query.trim()
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  const handleSelect = (val: string) => {
    selectingRef.current = true;
    setQuery(val);
    onChange(val);
    setOpen(false);
    requestAnimationFrame(() => { selectingRef.current = false; });
  };

  // Determine where to mount the portal.
  // Prefer the passed-in container (Sheet content node) so we stay in the
  // same Radix stacking context. Fall back to document.body.
  const mountTarget =
    portalContainer !== undefined
      ? portalContainer          // could be null → portal disabled below
      : typeof document !== "undefined"
      ? document.body
      : null;

  const dropdownList = open && filtered.length > 0 && (
    <ul
      ref={dropdownRef}
      style={dropdownStyle}
      className="max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg text-sm"
    >
      {filtered.map((opt) => (
        <li
          key={opt}
          // pointer events: handle both mouse and touch
          onPointerDown={(e) => {
            e.preventDefault();  // keep input focused, prevent blur
            selectingRef.current = true;
          }}
          onClick={() => {
            handleSelect(opt);
          }}
          className={`px-4 py-2.5 cursor-pointer select-none hover:bg-[#F3EEFB] hover:text-[#9B6FD1] transition-colors ${
            opt === value ? "bg-[#F3EEFB] text-[#9B6FD1] font-medium" : "text-gray-700"
          }`}
        >
          {opt}
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        className={className}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          if (selectingRef.current) return;
          setOpen(false);
          // Revert to last confirmed value so partial typed text doesn't stick
          setQuery(value);
        }}
        autoComplete="off"
      />
      {mountTarget && dropdownList
        ? createPortal(dropdownList, mountTarget)
        : null}
    </>
  );
}
