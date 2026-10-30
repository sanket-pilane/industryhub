import type {
  Category,
  CartItem,
  ManufacturingRequest,
  Order,
  Product,
  Quotation,
  SupportTicket,
  UserProfile,
} from "../../shared/contracts";

export const demoCustomer: UserProfile = {
  id: "demo-customer-srushti",
  role: "CUSTOMER",
  firstName: "Srushti",
  lastName: "Shinde",
  initials: "SS",
  email: "srushti.shinde@apexmotion.in",
  phone: "+91 98765 43210",
  companyName: "Apex Motion Industries",
  gstin: "27ABCDE1234F1Z5",
};
export const categories: Category[] = [
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
export const products: Product[] = productInputs.map((input, index) => ({
  id: `demo-product-${index + 1}`,
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
export const quotations: Quotation[] = [
  {
    id: "QT-55019",
    customerId: demoCustomer.id,
    partName: "Gear Housing Rev-C",
    quantity: 25,
    material: "EN8 Steel",
    status: "QUOTED",
    totalPaise: 7350000,
    leadTimeDays: 12,
    version: 1,
    validUntil: "2026-11-15",
  },
  {
    id: "QT-55007",
    customerId: demoCustomer.id,
    partName: "Hydraulic Manifold",
    quantity: 40,
    material: "Aluminium 6061",
    status: "PENDING",
    totalPaise: 0,
    leadTimeDays: 0,
    version: 1,
    validUntil: "2026-11-15",
  },
  {
    id: "QT-54992",
    customerId: demoCustomer.id,
    partName: "Drive Shaft DS-41",
    quantity: 10,
    material: "SS304",
    status: "ACCEPTED",
    totalPaise: 4820000,
    leadTimeDays: 14,
    version: 2,
    validUntil: "2026-11-15",
  },
  {
    id: "QT-54975",
    customerId: demoCustomer.id,
    partName: "Laser-cut Guard",
    quantity: 100,
    material: "SS304",
    status: "QUOTED",
    totalPaise: 12400000,
    leadTimeDays: 8,
    version: 1,
    validUntil: "2026-11-15",
  },
];
// Deterministic future-flow fixtures; not exposed as completed workflows in Phase 0.
export const cart: CartItem[] = [
  { id: "demo-cart-1", productId: products[0].id, quantity: 3 },
];
export const orders: Order[] = [
  {
    id: "IH-2026-1042",
    customerId: demoCustomer.id,
    status: "DISPATCHED",
    totalPaise: 171690,
    trackingNumber: "DEMO-TRACK-1042",
  },
];
export const tickets: SupportTicket[] = [
  {
    id: "TK-1048",
    customerId: demoCustomer.id,
    subject: "Material certificate for order IH-2026-1042",
    status: "IN_PROGRESS",
  },
];
export const manufacturingRequests: ManufacturingRequest[] = [
  {
    id: "RFQ-IH-00984",
    customerId: demoCustomer.id,
    partName: "Gear Housing",
    quantity: 25,
    status: "SUBMITTED",
    history: [
      {
        id: "demo-history-1",
        from: "DRAFT",
        to: "SUBMITTED",
        changedByUserId: demoCustomer.id,
        changedAt: "2026-10-28T09:30:00Z",
        comment: "Drawing revision C submitted.",
      },
    ],
  },
];
export const supplierSeed = {
  supplierId: "demo-supplier-1",
  companyName: "Precision Works Pune",
  rfq: { id: "demo-rfq-1", requestId: "RFQ-IH-00984", status: "SENT" },
  job: { id: "demo-job-1", status: "IN_PRODUCTION", progressPercent: 45 },
  qc: {
    id: "demo-qc-1",
    documentType: "MATERIAL_CERTIFICATE",
    reviewStatus: "PENDING",
    fileName: "material-certificate.pdf",
  },
};
