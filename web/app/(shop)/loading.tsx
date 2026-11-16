/** Shown inside the shop layout, so the navbar stays put while a page loads. */
export default function ShopLoading() {
  return (
    <main
      className="container workspace-page"
      aria-label="Loading page"
      aria-busy="true"
    >
      <div className="skeleton h-12 w-2/3" />
      <div className="skeleton mt-6 h-64 w-full" />
      <p role="status" className="sr-only">
        Loading…
      </p>
    </main>
  );
}
