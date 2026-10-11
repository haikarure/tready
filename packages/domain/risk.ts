import { ceilDiv, MAX_U64, pow10 } from './units';

export type Side = 'long' | 'short';
export interface RiskInput {
  side: Side;
  budget: bigint;
  quoteEntry: bigint;
  entryBound: bigint;
  stop: bigint;
  stressExit: bigint;
  leverage: number;
  maxLeverage: number;
  maintenanceDenominator: number;
  takerFeeMicros: number;
  fundingReserve: bigint;
  operationalReserve: bigint;
  availableCollateral: bigint | null;
  priceDecimals: number;
  sizeDecimals: number;
  collateralDecimals: number;
  minNotional?: bigint;
  maxQuantity?: bigint;
}
export interface RiskQuote {
  quantity: bigint;
  riskMaximum: bigint;
  notional: bigint;
  margin: bigint;
  entryFee: bigint;
  exitFee: bigint;
  stopLoss: bigint;
  stressLoss: bigint;
  liquidationEstimate: bigint | null;
  constraint: 'risk' | 'collateral' | 'market';
  executable: boolean;
  reasons: string[];
}

export function calculateRisk(input: RiskInput): RiskQuote {
  const i = input;
  if(i.side!=='long'&&i.side!=='short')throw new Error('Side tidak valid.');
  if(i.maxQuantity!==undefined&&(i.maxQuantity<0n||i.maxQuantity>MAX_U64)||i.minNotional!==undefined&&i.minNotional<0n)throw new Error('Limit market tidak valid.');
  if (i.budget <= 0n || i.quoteEntry <= 0n || i.entryBound <= 0n || i.stop <= 0n || i.stressExit <= 0n) throw new Error('Budget dan harga harus lebih besar dari nol.');
  if (!Number.isInteger(i.leverage) || i.leverage < 100 || i.leverage > i.maxLeverage) throw new Error('Leverage di luar batas market.');
  if (!Number.isInteger(i.takerFeeMicros) || i.takerFeeMicros < 0 || i.takerFeeMicros > 1_000_000) throw new Error('Fee tidak valid.');
  if (!Number.isInteger(i.maintenanceDenominator) || i.maintenanceDenominator <= 100) throw new Error('Maintenance margin tidak valid.');
  if (i.fundingReserve < 0n || i.operationalReserve < 0n || (i.availableCollateral !== null && i.availableCollateral < 0n)) throw new Error('Reserve atau collateral tidak valid.');
  const long = i.side === 'long';
  if (long ? i.stop >= i.quoteEntry || i.entryBound < i.quoteEntry || i.stressExit > i.stop : i.stop <= i.quoteEntry || i.entryBound > i.quoteEntry || i.stressExit < i.stop) throw new Error('Arah stop, batas entry, atau stress exit tidak sesuai side.');
  const priceSizeScale = pow10(i.priceDecimals + i.sizeDecimals);
  const cashScale = pow10(i.collateralDecimals);
  const reserves = i.fundingReserve + i.operationalReserve;
  if (reserves >= i.budget) throw new Error('Reserve menghabiskan seluruh budget.');
  const adverse = (exit: bigint) => long ? i.entryBound - exit : exit - i.entryBound;
  const fee = (q: bigint, price: bigint) => ceilDiv(q * price * BigInt(i.takerFeeMicros) * cashScale, priceSizeScale * 1_000_000n);
  const margin = (q: bigint) => ceilDiv(q * i.entryBound * cashScale * 100n, priceSizeScale * BigInt(i.leverage));
  const loss = (q: bigint, exit: bigint) => ceilDiv(q * adverse(exit) * cashScale, priceSizeScale) + fee(q, i.entryBound) + fee(q, exit) + reserves;
  const search = (hi: bigint, valid: (q: bigint) => boolean): bigint => {
    let lo = 0n;
    while (lo < hi) { const mid = (lo + hi + 1n) / 2n; if (valid(mid)) lo = mid; else hi = mid - 1n; }
    return lo;
  };
  const riskMaximum = search(MAX_U64, q => loss(q, i.stressExit) <= i.budget);
  let quantity = riskMaximum;
  let constraint: RiskQuote['constraint'] = 'risk';
  if (i.availableCollateral !== null) {
    const affordable = search(quantity, q => margin(q) + fee(q, i.entryBound) + reserves <= i.availableCollateral!);
    if (affordable < quantity) { quantity = affordable; constraint = 'collateral'; }
  }
  if (i.maxQuantity !== undefined && i.maxQuantity < quantity) { quantity = i.maxQuantity; constraint = 'market'; }
  const notional = ceilDiv(quantity * i.entryBound * cashScale, priceSizeScale);
  const allocatedMargin = margin(quantity);
  const effective = allocatedMargin - fee(quantity, i.entryBound) - fee(quantity, i.stressExit) - i.fundingReserve;
  let liquidationEstimate: bigint | null = null;
  if (quantity > 0n && effective > 0n) {
    // Effective collateral belongs to this isolated position, not the whole account.
    const numerator = long ? quantity * i.entryBound * cashScale - effective * priceSizeScale : quantity * i.entryBound * cashScale + effective * priceSizeScale;
    const den = BigInt(i.maintenanceDenominator);
    const denominator = quantity * cashScale * (long ? den - 100n : den + 100n);
    liquidationEstimate = numerator <= 0n ? 0n : (long ? ceilDiv(numerator * den, denominator) : numerator * den / denominator);
  }
  const reasons: string[] = [];
  if (quantity === 0n) reasons.push('Budget atau collateral tidak cukup untuk satu lot.');
  if (i.availableCollateral === null) reasons.push('Collateral aktual belum diverifikasi.');
  if (i.minNotional !== undefined && notional < i.minNotional) reasons.push('Notional lebih kecil dari minimum market.');
  if (liquidationEstimate === null || (long ? i.stressExit <= liquidationEstimate : i.stressExit >= liquidationEstimate)) reasons.push('Stress exit melewati estimasi batas likuidasi atau headroom tidak diketahui.');
  return { quantity, riskMaximum, notional, margin: allocatedMargin, entryFee: fee(quantity, i.entryBound), exitFee: fee(quantity, i.stressExit), stopLoss: loss(quantity, i.stop), stressLoss: loss(quantity, i.stressExit), liquidationEstimate, constraint, executable: reasons.length === 0, reasons };
}
