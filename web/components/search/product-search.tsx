"use client";
import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchProducts } from "@/lib/api/catalog";
import { formatMoney } from "@/lib/utils/money";
import { Icon } from "@/components/ui/icon";

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;

/** Search-as-you-type combobox. Enter opens the catalog with the query. */
export function ProductSearch({
  variant = "nav",
  placeholder = "Search bearings, fasteners, pneumatics, SKUs…",
}: {
  variant?: "nav" | "hero";
  placeholder?: string;
}) {
  const router = useRouter();
  const id = useId();
  const listId = `${id}-list`;
  const [text, setText] = useState("");
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const root = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setTerm(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const enabled = term.length >= MIN_CHARS;
  const query = useQuery({
    queryKey: ["product-search", term],
    queryFn: ({ signal }) =>
      fetchProducts(
        new URLSearchParams({ q: term, pageSize: "5" }).toString(),
        signal,
      ),
    enabled,
  });
  const results = enabled ? (query.data?.data ?? []) : [];
  const total = query.data?.meta.total ?? 0;
  const showList = open && enabled;

  const go = (q: string) => {
    setOpen(false);
    setActive(-1);
    router.push(`/catalog?${new URLSearchParams({ q }).toString()}`);
  };

  return (
    <form
      ref={root}
      role="search"
      className={`product-search product-search-${variant}`}
      onSubmit={(e) => {
        e.preventDefault();
        const picked = results[active];
        if (picked) go(picked.sku);
        else if (text.trim()) go(text.trim());
      }}
    >
      <Icon name="search" />
      <label className="sr-only" htmlFor={`${id}-input`}>
        Search products
      </label>
      <input
        id={`${id}-input`}
        type="search"
        role="combobox"
        autoComplete="off"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          showList && active >= 0 ? `${id}-option-${active}` : undefined
        }
        placeholder={placeholder}
        value={text}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && results.length) {
            e.preventDefault();
            setOpen(true);
            setActive((i) => (i + 1) % results.length);
          } else if (e.key === "ArrowUp" && results.length) {
            e.preventDefault();
            setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
          } else if (e.key === "Escape") {
            setOpen(false);
            setActive(-1);
          }
        }}
      />
      {variant === "hero" && (
        <button type="submit" className="button button-rfq">
          Search
        </button>
      )}
      <div className="search-panel" hidden={!showList}>
        <ul id={listId} role="listbox" aria-label="Product suggestions">
          {results.map((product, index) => (
            <li
              key={product.id}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={index === active}
              onPointerEnter={() => setActive(index)}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => go(product.sku)}
            >
              <span className="search-thumb" aria-hidden="true">
                {product.image ? (
                  <Image src={product.image} alt="" width={40} height={40} />
                ) : (
                  product.symbol
                )}
              </span>
              <span className="search-text">
                <strong>{product.name}</strong>
                <small>
                  {product.sku} · {product.brand}
                </small>
              </span>
              <span className="search-price">
                {formatMoney(product.pricePaise)}
              </span>
            </li>
          ))}
        </ul>
        {query.isFetching && results.length === 0 ? (
          <p className="search-status" role="status">
            Searching…
          </p>
        ) : query.isError ? (
          <p className="search-status" role="alert">
            Search is unavailable. Press Enter to open the catalog.
          </p>
        ) : results.length === 0 ? (
          <p className="search-status" role="status">
            No products match “{term}”.
          </p>
        ) : (
          <button
            type="button"
            className="search-all"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => go(term)}
          >
            View all {total} result{total === 1 ? "" : "s"} for “{term}” →
          </button>
        )}
      </div>
    </form>
  );
}
