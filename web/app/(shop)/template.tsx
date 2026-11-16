/** Re-mounts on every navigation so each page fades up into place. */
export default function ShopTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="page-enter">{children}</div>;
}
