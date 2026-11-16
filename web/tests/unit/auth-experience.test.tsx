import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthExperience } from "@/components/auth/auth-experience";

let pathname = "/login";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("auth experience", () => {
  beforeEach(() => {
    pathname = "/login";
  });
  it("shows the login pane on /login and hides signup from interaction", () => {
    const { container } = render(<AuthExperience />);
    expect(container.querySelector(".auth-card")).toHaveAttribute(
      "data-mode",
      "login",
    );
    expect(container.querySelector(".auth-pane-login")).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(container.querySelector(".auth-pane-signup")).toHaveAttribute(
      "inert",
    );
  });
  it("mirrors the layout on /signup", () => {
    pathname = "/signup";
    const { container } = render(<AuthExperience />);
    expect(container.querySelector(".auth-card")).toHaveAttribute(
      "data-mode",
      "signup",
    );
    expect(container.querySelector(".auth-pane-login")).toHaveAttribute(
      "inert",
    );
  });
  it("switches modes with pushState instead of a page navigation", () => {
    const pushState = vi.spyOn(window.history, "pushState");
    render(<AuthExperience />);
    fireEvent.click(screen.getByRole("link", { name: "Create an account" }));
    expect(pushState).toHaveBeenCalledWith(null, "", "/signup");
    pushState.mockRestore();
  });
  it("keeps element ids unique with both forms mounted", () => {
    const { container } = render(<AuthExperience />);
    const ids = [...container.querySelectorAll("[id]")].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
