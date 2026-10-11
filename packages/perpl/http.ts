import { decode, encode } from './codec';
import { TESTNET } from './config';
import { restHeaders, type ApiCredential } from './auth';

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); this.name = 'ApiError'; } }
export class PerplHttp {
  constructor(private fetcher: typeof fetch = fetch) {}
  async request(target: string, options: { method?: string; body?: unknown; key?: ApiCredential; origin?: string } = {}): Promise<unknown> {
    if (!target.startsWith('/v1/') || /[\r\n]/.test(target)) throw new Error('API_TARGET_INVALID');
    const method = options.method ?? 'GET'; const body = options.body === undefined ? '' : encode(options.body);
    const headers: Record<string,string> = { Accept: 'application/json', ...(body ? {'Content-Type':'application/json'} : {}) };
    if (options.origin) headers.Origin = options.origin;
    if (options.key) Object.assign(headers, await restHeaders(options.key, method, target, body));
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await this.fetcher(`${TESTNET.api}${target}`, { method, headers, ...(body ? {body} : {}), signal: controller.signal });
      const raw = await response.text();
      if (!response.ok) throw new ApiError(response.status, response.status === 423 ? 'Batas 16 API key aktif tercapai. Kelola key di Perpl.' : response.status === 409 ? 'Public key sudah terdaftar. Jangan ulang enrollment otomatis.' : response.status === 403 ? 'Akses ditolak. Periksa whitelist Origin dan scope key.' : `Perpl HTTP ${response.status}`);
      return decode(raw);
    } finally { clearTimeout(timeout); }
  }
}
