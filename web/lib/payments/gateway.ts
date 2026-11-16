import { randomUUID } from "node:crypto";
import type { PaymentStatus } from "../../../shared/enums";

/**
 * Payment provider boundary. Card or bank details never reach this server:
 * a provider returns only a reference and a status. A live provider
 * (e.g. Razorpay or Cashfree) implements the same interface with its keys.
 */
export type PaymentMethod = "UPI" | "CARD" | "NETBANKING";
export type TestOutcome = "success" | "pending" | "failed" | "cancelled";

export interface PaymentRequest {
  amountPaise: number;
  reference: string;
  method: PaymentMethod;
  /** Test mode only: which result the test provider should return. */
  testOutcome?: TestOutcome;
}
export interface PaymentResult {
  status: PaymentStatus;
  provider: string;
  providerReference: string;
}
export interface PaymentGateway {
  readonly name: string;
  pay(request: PaymentRequest): Promise<PaymentResult>;
}

const OUTCOME_STATUS: Record<TestOutcome, PaymentStatus> = {
  success: "PAID",
  pending: "PENDING",
  failed: "FAILED",
  cancelled: "CANCELLED",
};

/** Deterministic provider for development and tests (like a gateway's test keys). */
export class TestModeGateway implements PaymentGateway {
  readonly name = "test-mode";
  async pay(request: PaymentRequest): Promise<PaymentResult> {
    if (!Number.isSafeInteger(request.amountPaise) || request.amountPaise <= 0)
      throw new RangeError(
        "Payment amount must be a positive whole number of paise.",
      );
    return {
      status: OUTCOME_STATUS[request.testOutcome ?? "success"],
      provider: this.name,
      providerReference: `TEST-${randomUUID().slice(0, 8).toUpperCase()}`,
    };
  }
}

export function getPaymentGateway(): PaymentGateway {
  return new TestModeGateway();
}
