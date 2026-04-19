import type { Buchungsverwaltung, Gesundheitsprotokoll, Katzenverwaltung } from './app';

export type EnrichedKatzenverwaltung = Katzenverwaltung & {
  besitzerName: string;
};

export type EnrichedBuchungsverwaltung = Buchungsverwaltung & {
  kundeName: string;
  katzenName: string;
  zimmerName: string;
  zusatzleistungenName: string;
};

export type EnrichedGesundheitsprotokoll = Gesundheitsprotokoll & {
  buchungName: string;
  katzeName: string;
};
