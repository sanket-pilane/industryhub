export function formatMoney(paise: number) {
  if (!Number.isSafeInteger(paise) || paise < 0)
    throw new RangeError("Money must be a non-negative safe integer in paise.");
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

/** Round once per line; future authoritative calculation belongs in the function. */
export function lineTotal(
  unitPricePaise: number,
  quantity: number,
  gstPercent: number,
) {
  if (
    ![unitPricePaise, quantity, gstPercent].every(Number.isSafeInteger) ||
    unitPricePaise < 0 ||
    quantity < 1 ||
    gstPercent < 0 ||
    gstPercent > 100
  )
    throw new RangeError("Invalid price, quantity or GST rate.");
  const subtotalPaise = unitPricePaise * quantity;
  const numerator = subtotalPaise * gstPercent;
  if (!Number.isSafeInteger(numerator + 50))
    throw new RangeError("Total exceeds supported range.");
  const taxPaise = Math.floor((numerator + 50) / 100);
  const totalPaise = subtotalPaise + taxPaise;
  if (!Number.isSafeInteger(totalPaise))
    throw new RangeError("Total exceeds supported range.");
  return { subtotalPaise, taxPaise, totalPaise };
}
