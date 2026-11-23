import { createLucideIcon } from "lucide-react";

/** Peças que faltam no Lucide e no Bootstrap Icons, no mesmo traço: 24×24, só linha. */
function createClothingIcon(name: string, paths: string[]) {
  return createLucideIcon(
    name,
    paths.map((d) => ["path", { d, key: d }] as ["path", { d: string; key: string }]),
  );
}

export const Trousers = createClothingIcon("trousers", [
  "M6 3h12l2 18h-5.5L12 10 9.5 21H4z",
  "M5.6 7h12.8",
]);

export const Shorts = createClothingIcon("shorts", ["M5 5h14l2 14h-7l-2-7-2 7H3z", "M4.4 9h15.2"]);

export const DressShirt = createClothingIcon("dress-shirt", [
  "M8 3 2.5 6 4 11.5 7 11v10h10V11l3 .5L21.5 6 16 3",
  "m8 3 4 4.5L16 3z",
  "M12 12h.01",
  "M12 16.5h.01",
]);

export const Dress = createClothingIcon("dress", [
  "M9 3v3L8 9l1.5 3L5 21h14l-4.5-9L16 9l-1-3V3",
  "M9 6c1.5 2 4.5 2 6 0",
  "M9.5 12h5",
]);

export const Jacket = createClothingIcon("jacket", [
  "M8 3 4.5 4.5 2 15h4v6h12v-6h4L19.5 4.5 16 3",
  "m8 3 4 4 4-4z",
  "M12 7v14",
  "M6 15V9.5",
  "M18 15V9.5",
]);

export const Underwear = createClothingIcon("underwear", [
  "M3 6h18v5c-4 .5-6.5 3-7 7h-4c-.5-4-3-6.5-7-7z",
  "M3 9h18",
]);

export const Sock = createClothingIcon("sock", [
  "M9 3h8v8.5a4 4 0 0 1-1.2 2.8l-5.6 5.6a3.5 3.5 0 0 1-5-5L9 11z",
  "M9 7h8",
]);

export const Sneaker = createClothingIcon("sneaker", [
  "M2 8v10a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-1c0-2-1.3-3.2-3.2-3.7L15 12.3 9 6.5C8 8.5 4.5 9.5 2 8",
  "M2 15.5h19.5",
  "m10.5 11 1.8-1.7",
]);

export const Cap = createClothingIcon("cap", [
  "M4 16v-3a7 7 0 0 1 14 0v2",
  "M4 16c4-1.5 8-1.5 11 0 2 1 4.5 1.2 7 .5-.5-1.2-2-2-4-1.5",
  "M11 6V4.5",
]);
