import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, History, Search, ShieldAlert, X } from 'lucide-react';
import { db } from '../../services/pocketbase';
import { useDbTick } from '../../hooks/useDbSync';
import type { AksesEfektif, ModuleNavId, UserRole } from '../../types';
import { authFetch, type SesiLogin } from '../../utils/autentikasi';
import {
  executeRoleScopedSearch,
  PESAN_AKSES_PENCARIAN_DITOLAK,
  type GlobalSearchResponse,
  type GlobalSearchResultItem
} from '../../utils/globalSearch';
import type { SalesTab } from '../modules/commercial/SalesModule';
import type { ITSubTabId } from '../modules/supporting/ITModule';
import type { GudangTabId } from '../modules/operations/gudang/ui';

export interface SearchNavigationTarget {
  moduleId: ModuleNavId;
  salesSubTab?: SalesTab;
  itSubTab?: ITSubTabId;
  gudangTab?: GudangTabId;
}

interface GlobalSearchBarProps {
  aksesAktif: AksesEfektif;
  sesi?: SesiLogin;
  currentRole: UserRole;
  currentTab: string;
  onNavigate: (target: SearchNavigationTarget) => void;
  onRestrictedNotification: (message: string | null) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const tokens = useMemo(
    () =>
      Array.from(
        new Set(
          query
            .trim()
            .toLowerCase()
            .split(/\s+/)
            .filter((t) => t.length >= 2)
        )
      ),
    [query]
  );

  if (!text || tokens.length === 0) return <>{text}</>;
  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, idx) =>
        tokens.some((t) => part.toLowerCase() === t) ? (
          <mark key={idx} className="bg-amber-200/80 text-slate-900 rounded px-0.5 font-semibold">
            {part}
          </mark>
        ) : (
          <React.Fragment key={idx}>{part}</React.Fragment>
        )
      )}
    </>
  );
}

export default function GlobalSearchBar({
  aksesAktif,
  sesi,
  currentRole,
  currentTab,
  onNavigate,
  onRestrictedNotification,
  placeholder = 'Cari data / keyword...',
  className = '',
  autoFocus = false
}: GlobalSearchBarProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [searchActivated, setSearchActivated] = useState(autoFocus);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastLoggedRef = useRef<{ sig: string; at: number } | null>(null);
  const dbTick = useDbTick(['all']);

  useEffect(() => {
    if (autoFocus) {
      setSearchActivated(true);
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        const el = inputRef.current;
        if (!el || el.offsetParent === null) return;
        e.preventDefault();
        setSearchActivated(true);
        el.focus();
        el.select();
        setIsOpen(true);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const collections = useMemo(() => {
    void dbTick;
    if (!searchActivated || (!isOpen && query.trim().length < 2)) {
      return {};
    }
    return db.getAllSearchableCollections();
  }, [dbTick, searchActivated, isOpen, query]);

  const searchResult: GlobalSearchResponse = useMemo(
    () =>
      executeRoleScopedSearch({
        query,
        collections,
        aksesAktif,
        sesi,
        limit: 30
      }),
    [query, collections, aksesAktif, sesi]
  );

  const commitSearchLog = useCallback(
    (res: GlobalSearchResponse) => {
      const clean = res.query.trim();
      if (clean.length < 2) return;

      const sig = `${clean.toLowerCase()}|${res.totalAllowedMatches}|${res.restrictedMatchCount}`;
      const now = Date.now();
      if (lastLoggedRef.current && lastLoggedRef.current.sig === sig && now - lastLoggedRef.current.at < 3000) {
        return;
      }
      lastLoggedRef.current = { sig, at: now };

      setRecentQueries((prev) => [clean, ...prev.filter((q) => q.toLowerCase() !== clean.toLowerCase())].slice(0, 5));

      const pengguna = sesi?.namaLengkap || sesi?.namaPengguna || currentRole;
      const peran = sesi?.namaPeran || currentRole;
      const aktivitas =
        res.restrictedMatchCount > 0
          ? `Pencarian keyword "${clean}" — akses dibatasi role (${res.restrictedMatchCount} data di modul terbatas, ${res.totalAllowedMatches} hasil diizinkan)`
          : `Pencarian keyword "${clean}" (${res.totalAllowedMatches} hasil ditemukan)`;

      db.logAudit('Pencarian Global', aktivitas, `SEARCH-${clean.slice(0, 28)}`, pengguna, peran, [
        { kolom: 'keyword', nilaiLama: '-', nilaiBaru: clean },
        { kolom: 'hasil_diizinkan', nilaiLama: '0', nilaiBaru: String(res.totalAllowedMatches) },
        { kolom: 'hasil_dibatasi_role', nilaiLama: '0', nilaiBaru: String(res.restrictedMatchCount) }
      ]);

      void authFetch('/api/search/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: clean,
          allowedCount: res.totalAllowedMatches,
          restrictedCount: res.restrictedMatchCount,
          activeModule: currentTab
        })
      }).catch(() => {});

      if (res.hasRestrictedMatches) {
        onRestrictedNotification(PESAN_AKSES_PENCARIAN_DITOLAK);
      } else {
        onRestrictedNotification(null);
      }
    },
    [sesi, currentRole, currentTab, onRestrictedNotification]
  );

  // Catat riwayat pencarian otomatis setelah pengguna selesai mengetik (>= 2 karakter)
  useEffect(() => {
    const clean = query.trim();
    if (clean.length < 2) {
      return;
    }
    const timer = setTimeout(() => {
      commitSearchLog(searchResult);
    }, 650);
    return () => clearTimeout(timer);
  }, [query, searchResult, commitSearchLog]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = query.trim();
    if (!clean) return;
    setSearchActivated(true);
    setIsOpen(true);
    if (clean.length >= 2) {
      commitSearchLog(searchResult);
    }
  };

  const handleSelectResult = (item: GlobalSearchResultItem) => {
    if (query.trim().length >= 2) {
      commitSearchLog(searchResult);
    }
    setIsOpen(false);
    onNavigate({
      moduleId: item.moduleId,
      salesSubTab: item.salesSubTab,
      itSubTab: item.itSubTab,
      gudangTab: item.gudangTab
    });
  };

  const handleClear = () => {
    setQuery('');
    onRestrictedNotification(null);
    inputRef.current?.focus();
  };

  const cleanLen = query.trim().length;
  const showDropdown = isOpen && (cleanLen >= 1 || recentQueries.length > 0);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className="flex items-center">
        <div className="relative flex items-center w-full">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onFocus={() => {
              setSearchActivated(true);
              setIsOpen(true);
            }}
            onChange={(e) => {
              setSearchActivated(true);
              setQuery(e.target.value);
              setIsOpen(true);
              if (e.target.value.trim().length < 2) {
                onRestrictedNotification(null);
              }
            }}
            placeholder={placeholder}
            aria-label="Pencarian teks seluruh modul sesuai akses role"
            className="w-full pl-8 pr-16 py-1.5 rounded-xl border border-slate-200 bg-slate-50/90 hover:bg-white focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none transition-all"
          />
          <div className="absolute right-1.5 flex items-center gap-1">
            {query ? (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Hapus kata kunci pencarian"
                className="p-0.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="hidden xl:inline-flex items-center px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[10px] font-mono text-slate-400">
                Ctrl+K
              </kbd>
            )}
            <button
              type="submit"
              aria-label="Cari data"
              className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-semibold transition-colors cursor-pointer"
            >
              Cari
            </button>
          </div>
        </div>
      </form>

      {showDropdown && (
        <div
          role="region"
          aria-label="Hasil pencarian global"
          className="absolute right-0 top-full mt-1.5 w-[min(94vw,540px)] bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden"
        >
          {cleanLen < 2 ? (
            <div className="p-3.5 space-y-2.5">
              <p className="text-xs text-slate-500">
                Ketik minimal <strong className="text-slate-700">2 karakter</strong> untuk mencari data lintas modul sesuai hak akses role Anda.
              </p>
              {recentQueries.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <History className="w-3 h-3" />
                    Riwayat Pencarian Sesi Ini
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recentQueries.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => {
                          setQuery(q);
                          setIsOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 cursor-pointer transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-700 truncate">
                  Hasil untuk <span className="text-blue-700">“{searchResult.query}”</span>
                </span>
                <span className="text-[11px] font-medium text-slate-500 shrink-0">
                  {searchResult.totalAllowedMatches} data ditemukan
                </span>
              </div>

              {searchResult.hasRestrictedMatches && (
                <div
                  role="alert"
                  className="mx-3 mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-2.5"
                >
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <p className="text-xs font-semibold leading-relaxed">
                    {PESAN_AKSES_PENCARIAN_DITOLAK}
                  </p>
                </div>
              )}

              <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
                {searchResult.results.length > 0 ? (
                  searchResult.results.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectResult(item)}
                      className="w-full px-3.5 py-2.5 text-left hover:bg-blue-50/60 transition-colors flex items-start justify-between gap-3 cursor-pointer group"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                            {item.moduleLabel}
                          </span>
                          <span className="text-[11px] font-medium text-slate-400 truncate">
                            {item.collectionLabel}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-slate-900 truncate">
                          <HighlightedText text={item.title} query={searchResult.query} />
                        </div>
                        <div className="text-[11px] text-slate-600 line-clamp-2">
                          {item.subtitle && item.subtitle !== item.title ? (
                            <span className="font-medium text-slate-700 mr-1.5">{item.subtitle} ·</span>
                          ) : null}
                          <HighlightedText text={item.matchedText} query={searchResult.query} />
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 shrink-0 mt-1 transition-colors" />
                    </button>
                  ))
                ) : !searchResult.hasRestrictedMatches ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    Tidak ada data yang cocok dengan kata kunci <strong className="text-slate-700">“{searchResult.query}”</strong> pada modul yang Anda miliki aksesnya.
                  </div>
                ) : null}
              </div>
            </>
          )}

          <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>Scope dibatasi akses role • Seluruh riwayat pencarian tersimpan otomatis dalam log</span>
          </div>
        </div>
      )}
    </div>
  );
}
