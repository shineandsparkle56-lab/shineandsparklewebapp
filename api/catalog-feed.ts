import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

// Map your category slugs to Google Product Category IDs
// https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt
const CATEGORY_MAP: Record<string, string> = {
  rings:           "188",   // Jewelry > Rings
  earrings:        "191",   // Jewelry > Earrings
  necklaces:       "194",   // Jewelry > Necklaces
  bracelets:       "189",   // Jewelry > Bracelets
  pendants:        "194",   // Jewelry > Necklaces (closest match for pendants)
  jhumka:          "191",   // Jhumka = Earrings
  "cuff-bracelets":"189",   // Cuff bracelets = Bracelets
};

// Human-readable product_type labels — used for WhatsApp Collections filtering
const PRODUCT_TYPE_MAP: Record<string, string> = {
  rings:           "Rings",
  earrings:        "Earrings",
  necklaces:       "Necklaces",
  bracelets:       "Bracelets",
  pendants:        "Pendants",
  jhumka:          "Earrings",       // Jhumkas appear in Earrings collection
  "cuff-bracelets":"Bracelets",      // Cuffs appear in Bracelets collection
};

function escapeCsv(value: string | number | undefined | null): string {
  const str = String(value ?? "");
  // Wrap in quotes if it contains comma, quote, or newline
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

interface ProductRow {
  id: number;
  name: string;
  description: string;
  price: number;
  original_price: number;
  image: string;
  images: string[] | null;
  category: string;
  stock: number;
  variants: Array<{ id: string; label: string; images: string[]; stock: number; price?: number }> | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow Meta's crawler to fetch this feed
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).send("Method not allowed");

  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
    return res.status(500).send("Supabase environment variables not configured");
  }

  try {
    // Fetch all products with stock > 0 (paginate in batches of 1000)
    let allProducts: ProductRow[] = [];
    let from = 0;
    const batchSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, description, price, original_price, image, images, category, stock, variants")
        .order("id", { ascending: true })
        .range(from, from + batchSize - 1);

      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;

      allProducts = allProducts.concat(data as ProductRow[]);
      if (data.length < batchSize) break;
      from += batchSize;
    }

    // CSV header — Meta Commerce Manager required + recommended fields
    const headers = [
      "id",
      "title",
      "description",
      "availability",
      "condition",
      "price",
      "link",
      "image_link",
      "brand",
      "google_product_category",
      "sale_price",
      "additional_image_link",
      "product_type",   // used for WhatsApp Collections filtering
    ];

    const rows: string[] = [headers.join(",")];

    const STORE_URL = "https://shineandsparkle.in";
    const BRAND = "Shine and Sparkle";

    for (const product of allProducts) {
      const variants: ProductRow["variants"] = Array.isArray(product.variants)
        ? product.variants
        : [];

      if (variants.length > 0) {
        // Emit one row per variant (each gets a unique id like "212__silver")
        for (const variant of variants) {
          const variantStock = variant.stock ?? 0;
          const variantPrice = variant.price ?? product.price;
          const availability = variantStock > 0 ? "in stock" : "out of stock";
          const coverImage = variant.images?.[0] || product.image;
          const additionalImages = (variant.images ?? []).slice(1).join("|");

          // price field = original (MRP); sale_price = actual selling price
          const priceFormatted = `${product.original_price}.00 INR`;
          const salePriceFormatted = `${variantPrice}.00 INR`;

          const googleCategory =
            CATEGORY_MAP[product.category?.toLowerCase()] ?? "188";

          const row = [
            escapeCsv(`${product.id}__${variant.id}`),
            escapeCsv(`${product.name} - ${variant.label}`),
            escapeCsv(product.description || product.name),
            escapeCsv(availability),
            escapeCsv("new"),
            escapeCsv(priceFormatted),
            escapeCsv(`${STORE_URL}/product/${product.id}`),
            escapeCsv(coverImage),
            escapeCsv(BRAND),
            escapeCsv(googleCategory),
            escapeCsv(salePriceFormatted),
            escapeCsv(additionalImages),
            escapeCsv(PRODUCT_TYPE_MAP[product.category?.toLowerCase()] ?? product.category),
          ];
          rows.push(row.join(","));
        }
      } else {
        // No variants — single row per product
        const availability = product.stock > 0 ? "in stock" : "out of stock";
        const allImages: string[] = Array.isArray(product.images) && product.images.length > 0
          ? product.images
          : [product.image];
        const coverImage = allImages[0];
        const additionalImages = allImages.slice(1).join("|");

        const priceFormatted = `${product.original_price}.00 INR`;
        const salePriceFormatted = `${product.price}.00 INR`;

        const googleCategory =
          CATEGORY_MAP[product.category?.toLowerCase()] ?? "188";

        const row = [
          escapeCsv(product.id),
          escapeCsv(product.name),
          escapeCsv(product.description || product.name),
          escapeCsv(availability),
          escapeCsv("new"),
          escapeCsv(priceFormatted),
          escapeCsv(`${STORE_URL}/product/${product.id}`),
          escapeCsv(coverImage),
          escapeCsv(BRAND),
          escapeCsv(googleCategory),
          escapeCsv(salePriceFormatted),
          escapeCsv(additionalImages),
          escapeCsv(PRODUCT_TYPE_MAP[product.category?.toLowerCase()] ?? product.category),
        ];
        rows.push(row.join(","));
      }
    }

    const csv = rows.join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="catalog-feed.csv"'
    );
    // Cache for 1 hour — Meta will re-fetch on its own schedule
    res.setHeader("Cache-Control", "public, max-age=3600");

    return res.status(200).send(csv);
  } catch (err) {
    const e = err as Error;
    console.error("[catalog-feed]", e.message);
    return res.status(500).send(`Error generating feed: ${e.message}`);
  }
}
