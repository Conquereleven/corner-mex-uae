// Parcel estimation for an order.
//
// A carrier quote is only as accurate as the parcel it describes. Most catalogue
// variants carry a weight (product_variants.weight_grams) but no dimensions yet,
// so this module produces a single consolidated parcel from what is known and
// reports, explicitly, what it had to assume. It never blocks an order because
// a SKU lacks data — it flags it.
//
// Single parcel today. `estimateParcels` returns an array so multi-package
// packing can replace the body without changing any caller.

import type { Parcel } from "./types.ts";

export type ParcelLine = {
  sku: string | null;
  qty: number;
  /** product_variants.weight_grams, or null when the SKU has no weight. */
  weightGrams: number | null;
  /** Optional per-unit dimensions in centimetres, when the SKU has them. */
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
};

export type ParcelRules = {
  /** Weight assumed for a unit whose SKU has no weight. */
  fallbackUnitWeightGrams: number;
  /** Packaging (box, filler) added to the goods' weight. */
  packagingWeightGrams: number;
  /** Boxes available, smallest first. The first that fits the volume is used. */
  boxes: ReadonlyArray<{ lengthCm: number; widthCm: number; heightCm: number }>;
  /** Density used to turn weight into volume when a SKU has no dimensions. */
  assumedDensityGramsPerCm3: number;
  /** Share of a box that goods can realistically fill. */
  fillRatio: number;
};

/**
 * Conservative operating defaults. These are packing assumptions, not carrier
 * facts, and are meant to be replaced by measured values per SKU. Every use is
 * reported in `ParcelEstimate.assumptions`.
 */
export const DEFAULT_PARCEL_RULES: ParcelRules = Object.freeze({
  fallbackUnitWeightGrams: 500,
  packagingWeightGrams: 200,
  boxes: Object.freeze([
    Object.freeze({ lengthCm: 20, widthCm: 15, heightCm: 10 }),
    Object.freeze({ lengthCm: 30, widthCm: 20, heightCm: 15 }),
    Object.freeze({ lengthCm: 40, widthCm: 30, heightCm: 20 }),
    Object.freeze({ lengthCm: 50, widthCm: 40, heightCm: 30 }),
    Object.freeze({ lengthCm: 60, widthCm: 40, heightCm: 40 }),
  ]),
  assumedDensityGramsPerCm3: 0.5,
  fillRatio: 0.8,
});

export type ParcelEstimate = {
  parcels: Parcel[];
  /** False when any weight or dimension was assumed rather than measured. */
  complete: boolean;
  /** SKUs whose weight was assumed. */
  missingWeight: string[];
  /** SKUs whose dimensions were derived from weight. */
  missingDimensions: string[];
  /** True when the goods exceed the largest configured box. */
  oversize: boolean;
};

const label = (line: ParcelLine, index: number) => line.sku ?? `line-${index + 1}`;

export function estimateParcels(
  lines: ParcelLine[],
  rules: ParcelRules = DEFAULT_PARCEL_RULES,
): ParcelEstimate {
  if (lines.length === 0 || lines.some((line) => !Number.isInteger(line.qty) || line.qty < 1)) {
    throw new Error("PARCEL_LINES_INVALID");
  }

  const missingWeight: string[] = [];
  const missingDimensions: string[] = [];
  let goodsGrams = 0;
  let volumeCm3 = 0;

  lines.forEach((line, index) => {
    const hasWeight = typeof line.weightGrams === "number" && line.weightGrams > 0;
    const unitGrams = hasWeight ? (line.weightGrams as number) : rules.fallbackUnitWeightGrams;
    if (!hasWeight) missingWeight.push(label(line, index));
    goodsGrams += unitGrams * line.qty;

    const dims = [line.lengthCm, line.widthCm, line.heightCm];
    if (dims.every((value) => typeof value === "number" && value > 0)) {
      volumeCm3 += (dims[0] as number) * (dims[1] as number) * (dims[2] as number) * line.qty;
    } else {
      missingDimensions.push(label(line, index));
      volumeCm3 += (unitGrams / rules.assumedDensityGramsPerCm3) * line.qty;
    }
  });

  const largest = rules.boxes[rules.boxes.length - 1];
  const box =
    rules.boxes.find(
      (candidate) =>
        candidate.lengthCm * candidate.widthCm * candidate.heightCm * rules.fillRatio >= volumeCm3,
    ) ?? largest;
  const oversize =
    largest.lengthCm * largest.widthCm * largest.heightCm * rules.fillRatio < volumeCm3;

  const weightKg = Math.max(
    0.1,
    // Round up to 10 g on integer grams, so float error cannot add a step.
    Math.ceil(Math.round(goodsGrams + rules.packagingWeightGrams) / 10) / 100,
  );

  return {
    parcels: [{ lengthCm: box.lengthCm, widthCm: box.widthCm, heightCm: box.heightCm, weightKg }],
    complete: missingWeight.length === 0 && missingDimensions.length === 0 && !oversize,
    missingWeight,
    missingDimensions,
    oversize,
  };
}
