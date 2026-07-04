import heroImg from "../assets/hero.png";
import ring1 from "../assets/products/ring-1.png";
import earrings1 from "../assets/products/earrings-1.png";
import necklace1 from "../assets/products/necklace-1.png";
import bracelet1 from "../assets/products/bracelet-1.png";
import earrings2 from "../assets/products/earrings-2.png";
import ring2 from "../assets/products/ring-2.png";
import necklace2 from "../assets/products/necklace-2.png";
import bracelet2 from "../assets/products/bracelet-2.png";

export interface Product {
  id: number;
  name: string;
  category: "rings" | "earrings" | "necklaces" | "bracelets";
  price: number;
  originalPrice: number;
  discount: number;
  image: string;       // primary image (kept for backwards compat)
  images: string[];    // all images; first entry matches `image`
  description: string;
  sizes: string[];
}

export const products: Product[] = [
  {
    id: 1,
    name: "Rose Petal Ring",
    category: "rings",
    price: 799,
    originalPrice: 1199,
    discount: 33,
    image: ring1,
    images: [ring1, ring2],
    description:
      "Inspired by the delicate curve of a rose in full bloom, this ring features a sculpted petal setting in anti-tarnish gold-plated brass. Lightweight and comfortable for all-day wear, it pairs beautifully with stacked rings or stands alone as a statement piece.",
    sizes: ["5", "6", "7", "8", "9"],
  },
  {
    id: 2,
    name: "Pearl Drop Earrings",
    category: "earrings",
    price: 649,
    originalPrice: 899,
    discount: 28,
    image: earrings1,
    images: [earrings1, earrings2],
    description:
      "Timeless freshwater pearl drops suspended from a delicate gold-plated hook. The soft luster of each pearl catches the light beautifully, making these earrings perfect for both everyday elegance and special occasions.",
    sizes: ["One Size"],
  },
  {
    id: 3,
    name: "Moonlit Necklace",
    category: "necklaces",
    price: 1299,
    originalPrice: 1799,
    discount: 28,
    image: necklace1,
    images: [necklace1, necklace2],
    description:
      "A crescent moon pendant encrusted with micro-pavé crystals, suspended on a dainty 18-inch gold-plated chain. A dreamy everyday piece that adds just the right amount of sparkle — like moonlight caught in silver.",
    sizes: ["16 inch", "18 inch", "20 inch"],
  },
  {
    id: 4,
    name: "Floral Bangle Set",
    category: "bracelets",
    price: 899,
    originalPrice: 1299,
    discount: 31,
    image: bracelet1,
    images: [bracelet1, bracelet2],
    description:
      "A set of three stackable bangles, each adorned with a different floral motif — rose, daisy, and jasmine. Crafted in anti-tarnish silver-tone metal, they clink together with a satisfying softness that feels entirely luxurious.",
    sizes: ["Small (6.5\")", "Medium (7\")", "Large (7.5\")"],
  },
  {
    id: 5,
    name: "Star Dust Earrings",
    category: "earrings",
    price: 549,
    originalPrice: 799,
    discount: 31,
    image: earrings2,
    images: [earrings2, earrings1],
    description:
      "Long, linear drop earrings featuring a constellation of hand-set cubic zirconia stones that shimmer and move with you. Light as a feather, bold as the night sky — these are your go-to for a touch of drama.",
    sizes: ["One Size"],
  },
  {
    id: 6,
    name: "Vine Wrap Ring",
    category: "rings",
    price: 699,
    originalPrice: 999,
    discount: 30,
    image: ring2,
    images: [ring2, ring1],
    description:
      "An intricate vine pattern winds its way around the finger in this beautifully crafted open-band ring. Set with tiny emerald-green stones along the vine, it evokes a garden at golden hour — alive, lush, and endlessly romantic.",
    sizes: ["5", "6", "7", "8", "9"],
  },
  {
    id: 7,
    name: "Crystal Choker",
    category: "necklaces",
    price: 1499,
    originalPrice: 2099,
    discount: 29,
    image: necklace2,
    images: [necklace2, necklace1],
    description:
      "A statement choker set with rows of hand-placed Austrian crystals on a flexible velvet ribbon. Adjustable at the back, it sits perfectly at the collarbone and transforms any neckline — from casual to couture.",
    sizes: ["13 inch", "14 inch", "15 inch"],
  },
  {
    id: 8,
    name: "Charm Link Bracelet",
    category: "bracelets",
    price: 849,
    originalPrice: 1199,
    discount: 29,
    image: bracelet2,
    images: [bracelet2, bracelet1],
    description:
      "A delicate gold-plated chain bracelet hung with five hand-picked charms — a star, a crescent moon, a tiny heart, a flower, and a teardrop crystal. Each charm tells a story. Wear all five, or mix with your favorites.",
    sizes: ["Small (6.5\")", "Medium (7\")", "Large (7.5\")"],
  },
];

export const heroImage = heroImg;
