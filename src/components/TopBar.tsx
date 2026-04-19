import { useState, useEffect, useRef, useMemo } from 'react';
import { IconArrowsDownUp, IconFlask, IconPlus } from '@tabler/icons-react';
import { getHeaderProfile, getAppGroups } from '@/services/livingAppsService';
import type { HeaderProfile, AppGroupInfo } from '@/services/livingAppsService';
import { useActions } from '@/context/ActionsContext';

function AppsIcon({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <circle cx="5.83" cy="5.83" r="2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="11.67" y="3.33" width="5" height="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="3.33" y="11.67" width="5" height="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="14.17" cy="14.17" r="2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <circle cx="9.17" cy="9.17" r="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.67 16.67L12.92 12.92" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 5L15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}



const APPS_PER_PAGE = 12;

type SortMode = 'newest' | 'oldest' | 'az' | 'za';
const SORT_LABELS: Record<SortMode, string> = {
  newest: 'Neuste zuerst',
  oldest: 'Älteste zuerst',
  az: 'Name, A → Z',
  za: 'Name, Z → A',
};

export function TopBar() {
  const { devMode, setDevMode } = useActions();
  const [profile, setProfile] = useState<HeaderProfile | null>(null);
  const [appGroups, setAppGroups] = useState<AppGroupInfo[]>([]);
  const [appsOpen, setAppsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [sortOpen, setSortOpen] = useState(false);
  const [page, setPage] = useState(0);
  const appsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const preloadRef = useRef<HTMLImageElement[]>([]);

  useEffect(() => {
    getHeaderProfile().then(p => {
      setProfile(p);
      if (p.image) { const img = new Image(); img.src = p.image; preloadRef.current.push(img); }
    }).catch(() => {});
    getAppGroups().then(groups => {
      setAppGroups(groups);
      preloadRef.current = groups.filter(g => g.image).map(g => { const img = new Image(); img.src = g.image!; return img; });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (appsRef.current && !appsRef.current.contains(e.target as Node)) setAppsOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Reset dropdown state when apps menu closes
  useEffect(() => {
    if (!appsOpen) {
      setSearch('');
      setSortOpen(false);
      setPage(0);
    }
  }, [appsOpen]);

  const filtered = useMemo(() => {
    let list = appGroups;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(g => g.name.toLowerCase().includes(q));
    }
    list = [...list].sort((a, b) => {
      switch (sortMode) {
        case 'newest': return b.createdat.localeCompare(a.createdat);
        case 'oldest': return a.createdat.localeCompare(b.createdat);
        case 'az': return a.name.localeCompare(b.name);
        case 'za': return b.name.localeCompare(a.name);
      }
    });
    return list;
  }, [appGroups, search, sortMode]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / APPS_PER_PAGE));
  const paged = filtered.slice(page * APPS_PER_PAGE, (page + 1) * APPS_PER_PAGE);

  useEffect(() => { setPage(0); }, [search, sortMode]);

  const initials = profile
    ? `${profile.firstname?.[0] ?? ''}${profile.surname?.[0] ?? ''}`.toUpperCase()
    : '';

  return (
    <div className="flex items-center gap-3 lg:gap-5">
      {/* Apps */}
      <div ref={appsRef} className="relative">
        <button
          onClick={() => { setAppsOpen(!appsOpen); setProfileOpen(false); }}
          className="flex flex-col items-center gap-1 cursor-pointer"
        >
          <div className="flex items-center justify-center w-[35px] h-[35px] rounded-full bg-white shadow-[0px_0px_4px_rgba(155,155,155,0.5)]">
            <AppsIcon size={20} className="text-foreground" />
          </div>
          <span className="text-xs text-[#767676] hidden lg:block">Apps</span>
        </button>
        {appsOpen && appGroups.length > 0 && (
          <div className="fixed inset-x-3 top-[calc(var(--topbar-h)+0.5rem)] w-auto sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[360px] bg-white rounded-[23px] shadow-[0px_8px_32px_0px_rgba(0,0,0,0.08)] p-5 z-50">
            {/* Header */}
            <p className="font-semibold text-base text-[#767676] mb-3">Apps</p>

            {/* Search + Sort */}
            <div className="flex gap-3 items-center mb-6">
              <div className="flex-1 h-9 flex items-center justify-between px-4 py-0.5 bg-white rounded-[27px] shadow-[0px_0px_4px_0px_rgba(155,155,155,0.5)]">
                <input
                  type="text"
                  placeholder="Suche..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="flex-1 bg-transparent text-base outline-none placeholder:text-[#d9d9d9] min-w-0"
                />
                {search ? (
                  <button onClick={() => setSearch('')} className="shrink-0">
                    <CloseIcon size={20} className="text-foreground" />
                  </button>
                ) : (
                  <SearchIcon size={20} className="text-foreground shrink-0" />
                )}
              </div>
              <div ref={sortRef} className="relative shrink-0">
                <button
                  onClick={() => setSortOpen(!sortOpen)}
                  className={`flex items-center justify-center w-9 h-9 rounded-full shadow-[0px_0px_4px_0px_rgba(155,155,155,0.5)] ${sortOpen ? 'bg-[#d14600]/10' : 'bg-white'}`}
                >
                  <IconArrowsDownUp size={20} className={sortOpen ? 'text-[#d14600]' : 'text-foreground'} />
                </button>
                {sortOpen && (
                  <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-2xl shadow-[0px_8px_32px_0px_rgba(0,0,0,0.08)] py-2 z-50">
                    {(Object.keys(SORT_LABELS) as SortMode[]).map(mode => (
                      <button
                        key={mode}
                        onClick={() => { setSortMode(mode); setSortOpen(false); }}
                        className={`block w-full text-left px-4 py-2.5 text-base transition-colors ${
                          sortMode === mode ? 'text-[#d14600] font-medium' : 'text-foreground hover:bg-accent/50'
                        }`}
                      >
                        {SORT_LABELS[mode]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Apps Grid */}
            {paged.length > 0 ? (
              <div className="grid grid-cols-4 gap-x-1 gap-y-4">
                {paged.map(g => (
                  <a
                    key={g.id}
                    href={g.href}
                    className="flex flex-col items-center gap-1 p-1 rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    {g.image ? (
                      <img src={g.image} alt="" className="w-[54px] h-[54px] rounded-[13px] object-cover shrink-0" />
                    ) : (
                      <div className="w-[54px] h-[54px] rounded-[13px] bg-[rgba(155,155,155,0.5)] flex items-center justify-center shrink-0">
                        <AppsIcon size={20} className="text-white/70" />
                      </div>
                    )}
                    <span lang="de" className="text-xs text-[#767676] text-center w-full line-clamp-2 leading-tight" style={{hyphens: 'auto'}}>{g.name}</span>
                  </a>
                ))}
                {/* Create New App */}
                <a
                  href="/ki-2-la.htm"
                  className="col-span-4 grid grid-cols-4 gap-x-1 items-center mt-2 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex flex-col items-center p-1">
                    <div className="w-[54px] h-[54px] rounded-[13px] bg-[#d14600]/10 flex items-center justify-center">
                      <IconPlus size={24} className="text-[#d14600]" />
                    </div>
                  </div>
                  <span className="col-span-3 text-base text-[#374151]">Neue App erstellen</span>
                </a>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8 text-sm text-[#767676]">
                Keine Apps gefunden
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 mt-4 text-xs text-[#767676]">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="p-1 disabled:opacity-30"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <span>{page + 1}</span>
                <span>von</span>
                <span>{totalPages}</span>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1 disabled:opacity-30"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </div>
            )}

            {/* Divider + Klar Lab */}
            <div className="border-t border-border mt-4 pt-2">
              <a
                href="/claude/static/lab.html"
                className="flex items-center gap-2 px-2 py-2 rounded-2xl text-base text-[#374151] hover:bg-accent/50 transition-colors"
              >
                <IconFlask size={20} className="text-[#374151] shrink-0" />
                <span>Klar Lab (Beta Features)</span>
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Profile */}
      <div ref={profileRef} className="relative">
        <button
          onClick={() => { setProfileOpen(!profileOpen); setAppsOpen(false); }}
          className="flex flex-col items-center gap-1 cursor-pointer"
        >
          {profile?.image ? (
            <img src={profile.image} alt="" className="w-[35px] h-[35px] rounded-full object-cover" />
          ) : (
            <div className="w-[35px] h-[35px] rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
              {initials}
            </div>
          )}
          <span className="text-xs text-[#767676] hidden lg:block">Profil</span>
        </button>
        {profileOpen && profile && (
          <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-lg border border-border p-4 z-50">
            <div className="flex items-center gap-3">
              {profile.image ? (
                <img src={profile.image} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-lg font-medium text-muted-foreground shrink-0">
                  {initials}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{profile.firstname} {profile.surname}</p>
                <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                {profile.company && <p className="text-xs text-muted-foreground truncate mt-0.5">{profile.company}</p>}
              </div>
            </div>
            <div className="border-t border-border mt-3 pt-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={devMode}
                  onChange={e => setDevMode(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm text-foreground">Entwickler</span>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
