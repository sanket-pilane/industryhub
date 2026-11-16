import { failure, handleApiError } from "@/lib/api/response";
import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { getDrawingStore } from "@/lib/drawings/store";
import { fileResponseHeaders, wantsInline } from "@/lib/storage/files";

/**
 * Serves a drawing (download, or `?inline=1` to view a PDF in the browser). Customers read their own; admins read any; a supplier
 * reads a drawing only when a job for that request is assigned to them.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiUser(["CUSTOMER", "SUPPLIER", "ADMIN"]);
    if (!auth.ok) return auth.response;
    const { user } = auth;
    const store = getDrawingStore();
    const drawing = await store.get((await context.params).id);
    const allowed =
      drawing !== null &&
      (user.role === "ADMIN" ||
        (user.role === "CUSTOMER" && drawing.customerId === user.id) ||
        (user.role === "SUPPLIER" &&
          getDb()
            .prepare(
              `SELECT 1 FROM jobs j JOIN suppliers s ON s.id = j.supplier_id
               WHERE j.request_id = ? AND s.user_id = ?`,
            )
            .get(drawing.id, user.id) !== undefined));
    if (!drawing || !allowed)
      return failure("NOT_FOUND", "Drawing not found.", 404);
    const data = await store.readFile(drawing.id);
    if (!data) return failure("NOT_FOUND", "Drawing not found.", 404);
    return new Response(data, {
      headers: fileResponseHeaders(drawing.file.name, wantsInline(request)),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
