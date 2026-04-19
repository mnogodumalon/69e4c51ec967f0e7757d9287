// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export interface Kundenverwaltung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    nachname?: string;
    email?: string;
    telefon?: string;
    strasse?: string;
    hausnummer?: string;
    plz?: string;
    ort?: string;
    notfall_vorname?: string;
    notfall_nachname?: string;
    notfall_telefon?: string;
    anmerkungen?: string;
    vorname?: string;
  };
}

export interface Katzenverwaltung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    besitzer?: string; // applookup -> URL zu 'Kundenverwaltung' Record
    katze_name?: string;
    rasse?: string;
    geburtsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    geschlecht?: LookupValue;
    farbe?: string;
    kastriert?: boolean;
    impfstatus?: LookupValue[];
    impfpass_foto?: string;
    tierarzt_vorname?: string;
    tierarzt_nachname?: string;
    tierarzt_telefon?: string;
    medikamente?: string;
    allergien?: string;
    fuetterung?: string;
    verhalten?: string;
    katze_foto?: string;
  };
}

export interface Zimmerverwaltung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    zimmer_name?: string;
    zimmer_typ?: LookupValue;
    kapazitaet?: number;
    tagespreis?: number;
    beschreibung?: string;
    ausstattung?: LookupValue[];
    zimmer_status?: LookupValue;
    zimmer_foto?: string;
  };
}

export interface Leistungsverwaltung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    leistung_name?: string;
    leistung_beschreibung?: string;
    preis?: number;
    preiseinheit?: LookupValue;
    leistung_kategorie?: LookupValue;
  };
}

export interface Buchungsverwaltung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    buchungsnummer?: string;
    buchungsstatus?: LookupValue;
    anreise?: string; // Format: YYYY-MM-DD oder ISO String
    abreise?: string; // Format: YYYY-MM-DD oder ISO String
    kunde?: string; // applookup -> URL zu 'Kundenverwaltung' Record
    katzen?: string; // applookup -> URL zu 'Katzenverwaltung' Record
    zimmer?: string; // applookup -> URL zu 'Zimmerverwaltung' Record
    zusatzleistungen?: string; // applookup -> URL zu 'Leistungsverwaltung' Record
    gesamtpreis?: number;
    anzahlung?: number;
    zahlungsstatus?: LookupValue;
    buchungshinweise?: string;
  };
}

export interface Gesundheitsprotokoll {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    buchung?: string; // applookup -> URL zu 'Buchungsverwaltung' Record
    katze?: string; // applookup -> URL zu 'Katzenverwaltung' Record
    protokoll_datum?: string; // Format: YYYY-MM-DD oder ISO String
    fressverhalten?: LookupValue;
    aktivitaet?: LookupValue;
    befinden?: LookupValue;
    medikamente_verabreicht?: boolean;
    medikamente_notiz?: string;
    beobachtungen?: string;
    protokoll_foto?: string;
  };
}

export const APP_IDS = {
  KUNDENVERWALTUNG: '69e4c4c98eb47c71ad1956f9',
  KATZENVERWALTUNG: '69e4c4d0b9f510e8ee94ecc0',
  ZIMMERVERWALTUNG: '69e4c4d1c6f3ba44887a782b',
  LEISTUNGSVERWALTUNG: '69e4c4d20db815a323b93354',
  BUCHUNGSVERWALTUNG: '69e4c4d3d0b075a7e61dc8ac',
  GESUNDHEITSPROTOKOLL: '69e4c4d4bb4e3a7690ac9854',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'katzenverwaltung': {
    geschlecht: [{ key: "weiblich", label: "Weiblich" }, { key: "maennlich", label: "Männlich" }, { key: "unbekannt", label: "Unbekannt" }],
    impfstatus: [{ key: "tollwut", label: "Tollwut" }, { key: "katzenseuche", label: "Katzenseuche" }, { key: "katzenschnupfen", label: "Katzenschnupfen" }, { key: "leukose", label: "Leukose" }, { key: "sonstige", label: "Sonstige" }],
  },
  'zimmerverwaltung': {
    zimmer_typ: [{ key: "einzelzimmer", label: "Einzelzimmer" }, { key: "doppelzimmer", label: "Doppelzimmer" }, { key: "suite", label: "Suite" }, { key: "freigehege", label: "Freigehege" }],
    ausstattung: [{ key: "kletterbaum", label: "Kletterbaum" }, { key: "fensterplatz", label: "Fensterplatz" }, { key: "kuschelhoehle", label: "Kuschelhöhle" }, { key: "spielzeug", label: "Spielzeug" }, { key: "heizung", label: "Heizung" }, { key: "kamera", label: "Kameraüberwachung" }, { key: "freigehege_zugang", label: "Freigehege-Zugang" }],
    zimmer_status: [{ key: "verfuegbar", label: "Verfügbar" }, { key: "belegt", label: "Belegt" }, { key: "reinigung", label: "In Reinigung" }, { key: "gesperrt", label: "Gesperrt" }],
  },
  'leistungsverwaltung': {
    preiseinheit: [{ key: "pro_tag", label: "Pro Tag" }, { key: "pro_sitzung", label: "Pro Sitzung" }, { key: "einmalig", label: "Einmalig" }, { key: "pro_woche", label: "Pro Woche" }],
    leistung_kategorie: [{ key: "pflege", label: "Pflege" }, { key: "tierarzt", label: "Tierarzt" }, { key: "spielen", label: "Spielen & Beschäftigung" }, { key: "transport", label: "Transport" }, { key: "sonstiges", label: "Sonstiges" }],
  },
  'buchungsverwaltung': {
    buchungsstatus: [{ key: "anfrage", label: "Anfrage" }, { key: "bestaetigt", label: "Bestätigt" }, { key: "eingecheckt", label: "Eingecheckt" }, { key: "ausgecheckt", label: "Ausgecheckt" }, { key: "storniert", label: "Storniert" }],
    zahlungsstatus: [{ key: "offen", label: "Offen" }, { key: "anzahlung_erhalten", label: "Anzahlung erhalten" }, { key: "bezahlt", label: "Vollständig bezahlt" }, { key: "erstattet", label: "Erstattet" }],
  },
  'gesundheitsprotokoll': {
    fressverhalten: [{ key: "sehr_gut", label: "Sehr gut" }, { key: "gut", label: "Gut" }, { key: "maessig", label: "Mäßig" }, { key: "schlecht", label: "Schlecht" }, { key: "verweigert", label: "Verweigert" }],
    aktivitaet: [{ key: "sehr_aktiv", label: "Sehr aktiv" }, { key: "normal", label: "Normal" }, { key: "ruhig", label: "Ruhig" }, { key: "apathisch", label: "Apathisch" }],
    befinden: [{ key: "sehr_gut", label: "Sehr gut" }, { key: "gut", label: "Gut" }, { key: "auffaellig", label: "Auffällig" }, { key: "krank", label: "Krank" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'kundenverwaltung': {
    'nachname': 'string/text',
    'email': 'string/email',
    'telefon': 'string/tel',
    'strasse': 'string/text',
    'hausnummer': 'string/text',
    'plz': 'string/text',
    'ort': 'string/text',
    'notfall_vorname': 'string/text',
    'notfall_nachname': 'string/text',
    'notfall_telefon': 'string/tel',
    'anmerkungen': 'string/textarea',
    'vorname': 'string/text',
  },
  'katzenverwaltung': {
    'besitzer': 'applookup/select',
    'katze_name': 'string/text',
    'rasse': 'string/text',
    'geburtsdatum': 'date/date',
    'geschlecht': 'lookup/radio',
    'farbe': 'string/text',
    'kastriert': 'bool',
    'impfstatus': 'multiplelookup/checkbox',
    'impfpass_foto': 'file',
    'tierarzt_vorname': 'string/text',
    'tierarzt_nachname': 'string/text',
    'tierarzt_telefon': 'string/tel',
    'medikamente': 'string/textarea',
    'allergien': 'string/textarea',
    'fuetterung': 'string/textarea',
    'verhalten': 'string/textarea',
    'katze_foto': 'file',
  },
  'zimmerverwaltung': {
    'zimmer_name': 'string/text',
    'zimmer_typ': 'lookup/select',
    'kapazitaet': 'number',
    'tagespreis': 'number',
    'beschreibung': 'string/textarea',
    'ausstattung': 'multiplelookup/checkbox',
    'zimmer_status': 'lookup/radio',
    'zimmer_foto': 'file',
  },
  'leistungsverwaltung': {
    'leistung_name': 'string/text',
    'leistung_beschreibung': 'string/textarea',
    'preis': 'number',
    'preiseinheit': 'lookup/radio',
    'leistung_kategorie': 'lookup/select',
  },
  'buchungsverwaltung': {
    'buchungsnummer': 'string/text',
    'buchungsstatus': 'lookup/select',
    'anreise': 'date/datetimeminute',
    'abreise': 'date/datetimeminute',
    'kunde': 'applookup/select',
    'katzen': 'applookup/select',
    'zimmer': 'applookup/select',
    'zusatzleistungen': 'applookup/select',
    'gesamtpreis': 'number',
    'anzahlung': 'number',
    'zahlungsstatus': 'lookup/select',
    'buchungshinweise': 'string/textarea',
  },
  'gesundheitsprotokoll': {
    'buchung': 'applookup/select',
    'katze': 'applookup/select',
    'protokoll_datum': 'date/date',
    'fressverhalten': 'lookup/radio',
    'aktivitaet': 'lookup/radio',
    'befinden': 'lookup/radio',
    'medikamente_verabreicht': 'bool',
    'medikamente_notiz': 'string/textarea',
    'beobachtungen': 'string/textarea',
    'protokoll_foto': 'file',
  },
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateKundenverwaltung = StripLookup<Kundenverwaltung['fields']>;
export type CreateKatzenverwaltung = StripLookup<Katzenverwaltung['fields']>;
export type CreateZimmerverwaltung = StripLookup<Zimmerverwaltung['fields']>;
export type CreateLeistungsverwaltung = StripLookup<Leistungsverwaltung['fields']>;
export type CreateBuchungsverwaltung = StripLookup<Buchungsverwaltung['fields']>;
export type CreateGesundheitsprotokoll = StripLookup<Gesundheitsprotokoll['fields']>;