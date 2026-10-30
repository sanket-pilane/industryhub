import { env } from "@/lib/env";
import { success } from "@/lib/api/response";
export function GET() {
  return success({
    service: "INDUSTRIHUB",
    mode: env.NEXT_PUBLIC_DATA_MODE,
    environment: env.NEXT_PUBLIC_CATALYST_ENV,
  });
}
