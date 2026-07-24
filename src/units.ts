/* Author: Fabian Bitter (fabian@bitter.de) */

/** PostScript points per millimetre. */
export const PT_PER_MM = 72 / 25.4;

export const mmToPt = (mm: number): number => mm * PT_PER_MM;

export const ptToMm = (pt: number): number => pt / PT_PER_MM;

export const round = (value: number, decimals = 2): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};
