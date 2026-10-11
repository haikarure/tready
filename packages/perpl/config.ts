import { digest } from '../domain/plan';
import { bool, list, record, safeNumber, text, u64 } from './codec';

export const TESTNET = { chainId: 10143 as const, api: 'https://testnet.perpl.xyz/api', ws: 'wss://testnet.perpl.xyz', rpc: 'https://testnet-rpc.monad.xyz', exchange: '0x1964c32f0be608e7d29302aff5e61268e72080cc', collateral: '0xa9012a055bd4e0edff8ce09f960291c09d5322dc', faucet: '0xd236c18d274e54faccc3dd9dda4b27965a73ee6c' };
export interface MarketConfig { chainId: 10143; instanceId: bigint; marketId: bigint; perpetualId: bigint; exchange: string; collateral: string; collateralDecimals: number; priceDecimals: number; sizeDecimals: number; initialMargin: number; maintenanceMargin: number; takerFees: number[]; recycleFee: bigint; minOpen: bigint; minDeposit: bigint; minWithdraw: bigint; minSettle: bigint; ttlBlocks: bigint; maxSlippageBps: number; isOpen: boolean; digest: string }
export function resolveConfig(payload: unknown): MarketConfig {
  const root = record(payload); const chain = record(root.chain);
  if (safeNumber(chain.chain_id) !== TESTNET.chainId) throw new Error('NETWORK_MISMATCH');
  const markets = list(root.markets).map(record).filter(m => m.size_units === 'BTC');
  if (markets.length !== 1) throw new Error('BTC_MARKET_AMBIGUOUS');
  const market = markets[0]!;
  const instance = list(root.instances).map(record).find(x => u64(x.id) === u64(market.instance_id));
  if (!instance) throw new Error('INSTANCE_MISSING');
  const token = list(root.tokens).map(record).find(x => u64(x.id) === u64(instance.collateral_token_id));
  if (!token) throw new Error('COLLATERAL_MISSING');
  if (text(instance.address).toLowerCase() !== TESTNET.exchange || text(token.address).toLowerCase() !== TESTNET.collateral || token.symbol !== 'AUSD' || safeNumber(token.decimals) !== 6) throw new Error('DEPLOYMENT_REVIEW_REQUIRED');
  const cfg = record(market.config);
  const config = { chainId: TESTNET.chainId, instanceId: u64(instance.id), marketId: u64(market.id), perpetualId: u64(market.perpetual_id), exchange: text(instance.address), collateral: text(token.address), collateralDecimals: safeNumber(token.decimals), priceDecimals: safeNumber(cfg.price_decimals), sizeDecimals: safeNumber(cfg.size_decimals), initialMargin: safeNumber(cfg.initial_margin), maintenanceMargin: safeNumber(cfg.maintenance_margin), takerFees: list(cfg.taker_fees).map(safeNumber), recycleFee: u64(cfg.recycle_fee), minOpen: u64(instance.min_account_open_amount), minDeposit: u64(instance.min_deposit_amount), minWithdraw: u64(instance.min_withdraw_amount), minSettle: u64(cfg.min_settle_amount), ttlBlocks: u64(market.order_ttl_blocks), maxSlippageBps: safeNumber(market.order_max_market_slippage_bps), isOpen: bool(cfg.is_open) };
  if (config.ttlBlocks === 0n || config.takerFees.length === 0 || config.priceDecimals > 8 || config.sizeDecimals > 10) throw new Error('CONFIG_UNSUPPORTED');
  return { ...config, digest: digest(config) };
}
