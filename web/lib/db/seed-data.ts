import type { Category, Product } from "../../../shared/contracts";

/** Initial catalog and accounts loaded into an empty database. */
export const SAMPLE_PASSWORD = "Industrihub@123";

export const seedUsers = [
  {
    id: "USR-0001",
    role: "CUSTOMER",
    firstName: "Srushti",
    lastName: "Shinde",
    email: "srushti.shinde@apexmotion.in",
    phone: "+91 98765 43210",
    companyName: "Apex Motion Industries",
    gstin: "27ABCDE1234F1Z5",
  },
  {
    id: "USR-0002",
    role: "SUPPLIER",
    firstName: "Rohan",
    lastName: "Patil",
    email: "rohan.patil@precisionworks.in",
    phone: "+91 98220 11223",
    companyName: "Precision Works Pune",
    gstin: "27AAFCP4321K1Z8",
  },
  {
    id: "USR-0003",
    role: "ADMIN",
    firstName: "Meera",
    lastName: "Iyer",
    email: "operations@industrihub.in",
    phone: "+91 20 4000 1000",
    companyName: "INDUSTRIHUB",
    gstin: "27AAICI9876M1Z2",
  },
  {
    id: "USR-0004",
    role: "SUPPLIER",
    firstName: "Kiran",
    lastName: "Jadhav",
    email: "kiran.jadhav@shakticastings.in",
    phone: "+91 98500 44556",
    companyName: "Shakti Castings Kolhapur",
    gstin: "27AAKCS5566P1Z3",
  },
] as const;

export const seedSuppliers = [
  {
    id: "SUP-0001",
    userId: "USR-0002",
    companyName: "Precision Works Pune",
    gstin: "27AAFCP4321K1Z8",
    city: "Pune",
    state: "Maharashtra",
    capabilities:
      "CNC milling, CNC turning, Sheet metal fabrication; ISO 9001:2015",
    verificationStatus: "VERIFIED",
  },
  {
    id: "SUP-0002",
    userId: "USR-0004",
    companyName: "Shakti Castings Kolhapur",
    gstin: "27AAKCS5566P1Z3",
    city: "Kolhapur",
    state: "Maharashtra",
    capabilities: "Casting, Forging, Welding and fabrication",
    verificationStatus: "PENDING",
  },
] as const;

export const seedAddresses = [
  {
    id: "ADR-0001",
    userId: "USR-0001",
    label: "Factory",
    line1: "Plot 42, MIDC Bhosari",
    line2: "Near Telco Road",
    city: "Pune",
    state: "Maharashtra",
    pincode: "411026",
    isDefault: true,
  },
];

export const seedCategories: Category[] = [
  { slug: "bearings", name: "Bearings", group: "mechanical" },
  { slug: "fasteners", name: "Fasteners", group: "mechanical" },
  { slug: "pneumatics", name: "Pneumatics", group: "mechanical" },
  {
    slug: "electrical-components",
    name: "Electrical Components",
    group: "electrical",
  },
  {
    slug: "automation-products",
    name: "Automation Products",
    group: "automation",
  },
  { slug: "tools", name: "Tools", group: "tools" },
  { slug: "gears", name: "Gears", group: "mechanical" },
  { slug: "shafts", name: "Shafts", group: "mechanical" },
  { slug: "couplings", name: "Couplings", group: "mechanical" },
];

type SeedProduct = Pick<
  Product,
  | "name"
  | "slug"
  | "sku"
  | "category"
  | "brand"
  | "pricePaise"
  | "description"
  | "symbol"
> &
  Partial<Product>;

const productInputs: SeedProduct[] = [
  {
    name: "SKF Deep Groove Bearing 6205",
    slug: "skf-6205-2rs1-bearing",
    sku: "SKF-6205-2RS1",
    category: "bearings",
    brand: "SKF",
    pricePaise: 48500,
    description: "25×52×15 mm · Sealed",
    image: "/figma/b1f9a.png",
    symbol: "◎",
    featured: true,
  },
  {
    name: "Hex Bolt M8 — Zinc Plated",
    slug: "hex-bolt-m8-zinc-plated",
    sku: "TVS-M8-30-100",
    category: "fasteners",
    brand: "TVS",
    pricePaise: 128000,
    description: "Class 8.8 · 100 pc pack",
    symbol: "⬡",
    featured: true,
  },
  {
    name: "Pneumatic Cylinder SC32×50",
    slug: "pneumatic-cylinder-sc32-50",
    sku: "SMC-SC32-50",
    category: "pneumatics",
    brand: "SMC",
    pricePaise: 389000,
    description: "32 mm bore · Double acting",
    image: "/figma/c8645.png",
    symbol: "↕",
    featured: true,
  },
  {
    name: "Industrial Contactor 3P 32A",
    slug: "industrial-contactor-3p-32a",
    sku: "SCH-LC1D32",
    category: "electrical-components",
    brand: "Schneider",
    pricePaise: 224000,
    description: "32 A · 18.5 kW · DIN rail",
    symbol: "ϟ",
    image: "/figma/fedcf.png",
  },
  {
    name: "Lovejoy L-095 Coupling",
    slug: "lovejoy-l095-coupling",
    sku: "LJ-L095-19",
    category: "couplings",
    brand: "Lovejoy",
    pricePaise: 126000,
    description: "Bore 19 mm · NBR spider",
    symbol: "⧉",
  },
  {
    name: "Omron Inductive Sensor",
    slug: "omron-inductive-sensor",
    sku: "OM-E2E-M18",
    category: "automation-products",
    brand: "Omron",
    pricePaise: 189000,
    description: "M18 · PNP NO · 2 m cable",
    symbol: "⌁",
  },
  {
    name: "FAG Angular Contact Bearing",
    slug: "fag-7205-bearing",
    sku: "FAG-7205-B",
    category: "bearings",
    brand: "FAG",
    pricePaise: 97500,
    description: "25×52×15 mm · Open",
    symbol: "◎",
  },
  {
    name: "HSS Twist Drill Set",
    slug: "hss-twist-drill-set",
    sku: "BOS-HSS-19",
    category: "tools",
    brand: "Bosch",
    pricePaise: 159900,
    description: "1–10 mm · 19 pieces",
    symbol: "▦",
  },
  {
    name: "EN8 Spur Gear Module 2",
    slug: "en8-spur-gear-module-2",
    sku: "IH-GEAR-M2-30",
    category: "gears",
    brand: "INDUSTRIHUB",
    pricePaise: 84500,
    description: "30 teeth · EN8 steel",
    symbol: "⚙",
  },
  {
    name: "Precision Ground Shaft 20 mm",
    slug: "precision-shaft-20mm",
    sku: "IH-SHAFT-20-500",
    category: "shafts",
    brand: "INDUSTRIHUB",
    pricePaise: 138000,
    description: "20×500 mm · h6 tolerance",
    symbol: "↔",
  },
  {
    name: "Pneumatic Solenoid Valve 5/2",
    slug: "smc-solenoid-valve-5-2",
    sku: "SMC-SY5120-24",
    category: "pneumatics",
    brand: "SMC",
    pricePaise: 245000,
    description: "24 V DC · G1/4 port",
    symbol: "↕",
    stockQuantity: 0,
  },
  {
    name: "Siemens Miniature Circuit Breaker",
    slug: "siemens-mcb-16a",
    sku: "SIE-5SL-16",
    category: "electrical-components",
    brand: "Siemens",
    pricePaise: 36500,
    description: "16 A · C curve · Single pole",
    symbol: "ϟ",
  },
];

export const seedProducts: Product[] = productInputs.map((input, index) => ({
  id: `PRD-${String(index + 1).padStart(4, "0")}`,
  gstPercent: 18,
  stockQuantity: 120 - index * 7,
  specifications: {
    "Country of origin": "India",
    "Supply condition": "New",
    GST: "18%",
  },
  image: null,
  featured: false,
  ...input,
}));
