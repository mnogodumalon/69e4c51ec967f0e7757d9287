import type { EnrichedBuchungsverwaltung, EnrichedGesundheitsprotokoll, EnrichedKatzenverwaltung } from '@/types/enriched';
import type { Buchungsverwaltung, Gesundheitsprotokoll, Katzenverwaltung, Kundenverwaltung, Leistungsverwaltung, Zimmerverwaltung } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface KatzenverwaltungMaps {
  kundenverwaltungMap: Map<string, Kundenverwaltung>;
}

export function enrichKatzenverwaltung(
  katzenverwaltung: Katzenverwaltung[],
  maps: KatzenverwaltungMaps
): EnrichedKatzenverwaltung[] {
  return katzenverwaltung.map(r => ({
    ...r,
    besitzerName: resolveDisplay(r.fields.besitzer, maps.kundenverwaltungMap, 'vorname', 'nachname'),
  }));
}

interface BuchungsverwaltungMaps {
  kundenverwaltungMap: Map<string, Kundenverwaltung>;
  katzenverwaltungMap: Map<string, Katzenverwaltung>;
  zimmerverwaltungMap: Map<string, Zimmerverwaltung>;
  leistungsverwaltungMap: Map<string, Leistungsverwaltung>;
}

export function enrichBuchungsverwaltung(
  buchungsverwaltung: Buchungsverwaltung[],
  maps: BuchungsverwaltungMaps
): EnrichedBuchungsverwaltung[] {
  return buchungsverwaltung.map(r => ({
    ...r,
    kundeName: resolveDisplay(r.fields.kunde, maps.kundenverwaltungMap, 'vorname', 'nachname'),
    katzenName: resolveDisplay(r.fields.katzen, maps.katzenverwaltungMap, 'katze_name'),
    zimmerName: resolveDisplay(r.fields.zimmer, maps.zimmerverwaltungMap, 'zimmer_name'),
    zusatzleistungenName: resolveDisplay(r.fields.zusatzleistungen, maps.leistungsverwaltungMap, 'leistung_name'),
  }));
}

interface GesundheitsprotokollMaps {
  buchungsverwaltungMap: Map<string, Buchungsverwaltung>;
  katzenverwaltungMap: Map<string, Katzenverwaltung>;
}

export function enrichGesundheitsprotokoll(
  gesundheitsprotokoll: Gesundheitsprotokoll[],
  maps: GesundheitsprotokollMaps
): EnrichedGesundheitsprotokoll[] {
  return gesundheitsprotokoll.map(r => ({
    ...r,
    buchungName: resolveDisplay(r.fields.buchung, maps.buchungsverwaltungMap, 'buchungsnummer'),
    katzeName: resolveDisplay(r.fields.katze, maps.katzenverwaltungMap, 'katze_name'),
  }));
}
