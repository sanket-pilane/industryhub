const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function belowHundred(n: number) {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : "");
}
function belowThousand(n: number) {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return [
    hundreds ? `${ONES[hundreds]} Hundred` : "",
    rest ? belowHundred(rest) : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Whole number in Indian grouping: thousand, lakh, crore (and beyond, in crores). */
export function numberToIndianWords(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new RangeError("Expected a non-negative whole number.");
  if (value === 0) return "Zero";
  const crore = Math.floor(value / 10_000_000);
  const lakh = Math.floor((value % 10_000_000) / 100_000);
  const thousand = Math.floor((value % 100_000) / 1000);
  const rest = value % 1000;
  return [
    crore ? `${numberToIndianWords(crore)} Crore` : "",
    lakh ? `${belowHundred(lakh)} Lakh` : "",
    thousand ? `${belowHundred(thousand)} Thousand` : "",
    rest ? belowThousand(rest) : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** e.g. 2535050 paise -> "Rupees Twenty-Five Thousand Three Hundred Fifty and Fifty Paise Only". */
export function amountInWords(paise: number): string {
  if (!Number.isSafeInteger(paise) || paise < 0)
    throw new RangeError(
      "Amount must be a non-negative whole number of paise.",
    );
  const rupees = Math.floor(paise / 100);
  const remainder = paise % 100;
  const parts = [`Rupees ${numberToIndianWords(rupees)}`];
  if (remainder) parts.push(`${belowHundred(remainder)} Paise`);
  return `${parts.join(" and ")} Only`;
}
