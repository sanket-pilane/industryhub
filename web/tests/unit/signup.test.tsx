import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignupForm } from "@/components/auth/signup-form";
import {
  authenticate,
  findUserById,
  registerCustomer,
} from "@/lib/auth/accounts";
import { signupSchema } from "@/lib/validators";
import { createTestDb } from "../helpers/db";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const valid = {
  firstName: "Asha",
  lastName: "Rao",
  companyName: "Rao Precision",
  email: "asha@raoprecision.in",
  password: "Strong#2026",
  confirmPassword: "Strong#2026",
  terms: true,
};

describe("signup validation", () => {
  it("accepts a complete valid payload", () => {
    expect(signupSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects weak, mismatched and unaccepted submissions", () => {
    for (const patch of [
      { password: "short1", confirmPassword: "short1" },
      { password: "onlyletters", confirmPassword: "onlyletters" },
      { password: "12345678", confirmPassword: "12345678" },
      { confirmPassword: "Different#2026" },
      { terms: false },
      { email: "nope" },
    ])
      expect(signupSchema.safeParse({ ...valid, ...patch }).success).toBe(
        false,
      );
  });
});

describe("account store (SQLite)", () => {
  it("registers a customer, authenticates and blocks duplicate emails", () => {
    const db = createTestDb();
    const input = signupSchema.parse({ ...valid, email: "store@test.in" });
    const created = registerCustomer(db, input);
    if ("error" in created) throw new Error("expected registration");
    expect(created.profile).toMatchObject({ initials: "AR", role: "CUSTOMER" });
    expect(findUserById(db, created.profile.id)?.email).toBe("store@test.in");
    expect(authenticate(db, "STORE@test.in", valid.password)?.id).toBe(
      created.profile.id,
    );
    expect(authenticate(db, "store@test.in", "wrong")).toBeNull();
    expect(registerCustomer(db, input)).toEqual({ error: "EMAIL_TAKEN" });
    expect(registerCustomer(db, { ...input, email: "Store@Test.in" })).toEqual({
      error: "EMAIL_TAKEN",
    });
  });
  it("stores a salted hash, never the password", () => {
    const db = createTestDb();
    const created = registerCustomer(db, signupSchema.parse(valid));
    if ("error" in created) throw new Error("expected registration");
    const row = db
      .prepare("SELECT password_salt, password_hash FROM users WHERE id = ?")
      .get(created.profile.id) as {
      password_salt: string;
      password_hash: string;
    };
    expect(row.password_hash).not.toContain(valid.password);
    expect(row.password_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.password_salt).toMatch(/^[0-9a-f]{32}$/);
  });
  it("signs in the seeded accounts with their roles and refuses disabled ones", () => {
    const db = createTestDb();
    expect(
      authenticate(db, "rohan.patil@precisionworks.in", "Industrihub@123")
        ?.role,
    ).toBe("SUPPLIER");
    expect(
      authenticate(db, "operations@industrihub.in", "Industrihub@123")?.role,
    ).toBe("ADMIN");
    db.prepare("UPDATE users SET is_active = 0 WHERE email = ?").run(
      "operations@industrihub.in",
    );
    expect(
      authenticate(db, "operations@industrihub.in", "Industrihub@123"),
    ).toBeNull();
    expect(authenticate(db, "nobody@test.in", "Industrihub@123")).toBeNull();
  });
});

describe("signup form", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });
  it("shows field errors and does not call the API when invalid", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<SignupForm />);
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));
    await screen.findByText("Enter your first name.");
    expect(screen.getByText("Accept the terms to continue.")).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("submits valid details and redirects home", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ success: true, data: { signedIn: true } }),
      }),
    );
    render(<SignupForm />);
    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: valid.firstName },
    });
    fireEvent.change(screen.getByLabelText("Last name"), {
      target: { value: valid.lastName },
    });
    fireEvent.change(screen.getByLabelText("Company name"), {
      target: { value: valid.companyName },
    });
    fireEvent.change(screen.getByLabelText("Work email"), {
      target: { value: valid.email },
    });
    fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
      target: { value: valid.password },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: valid.password },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });
  it("surfaces server errors such as an existing email", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          success: false,
          error: { message: "An account with this email already exists." },
        }),
      }),
    );
    render(<SignupForm />);
    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "A" },
    });
    fireEvent.change(screen.getByLabelText("Last name"), {
      target: { value: "B" },
    });
    fireEvent.change(screen.getByLabelText("Company name"), {
      target: { value: "Acme Ltd" },
    });
    fireEvent.change(screen.getByLabelText("Work email"), {
      target: { value: "a@acme.in" },
    });
    fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
      target: { value: valid.password },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: valid.password },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("already exists"),
    );
    expect(push).not.toHaveBeenCalled();
  });
});
