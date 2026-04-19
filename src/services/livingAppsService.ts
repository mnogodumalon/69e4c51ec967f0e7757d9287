// AUTOMATICALLY GENERATED SERVICE
import { APP_IDS, LOOKUP_OPTIONS, FIELD_TYPES } from '@/types/app';
import type { Kundenverwaltung, Katzenverwaltung, Zimmerverwaltung, Leistungsverwaltung, Buchungsverwaltung, Gesundheitsprotokoll, CreateKundenverwaltung, CreateKatzenverwaltung, CreateZimmerverwaltung, CreateLeistungsverwaltung, CreateBuchungsverwaltung, CreateGesundheitsprotokoll } from '@/types/app';

// Base Configuration
const API_BASE_URL = 'https://my.living-apps.de/rest';

// --- HELPER FUNCTIONS ---
export function extractRecordId(url: unknown): string | null {
  if (!url) return null;
  if (typeof url !== 'string') return null;
  const match = url.match(/([a-f0-9]{24})$/i);
  return match ? match[1] : null;
}

export function createRecordUrl(appId: string, recordId: string): string {
  return `https://my.living-apps.de/rest/apps/${appId}/records/${recordId}`;
}

async function callApi(method: string, endpoint: string, data?: any) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',  // Nutze Session Cookies für Auth
    body: data ? JSON.stringify(data) : undefined
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) window.dispatchEvent(new Event('auth-error'));
    throw new Error(await response.text());
  }
  // DELETE returns often empty body or simple status
  if (method === 'DELETE') return true;
  return response.json();
}

/** Upload a file to LivingApps. Returns the file URL for use in record fields. */
export async function uploadFile(file: File | Blob, filename?: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file, filename ?? (file instanceof File ? file.name : 'upload'));
  const res = await fetch(`${API_BASE_URL}/files`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) window.dispatchEvent(new Event('auth-error'));
    throw new Error(`File upload failed: ${res.status}`);
  }
  const data = await res.json();
  return data.url;
}

function enrichLookupFields<T extends { fields: Record<string, unknown> }>(
  records: T[], entityKey: string
): T[] {
  const opts = LOOKUP_OPTIONS[entityKey];
  if (!opts) return records;
  return records.map(r => {
    const fields = { ...r.fields };
    for (const [fieldKey, options] of Object.entries(opts)) {
      const val = fields[fieldKey];
      if (typeof val === 'string') {
        const m = options.find(o => o.key === val);
        fields[fieldKey] = m ?? { key: val, label: val };
      } else if (Array.isArray(val)) {
        fields[fieldKey] = val.map(v => {
          if (typeof v === 'string') {
            const m = options.find(o => o.key === v);
            return m ?? { key: v, label: v };
          }
          return v;
        });
      }
    }
    return { ...r, fields } as T;
  });
}

/** Normalize fields for API writes: strip lookup objects to keys, fix date formats. */
export function cleanFieldsForApi(
  fields: Record<string, unknown>,
  entityKey: string
): Record<string, unknown> {
  const clean: Record<string, unknown> = { ...fields };
  for (const [k, v] of Object.entries(clean)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && 'key' in v) clean[k] = (v as any).key;
    if (Array.isArray(v)) clean[k] = v.map((item: any) => item && typeof item === 'object' && 'key' in item ? item.key : item);
  }
  const types = FIELD_TYPES[entityKey];
  if (types) {
    for (const [k, ft] of Object.entries(types)) {
      if (!(k in clean)) continue;
      const val = clean[k];
      // applookup fields: undefined → null (clear single reference)
      if ((ft === 'applookup/select' || ft === 'applookup/choice') && val === undefined) { clean[k] = null; continue; }
      // multipleapplookup fields: undefined/null → [] (clear multi reference)
      if ((ft === 'multipleapplookup/select' || ft === 'multipleapplookup/choice') && (val === undefined || val === null)) { clean[k] = []; continue; }
      // lookup fields: undefined → null (clear single lookup)
      if ((ft.startsWith('lookup/')) && val === undefined) { clean[k] = null; continue; }
      // multiplelookup fields: undefined/null → [] (clear multi lookup)
      if ((ft.startsWith('multiplelookup/')) && (val === undefined || val === null)) { clean[k] = []; continue; }
      if (typeof val !== 'string' || !val) continue;
      if (ft === 'date/datetimeminute') clean[k] = val.slice(0, 16);
      else if (ft === 'date/date') clean[k] = val.slice(0, 10);
    }
  }
  return clean;
}

let _cachedUserProfile: Record<string, unknown> | null = null;

export async function getUserProfile(): Promise<Record<string, unknown>> {
  if (_cachedUserProfile) return _cachedUserProfile;
  const raw = await callApi('GET', '/user');
  const skip = new Set(['id', 'image', 'lang', 'gender', 'title', 'fax', 'menus', 'initials']);
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v != null && !skip.has(k)) data[k] = v;
  }
  _cachedUserProfile = data;
  return data;
}

export interface HeaderProfile {
  firstname: string;
  surname: string;
  email: string;
  image: string | null;
  company: string | null;
}

let _cachedHeaderProfile: HeaderProfile | null = null;

export async function getHeaderProfile(): Promise<HeaderProfile> {
  if (_cachedHeaderProfile) return _cachedHeaderProfile;
  const raw = await callApi('GET', '/user');
  _cachedHeaderProfile = {
    firstname: raw.firstname ?? '',
    surname: raw.surname ?? '',
    email: raw.email ?? '',
    image: raw.image ?? null,
    company: raw.company ?? null,
  };
  return _cachedHeaderProfile;
}

export interface AppGroupInfo {
  id: string;
  name: string;
  image: string | null;
  createdat: string;
  /** Resolved link: /objects/{id}/ if the dashboard exists, otherwise /gateway/apps/{firstAppId}?template=list_page */
  href: string;
}

let _cachedAppGroups: AppGroupInfo[] | null = null;

export async function getAppGroups(): Promise<AppGroupInfo[]> {
  if (_cachedAppGroups) return _cachedAppGroups;
  const raw = await callApi('GET', '/appgroups?with=apps');
  const groups: AppGroupInfo[] = Object.values(raw)
    .map((g: any) => {
      const firstAppId = Object.keys(g.apps ?? {})[0] ?? g.id;
      return {
        id: g.id,
        name: g.name,
        image: g.image ?? null,
        createdat: g.createdat ?? '',
        href: `/gateway/apps/${firstAppId}?template=list_page`,
        _firstAppId: firstAppId,
      };
    })
    .sort((a, b) => b.createdat.localeCompare(a.createdat));

  // Check which appgroups have a deployed dashboard via app params
  const paramChecks = await Promise.allSettled(
    groups.map(g => callApi('GET', `/apps/${(g as any)._firstAppId}/params/la_page_header_additional_url`))
  );
  paramChecks.forEach((result, i) => {
    if (result.status !== 'fulfilled' || !result.value) return;
    const url = result.value.value;
    if (typeof url === 'string' && url.length > 0) {
      try { groups[i].href = new URL(url).pathname; } catch { groups[i].href = url; }
    }
  });

  // Clean up internal helper property
  groups.forEach(g => delete (g as any)._firstAppId);

  _cachedAppGroups = groups;
  return _cachedAppGroups;
}

export class LivingAppsService {
  // --- KUNDENVERWALTUNG ---
  static async getKundenverwaltung(): Promise<Kundenverwaltung[]> {
    const data = await callApi('GET', `/apps/${APP_IDS.KUNDENVERWALTUNG}/records`);
    const records = Object.entries(data).map(([id, rec]: [string, any]) => ({
      record_id: id, ...rec
    })) as Kundenverwaltung[];
    return enrichLookupFields(records, 'kundenverwaltung');
  }
  static async getKundenverwaltungEntry(id: string): Promise<Kundenverwaltung | undefined> {
    const data = await callApi('GET', `/apps/${APP_IDS.KUNDENVERWALTUNG}/records/${id}`);
    const record = { record_id: data.id, ...data } as Kundenverwaltung;
    return enrichLookupFields([record], 'kundenverwaltung')[0];
  }
  static async createKundenverwaltungEntry(fields: CreateKundenverwaltung) {
    return callApi('POST', `/apps/${APP_IDS.KUNDENVERWALTUNG}/records`, { fields: cleanFieldsForApi(fields as any, 'kundenverwaltung') });
  }
  static async updateKundenverwaltungEntry(id: string, fields: Partial<CreateKundenverwaltung>) {
    return callApi('PATCH', `/apps/${APP_IDS.KUNDENVERWALTUNG}/records/${id}`, { fields: cleanFieldsForApi(fields as any, 'kundenverwaltung') });
  }
  static async deleteKundenverwaltungEntry(id: string) {
    return callApi('DELETE', `/apps/${APP_IDS.KUNDENVERWALTUNG}/records/${id}`);
  }

  // --- KATZENVERWALTUNG ---
  static async getKatzenverwaltung(): Promise<Katzenverwaltung[]> {
    const data = await callApi('GET', `/apps/${APP_IDS.KATZENVERWALTUNG}/records`);
    const records = Object.entries(data).map(([id, rec]: [string, any]) => ({
      record_id: id, ...rec
    })) as Katzenverwaltung[];
    return enrichLookupFields(records, 'katzenverwaltung');
  }
  static async getKatzenverwaltungEntry(id: string): Promise<Katzenverwaltung | undefined> {
    const data = await callApi('GET', `/apps/${APP_IDS.KATZENVERWALTUNG}/records/${id}`);
    const record = { record_id: data.id, ...data } as Katzenverwaltung;
    return enrichLookupFields([record], 'katzenverwaltung')[0];
  }
  static async createKatzenverwaltungEntry(fields: CreateKatzenverwaltung) {
    return callApi('POST', `/apps/${APP_IDS.KATZENVERWALTUNG}/records`, { fields: cleanFieldsForApi(fields as any, 'katzenverwaltung') });
  }
  static async updateKatzenverwaltungEntry(id: string, fields: Partial<CreateKatzenverwaltung>) {
    return callApi('PATCH', `/apps/${APP_IDS.KATZENVERWALTUNG}/records/${id}`, { fields: cleanFieldsForApi(fields as any, 'katzenverwaltung') });
  }
  static async deleteKatzenverwaltungEntry(id: string) {
    return callApi('DELETE', `/apps/${APP_IDS.KATZENVERWALTUNG}/records/${id}`);
  }

  // --- ZIMMERVERWALTUNG ---
  static async getZimmerverwaltung(): Promise<Zimmerverwaltung[]> {
    const data = await callApi('GET', `/apps/${APP_IDS.ZIMMERVERWALTUNG}/records`);
    const records = Object.entries(data).map(([id, rec]: [string, any]) => ({
      record_id: id, ...rec
    })) as Zimmerverwaltung[];
    return enrichLookupFields(records, 'zimmerverwaltung');
  }
  static async getZimmerverwaltungEntry(id: string): Promise<Zimmerverwaltung | undefined> {
    const data = await callApi('GET', `/apps/${APP_IDS.ZIMMERVERWALTUNG}/records/${id}`);
    const record = { record_id: data.id, ...data } as Zimmerverwaltung;
    return enrichLookupFields([record], 'zimmerverwaltung')[0];
  }
  static async createZimmerverwaltungEntry(fields: CreateZimmerverwaltung) {
    return callApi('POST', `/apps/${APP_IDS.ZIMMERVERWALTUNG}/records`, { fields: cleanFieldsForApi(fields as any, 'zimmerverwaltung') });
  }
  static async updateZimmerverwaltungEntry(id: string, fields: Partial<CreateZimmerverwaltung>) {
    return callApi('PATCH', `/apps/${APP_IDS.ZIMMERVERWALTUNG}/records/${id}`, { fields: cleanFieldsForApi(fields as any, 'zimmerverwaltung') });
  }
  static async deleteZimmerverwaltungEntry(id: string) {
    return callApi('DELETE', `/apps/${APP_IDS.ZIMMERVERWALTUNG}/records/${id}`);
  }

  // --- LEISTUNGSVERWALTUNG ---
  static async getLeistungsverwaltung(): Promise<Leistungsverwaltung[]> {
    const data = await callApi('GET', `/apps/${APP_IDS.LEISTUNGSVERWALTUNG}/records`);
    const records = Object.entries(data).map(([id, rec]: [string, any]) => ({
      record_id: id, ...rec
    })) as Leistungsverwaltung[];
    return enrichLookupFields(records, 'leistungsverwaltung');
  }
  static async getLeistungsverwaltungEntry(id: string): Promise<Leistungsverwaltung | undefined> {
    const data = await callApi('GET', `/apps/${APP_IDS.LEISTUNGSVERWALTUNG}/records/${id}`);
    const record = { record_id: data.id, ...data } as Leistungsverwaltung;
    return enrichLookupFields([record], 'leistungsverwaltung')[0];
  }
  static async createLeistungsverwaltungEntry(fields: CreateLeistungsverwaltung) {
    return callApi('POST', `/apps/${APP_IDS.LEISTUNGSVERWALTUNG}/records`, { fields: cleanFieldsForApi(fields as any, 'leistungsverwaltung') });
  }
  static async updateLeistungsverwaltungEntry(id: string, fields: Partial<CreateLeistungsverwaltung>) {
    return callApi('PATCH', `/apps/${APP_IDS.LEISTUNGSVERWALTUNG}/records/${id}`, { fields: cleanFieldsForApi(fields as any, 'leistungsverwaltung') });
  }
  static async deleteLeistungsverwaltungEntry(id: string) {
    return callApi('DELETE', `/apps/${APP_IDS.LEISTUNGSVERWALTUNG}/records/${id}`);
  }

  // --- BUCHUNGSVERWALTUNG ---
  static async getBuchungsverwaltung(): Promise<Buchungsverwaltung[]> {
    const data = await callApi('GET', `/apps/${APP_IDS.BUCHUNGSVERWALTUNG}/records`);
    const records = Object.entries(data).map(([id, rec]: [string, any]) => ({
      record_id: id, ...rec
    })) as Buchungsverwaltung[];
    return enrichLookupFields(records, 'buchungsverwaltung');
  }
  static async getBuchungsverwaltungEntry(id: string): Promise<Buchungsverwaltung | undefined> {
    const data = await callApi('GET', `/apps/${APP_IDS.BUCHUNGSVERWALTUNG}/records/${id}`);
    const record = { record_id: data.id, ...data } as Buchungsverwaltung;
    return enrichLookupFields([record], 'buchungsverwaltung')[0];
  }
  static async createBuchungsverwaltungEntry(fields: CreateBuchungsverwaltung) {
    return callApi('POST', `/apps/${APP_IDS.BUCHUNGSVERWALTUNG}/records`, { fields: cleanFieldsForApi(fields as any, 'buchungsverwaltung') });
  }
  static async updateBuchungsverwaltungEntry(id: string, fields: Partial<CreateBuchungsverwaltung>) {
    return callApi('PATCH', `/apps/${APP_IDS.BUCHUNGSVERWALTUNG}/records/${id}`, { fields: cleanFieldsForApi(fields as any, 'buchungsverwaltung') });
  }
  static async deleteBuchungsverwaltungEntry(id: string) {
    return callApi('DELETE', `/apps/${APP_IDS.BUCHUNGSVERWALTUNG}/records/${id}`);
  }

  // --- GESUNDHEITSPROTOKOLL ---
  static async getGesundheitsprotokoll(): Promise<Gesundheitsprotokoll[]> {
    const data = await callApi('GET', `/apps/${APP_IDS.GESUNDHEITSPROTOKOLL}/records`);
    const records = Object.entries(data).map(([id, rec]: [string, any]) => ({
      record_id: id, ...rec
    })) as Gesundheitsprotokoll[];
    return enrichLookupFields(records, 'gesundheitsprotokoll');
  }
  static async getGesundheitsprotokollEntry(id: string): Promise<Gesundheitsprotokoll | undefined> {
    const data = await callApi('GET', `/apps/${APP_IDS.GESUNDHEITSPROTOKOLL}/records/${id}`);
    const record = { record_id: data.id, ...data } as Gesundheitsprotokoll;
    return enrichLookupFields([record], 'gesundheitsprotokoll')[0];
  }
  static async createGesundheitsprotokollEntry(fields: CreateGesundheitsprotokoll) {
    return callApi('POST', `/apps/${APP_IDS.GESUNDHEITSPROTOKOLL}/records`, { fields: cleanFieldsForApi(fields as any, 'gesundheitsprotokoll') });
  }
  static async updateGesundheitsprotokollEntry(id: string, fields: Partial<CreateGesundheitsprotokoll>) {
    return callApi('PATCH', `/apps/${APP_IDS.GESUNDHEITSPROTOKOLL}/records/${id}`, { fields: cleanFieldsForApi(fields as any, 'gesundheitsprotokoll') });
  }
  static async deleteGesundheitsprotokollEntry(id: string) {
    return callApi('DELETE', `/apps/${APP_IDS.GESUNDHEITSPROTOKOLL}/records/${id}`);
  }

}