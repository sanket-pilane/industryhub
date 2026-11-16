import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductSearch } from "@/components/search/product-search";
import { seedProducts as products } from "@/lib/db/seed-data";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function renderSearch() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProductSearch />
    </QueryClientProvider>,
  );
}

describe("product search", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    push.mockReset();
  });

  it("debounces, lists suggestions and opens the highlighted one", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: products.slice(0, 2),
        error: null,
        meta: { requestId: "r", page: 1, pageSize: 5, total: 7 },
      }),
    });
    vi.stubGlobal("fetch", fetch);
    renderSearch();
    const input = screen.getByRole("combobox", { name: "Search products" });

    fireEvent.change(input, { target: { value: "b" } });
    await new Promise((r) => setTimeout(r, 350));
    expect(fetch).not.toHaveBeenCalled(); // below the 2-character minimum

    fireEvent.change(input, { target: { value: "bearing" } });
    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(2);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toContain("q=bearing");
    expect(screen.getByText(/View all 7 results/)).toBeVisible();

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.submit(input.closest("form")!);
    expect(push).toHaveBeenCalledWith(
      `/catalog?q=${encodeURIComponent(products[0].sku)}`,
    );
  });

  it("submits free text to the catalog when nothing is highlighted", async () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    renderSearch();
    const input = screen.getByRole("combobox", { name: "Search products" });
    fireEvent.change(input, { target: { value: "hex bolt" } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/catalog?q=hex+bolt"),
    );
  });
});
