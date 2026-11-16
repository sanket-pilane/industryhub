/** The payments table has no method column, so the method rides on the provider name. */
export const encodeProvider = (provider: string, method: string) =>
  `${provider}/${method}`;

export function describeProvider(stored: string) {
  const [provider, method] = stored.split("/");
  const name = provider === "test-mode" ? "Test mode" : provider;
  return method ? `${name} · ${method}` : name;
}
