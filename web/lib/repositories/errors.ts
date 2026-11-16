/** Domain error raised by data-access code; mapped to an HTTP response by handleApiError. */
export class RepositoryError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "RepositoryError";
  }
}

export const notFound = (what: string) =>
  new RepositoryError("NOT_FOUND", `${what} was not found.`, 404);
