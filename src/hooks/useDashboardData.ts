import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Kundenverwaltung, Katzenverwaltung, Zimmerverwaltung, Leistungsverwaltung, Buchungsverwaltung, Gesundheitsprotokoll } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';

export function useDashboardData() {
  const [kundenverwaltung, setKundenverwaltung] = useState<Kundenverwaltung[]>([]);
  const [katzenverwaltung, setKatzenverwaltung] = useState<Katzenverwaltung[]>([]);
  const [zimmerverwaltung, setZimmerverwaltung] = useState<Zimmerverwaltung[]>([]);
  const [leistungsverwaltung, setLeistungsverwaltung] = useState<Leistungsverwaltung[]>([]);
  const [buchungsverwaltung, setBuchungsverwaltung] = useState<Buchungsverwaltung[]>([]);
  const [gesundheitsprotokoll, setGesundheitsprotokoll] = useState<Gesundheitsprotokoll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [kundenverwaltungData, katzenverwaltungData, zimmerverwaltungData, leistungsverwaltungData, buchungsverwaltungData, gesundheitsprotokollData] = await Promise.all([
        LivingAppsService.getKundenverwaltung(),
        LivingAppsService.getKatzenverwaltung(),
        LivingAppsService.getZimmerverwaltung(),
        LivingAppsService.getLeistungsverwaltung(),
        LivingAppsService.getBuchungsverwaltung(),
        LivingAppsService.getGesundheitsprotokoll(),
      ]);
      setKundenverwaltung(kundenverwaltungData);
      setKatzenverwaltung(katzenverwaltungData);
      setZimmerverwaltung(zimmerverwaltungData);
      setLeistungsverwaltung(leistungsverwaltungData);
      setBuchungsverwaltung(buchungsverwaltungData);
      setGesundheitsprotokoll(gesundheitsprotokollData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    async function silentRefresh() {
      try {
        const [kundenverwaltungData, katzenverwaltungData, zimmerverwaltungData, leistungsverwaltungData, buchungsverwaltungData, gesundheitsprotokollData] = await Promise.all([
          LivingAppsService.getKundenverwaltung(),
          LivingAppsService.getKatzenverwaltung(),
          LivingAppsService.getZimmerverwaltung(),
          LivingAppsService.getLeistungsverwaltung(),
          LivingAppsService.getBuchungsverwaltung(),
          LivingAppsService.getGesundheitsprotokoll(),
        ]);
        setKundenverwaltung(kundenverwaltungData);
        setKatzenverwaltung(katzenverwaltungData);
        setZimmerverwaltung(zimmerverwaltungData);
        setLeistungsverwaltung(leistungsverwaltungData);
        setBuchungsverwaltung(buchungsverwaltungData);
        setGesundheitsprotokoll(gesundheitsprotokollData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

  const kundenverwaltungMap = useMemo(() => {
    const m = new Map<string, Kundenverwaltung>();
    kundenverwaltung.forEach(r => m.set(r.record_id, r));
    return m;
  }, [kundenverwaltung]);

  const katzenverwaltungMap = useMemo(() => {
    const m = new Map<string, Katzenverwaltung>();
    katzenverwaltung.forEach(r => m.set(r.record_id, r));
    return m;
  }, [katzenverwaltung]);

  const zimmerverwaltungMap = useMemo(() => {
    const m = new Map<string, Zimmerverwaltung>();
    zimmerverwaltung.forEach(r => m.set(r.record_id, r));
    return m;
  }, [zimmerverwaltung]);

  const leistungsverwaltungMap = useMemo(() => {
    const m = new Map<string, Leistungsverwaltung>();
    leistungsverwaltung.forEach(r => m.set(r.record_id, r));
    return m;
  }, [leistungsverwaltung]);

  const buchungsverwaltungMap = useMemo(() => {
    const m = new Map<string, Buchungsverwaltung>();
    buchungsverwaltung.forEach(r => m.set(r.record_id, r));
    return m;
  }, [buchungsverwaltung]);

  return { kundenverwaltung, setKundenverwaltung, katzenverwaltung, setKatzenverwaltung, zimmerverwaltung, setZimmerverwaltung, leistungsverwaltung, setLeistungsverwaltung, buchungsverwaltung, setBuchungsverwaltung, gesundheitsprotokoll, setGesundheitsprotokoll, loading, error, fetchAll, kundenverwaltungMap, katzenverwaltungMap, zimmerverwaltungMap, leistungsverwaltungMap, buchungsverwaltungMap };
}