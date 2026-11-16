import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/auth/login-form";
const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
describe("login form", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });
  it("toggles password visibility and explains password recovery", () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password", { exact: true })).toHaveAttribute(
      "type",
      "text",
    );
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(screen.getByRole("status")).toHaveTextContent("administrator");
  });
  it("shows server credential errors without navigating", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          success: false,
          error: { message: "Invalid credentials" },
        }),
      }),
    );
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("Work email"), {
      target: { value: "buyer@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
      target: { value: "wrong-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In Securely" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Invalid credentials",
      ),
    );
    expect(push).not.toHaveBeenCalled();
  });
  it("rejects invalid email before calling the API", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("Work email"), {
      target: { value: "invalid" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In Securely" }));
    await screen.findByText("Enter a valid work email.");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("fills a sample account and goes to the home the server returns", async () => {
    const fetch = vi.fn().mockResolvedValue({
      json: async () => ({
        success: true,
        data: { signedIn: true, role: "SUPPLIER", home: "/supplier" },
      }),
    });
    vi.stubGlobal("fetch", fetch);
    render(<LoginForm />);
    fireEvent.click(screen.getByText("Sample accounts"));
    fireEvent.click(screen.getByRole("button", { name: /Supplier/ }));
    expect(screen.getByLabelText("Work email")).toHaveValue(
      "rohan.patil@precisionworks.in",
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign In Securely" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/supplier"));
    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/session",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
      email: "rohan.patil@precisionworks.in",
      password: "Industrihub@123",
    });
  });
});
