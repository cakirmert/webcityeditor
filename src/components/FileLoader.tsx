import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CityJsonDocument } from '../types';
import { deleteDocument, listDocuments, loadDocument } from '../lib/storage';
import { parseCityJsonAuto } from '../lib/cityjson';
import {
  DEFAULT_HAMBURG_CATALOG_URL,
  DEFAULT_HAMBURG_VIEWPORT_BBOX,
  fetchCityJsonSeqViewport,
  parseCityJsonSeqStrict,
  type CityJsonSeqViewportLoad,
} from '../lib/cityjsonseq-catalog';
import { publicAssetUrl } from '../lib/public-assets';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface Props {
  /**
   * Called when a file has parsed successfully. `rawText` is included only
   * for CityJSONSeq inputs (where viewport-filtered re-parsing is useful);
   * monolithic files don't need it because they hold the whole city in
   * memory anyway. `null` for `rawText` means "don't keep me around."
  */
  onLoaded: (doc: CityJsonDocument, fileName: string, rawText: string | null) => void;
  /** Connect a CityJSONSeq tile catalog. Buildings stream from the current camera view. */
  onCatalogLoaded?: (
    loaded: CityJsonSeqViewportLoad,
    catalogUrl: string,
    options?: { loadMode?: 'viewport' | 'all' }
  ) => void;
  /** Enabled when the loader is opened over an already-loaded map. */
  canClose?: boolean;
  onClose?: () => void;
  banner?: { kind: 'info' | 'err'; message: string };
}

type Status = { kind: 'idle' } | { kind: 'info' | 'ok' | 'err'; msg: string };

const DEFAULT_HAMBURG_SAMPLE =
  'data/hamburg/hamburg-city-center-buildings.city.jsonl';

interface QuickSample {
  label: string;
  description: string;
  url: string;
  guideOnly?: boolean;
  badge?: string;
}

const QUICK_SAMPLES: QuickSample[] = [
  {
    label: '3DBAG - Delft tile',
    description: 'CityJSON 2.0, ~1 MB, hundreds of LoD2 buildings',
    url: 'https://3d.bk.tudelft.nl/opendata/cityjson/3dcities/v2.0/9-284-556.city.json',
  },
  {
    label: 'Hamburg - official LoD2 citywide portal',
    description:
      'Hamburg publishes the full LoD2 city model as CityGML. Use this for source/reference downloads.',
    url: 'https://suche.transparenz.hamburg.de/dataset/3d-gebaeudemodell-lod2-de-hamburg2',
    guideOnly: true,
    badge: 'GUIDE',
  },
  {
    label: 'Hamburg - official LoD3.0 source',
    description:
      'Detailed roof geometry and facade textures are available as large tiled CityGML archives. Convert a selected tile to CityJSON before loading it.',
    url: 'https://suche.transparenz.hamburg.de/dataset/3d-gebaeudemodell-lod3-0-hh-hamburg17',
    guideOnly: true,
    badge: 'GUIDE',
  },
  {
    label: 'twocube - minimal solid',
    description: 'Two adjacent unit cubes, for round-trip testing',
    url: 'https://3d.bk.tudelft.nl/opendata/cityjson/simplegeom/v2.0/twocube.city.json',
  },
];

interface HostedDataManifest {
  cityjsonSamples?: HostedCityJsonSample[];
}

interface HostedCityJsonSample {
  label: string;
  description: string;
  url: string;
  enabled?: boolean;
  checkAvailability?: boolean;
}

export default function FileLoader({
  onLoaded,
  onCatalogLoaded,
  canClose = false,
  onClose,
  banner,
}: Props) {
  const [url, setUrl] = useState(() => publicAssetUrl(DEFAULT_HAMBURG_SAMPLE));
  const [catalogUrl, setCatalogUrl] = useState(DEFAULT_HAMBURG_CATALOG_URL);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [dragActive, setDragActive] = useState(false);
  const [recent, setRecent] = useState<{ name: string; savedAt: number }[]>([]);
  const [hostedSamples, setHostedSamples] = useState<QuickSample[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listDocuments()
      .then(setRecent)
      .catch((e) => console.warn('Could not list local saves:', e));
  }, []);

  useEffect(() => {
    if (import.meta.env.MODE === 'test') return;
    let cancelled = false;

    async function loadHostedSamples() {
      try {
        const resp = await fetch(publicAssetUrl('data/manifest.json'), { cache: 'no-cache' });
        if (!resp.ok) return;
        const manifest = (await resp.json()) as HostedDataManifest;
        const available: QuickSample[] = [];

        for (const sample of manifest.cityjsonSamples ?? []) {
          if (sample.enabled === false) continue;
          const resolvedUrl = publicAssetUrl(sample.url);
          if (sample.checkAvailability) {
            const head = await fetch(resolvedUrl, { method: 'HEAD', cache: 'no-cache' });
            const contentType = head.headers.get('content-type') ?? '';
            if (!head.ok || contentType.toLowerCase().includes('text/html')) continue;
          }
          available.push({
            label: sample.label,
            description: sample.description,
            url: resolvedUrl,
            badge: 'HOSTED',
          });
        }

        if (!cancelled) setHostedSamples(available);
      } catch (e) {
        console.warn('Could not load hosted sample manifest:', e);
      }
    }

    void loadHostedSamples();
    return () => {
      cancelled = true;
    };
  }, []);

  const quickSamples = useMemo(
    () => [...hostedSamples, QUICK_SAMPLES[0], ...QUICK_SAMPLES.slice(1)],
    [hostedSamples]
  );
  const primaryHostedSample = hostedSamples[0] ?? null;

  const parseAndEmit = useCallback(
    (text: string, name: string) => {
      // parseCityJsonAuto handles both monolithic CityJSON and CityJSONSeq
      // (one JSON per line: header + CityJSONFeature per feature). It also
      // merges vertex indices correctly across features.
      const isSeq = /\.(city\.)?jsonl(?:$|[?#])/i.test(name);
      let result: ReturnType<typeof parseCityJsonAuto>;
      try {
        result = isSeq
          ? { ok: true as const, doc: parseCityJsonSeqStrict(text, name) }
          : parseCityJsonAuto(text);
      } catch (error) {
        setStatus({
          kind: 'err',
          msg: `Parse error: ${error instanceof Error ? error.message : String(error)}`,
        });
        return;
      }
      if (!result.ok) {
        setStatus({ kind: 'err', msg: `Parse error: ${result.error}` });
        return;
      }
      const data = result.doc;
      setStatus({
        kind: 'ok',
        msg: `Loaded v${data.version}${isSeq ? ' (CityJSONSeq)' : ''}, ${
          Object.keys(data.CityObjects).length
        } objects, ${data.vertices.length.toLocaleString()} vertices`,
      });
      // Hold on to the raw text only for CityJSONSeq — it's used by the
      // toolbar's "Filter to viewport" action to re-parse with a bbox.
      onLoaded(data, name, isSeq ? text : null);
      onClose?.();
    },
    [onLoaded, onClose]
  );

  const handleFile = useCallback(
    async (file: File) => {
      setStatus({ kind: 'info', msg: `Reading ${file.name}…` });
      try {
        const text = await file.text();
        parseAndEmit(text, file.name);
      } catch (e) {
        setStatus({
          kind: 'err',
          msg: `Read error: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    },
    [parseAndEmit]
  );

  const handleUrl = useCallback(async () => {
    if (!url.trim()) return;
    setStatus({ kind: 'info', msg: `Fetching ${url}…` });
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
      const text = await resp.text();
      const name = url.split('/').pop() ?? 'remote.city.json';
      parseAndEmit(text, name);
    } catch (e) {
      setStatus({
        kind: 'err',
        msg: `Fetch failed: ${e instanceof Error ? e.message : String(e)}. CORS may be blocking — try downloading manually.`,
      });
    }
  }, [url, parseAndEmit]);

  const handleCatalogUrl = useCallback(async () => {
    if (!catalogUrl.trim() || !onCatalogLoaded) return;
    setStatus({ kind: 'info', msg: `Connecting to CityJSONSeq catalog ${catalogUrl}…` });
    try {
      const loaded = await fetchCityJsonSeqViewport(
        catalogUrl,
        DEFAULT_HAMBURG_VIEWPORT_BBOX
      );
      if (!loaded.doc || loaded.tileIds.length === 0) {
        throw new Error('The Hamburg catalog returned no CityJSONSeq tiles for the initial view');
      }
      onCatalogLoaded(loaded, catalogUrl, { loadMode: 'viewport' });
      onClose?.();
      setStatus({
        kind: 'ok',
        msg:
          `Connected CityJSONSeq catalog: ${loaded.tileIds.length} initial tiles, ` +
          `${loaded.features.toLocaleString()} editable features. Move the map to stream more buildings.`,
      });
    } catch (e) {
      setStatus({
        kind: 'err',
        msg: `Catalog connection failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }, [catalogUrl, onCatalogLoaded, onClose]);

  const handleQuickSample = useCallback(
    (sample: QuickSample) => {
      if (sample.guideOnly) {
        setStatus({
          kind: 'info',
          msg: `${sample.description} - download portal opens in a new tab.`,
        });
        window.open(sample.url, '_blank', 'noopener,noreferrer');
        return;
      }

      setUrl(sample.url);
      void (async () => {
        setStatus({ kind: 'info', msg: `Fetching ${sample.label}...` });
        try {
          const resp = await fetch(sample.url);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const text = await resp.text();
          const name = sample.url.split('/').pop() ?? sample.label;
          parseAndEmit(text, name);
        } catch (e) {
          setStatus({
            kind: 'err',
            msg: `Fetch failed: ${e instanceof Error ? e.message : String(e)}`,
          });
        }
      })();
    },
    [parseAndEmit]
  );

  const handleSample = useCallback(() => {
    const sample: CityJsonDocument = {
      type: 'CityJSON',
      version: '2.0',
      transform: { scale: [0.001, 0.001, 0.001], translate: [85000, 447000, 0] },
      metadata: { referenceSystem: 'https://www.opengis.net/def/crs/EPSG/0/28992' },
      CityObjects: {
        Building_A: {
          type: 'Building',
          attributes: {
            measuredHeight: 10.0,
            yearOfConstruction: 1965,
            storeysAboveGround: 3,
            function: 'residential',
          },
          geometry: [
            {
              type: 'Solid',
              lod: '2.2',
              boundaries: [
                [
                  [[0, 3, 2, 1]],
                  [[4, 5, 6, 7]],
                  [[0, 1, 5, 4]],
                  [[1, 2, 6, 5]],
                  [[2, 3, 7, 6]],
                  [[3, 0, 4, 7]],
                ],
              ],
              semantics: {
                surfaces: [
                  { type: 'GroundSurface' },
                  { type: 'RoofSurface' },
                  { type: 'WallSurface' },
                ],
                values: [[0, 1, 2, 2, 2, 2]],
              },
            },
          ],
        },
      },
      vertices: [
        [0, 0, 0],
        [10000, 0, 0],
        [10000, 8000, 0],
        [0, 8000, 0],
        [0, 0, 10000],
        [10000, 0, 10000],
        [10000, 8000, 10000],
        [0, 8000, 10000],
      ],
    };
    parseAndEmit(JSON.stringify(sample), 'sample-cube.city.json');
  }, [parseAndEmit]);

  const handleLoadLocal = useCallback(
    async (name: string) => {
      setStatus({ kind: 'info', msg: `Loading local save "${name}"…` });
      try {
        const stored = await loadDocument(name);
        if (!stored) throw new Error('Not found');
        onLoaded(stored.doc, stored.name, null);
        onClose?.();
      } catch (e) {
        setStatus({
          kind: 'err',
          msg: `Local load failed: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    },
    [onLoaded, onClose]
  );

  const handleDeleteLocal = useCallback(async (name: string) => {
    try {
      await deleteDocument(name);
      setRecent((prev) => prev.filter((r) => r.name !== name));
    } catch (e) {
      console.warn('Delete failed:', e);
    }
  }, []);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };
  const onDragLeave = () => setDragActive(false);
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await handleFile(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-md">
      <div className="max-h-[calc(100vh-2rem)] w-[560px] max-w-[96vw] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="mb-1 text-[15px] font-semibold">Load data</h2>
            <p className="text-xs text-[var(--text-dim)]">
              Use the hosted Hamburg demo for presentation, connect the local Hamburg
              catalog for larger data, or drop a CityJSON file.
            </p>
          </div>
          {canClose && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              aria-label="Close loader"
              title="Close data loader"
            >
              Close
            </Button>
          )}
        </div>

        {banner && (
          <div
            className={`mb-3 rounded-md px-3 py-2 text-xs ${
              banner.kind === 'err'
                ? 'border border-[var(--error)] bg-[var(--error)]/10 text-[var(--error)]'
                : 'border border-[var(--border)] bg-[var(--bg)] text-[var(--text-dim)]'
            }`}
          >
            {banner.message}
          </div>
        )}

        <div
          className={`mb-3 cursor-pointer rounded-md border-2 border-dashed p-4 text-center text-xs transition-colors ${
            dragActive
              ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text)]'
              : 'border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--text)]'
          }`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          Drop a file here or click to browse
          <input
            ref={inputRef}
            type="file"
            accept=".json,.city.json,.jsonl,.city.jsonl,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>

        {onCatalogLoaded && (
          <div className="mb-3 rounded-md border border-[var(--border)] bg-[var(--bg)] p-2.5">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
              Hamburg larger dataset
            </div>
            <div className="mb-2 text-[10px] text-[var(--text-faint)]">
              For more than the hosted city-center demo, use the local strict
              CityJSONSeq catalog. <code className="rounded bg-[var(--surface)] px-1">npm run dev</code>{' '}
              starts it automatically; to run only the catalog use{' '}
              <code className="rounded bg-[var(--surface)] px-1">
                npm run data:hamburg-lod2:serve
              </code>
              . The app loads the initial Hamburg view first, then streams
              building tiles as the camera moves.
            </div>
            <div className="flex gap-2">
              <Input
                type="url"
                value={catalogUrl}
                onChange={(e) => setCatalogUrl(e.target.value)}
                placeholder="http://127.0.0.1:8787"
                className="flex-1"
              />
              <Button onClick={handleCatalogUrl} variant="primary">
                Connect catalog
              </Button>
            </div>
            <div className="mt-1 text-[10px] text-[var(--text-faint)]">
              This is the path for the prepared city-scale Hamburg data; the hosted
              button below is intentionally small for browser-safe demos.
            </div>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          {primaryHostedSample ? (
            <Button onClick={() => handleQuickSample(primaryHostedSample)}>
              Load Hamburg demo
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={handleSample} variant="outline">
            Use built-in sample cube
          </Button>
        </div>

        {status.kind !== 'idle' && (
          <div
            className={`mt-3 rounded-md px-3 py-2 text-xs ${
              status.kind === 'ok'
                ? 'border border-[var(--success)] bg-[var(--success)]/10 text-[var(--success)]'
                : status.kind === 'err'
                ? 'border border-[var(--error)] bg-[var(--error)]/10 text-[var(--error)]'
                : 'border border-[var(--border)] bg-[var(--bg)] text-[var(--text-dim)]'
            }`}
          >
            {status.msg}
          </div>
        )}

        <details className="mt-4 rounded-md border border-[var(--border)] bg-[var(--bg)] p-3">
          <summary className="cursor-pointer list-none text-[11px] font-semibold text-[var(--text)] [&::-webkit-details-marker]:hidden">
            Advanced loading options
          </summary>
          <div className="mt-3">
            <div className="flex gap-2">
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://... .city.jsonl or .city.json"
                className="flex-1"
              />
              <Button onClick={handleUrl}>Fetch URL</Button>
            </div>
        <Section label="Quick samples">
          {quickSamples.map((s) => (
            <button
              key={s.url}
              onClick={() => {
                if (s.guideOnly) {
                  setStatus({
                    kind: 'info',
                    msg: `${s.description} - download portal opens in a new tab.`,
                  });
                  window.open(s.url, '_blank', 'noopener,noreferrer');
                  return;
                }
                setUrl(s.url);
                void (async () => {
                  setStatus({ kind: 'info', msg: `Fetching ${s.label}…` });
                  try {
                    const resp = await fetch(s.url);
                    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                    const text = await resp.text();
                    const name = s.url.split('/').pop() ?? s.label;
                    parseAndEmit(text, name);
                  } catch (e) {
                    setStatus({
                      kind: 'err',
                      msg: `Fetch failed: ${e instanceof Error ? e.message : String(e)}`,
                    });
                  }
                })();
              }}
              className="flex w-full flex-col items-start gap-0.5 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-left text-[11px] hover:border-[var(--accent)]"
            >
              <div className="flex items-center gap-2 font-semibold text-[var(--text)]">
                {s.label}
                {(s.guideOnly || s.badge) && (
                  <span className="rounded bg-[var(--warn)] px-1.5 py-0 text-[9px] font-semibold text-black">
                    {s.badge ?? 'GUIDE'}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-[var(--text-faint)]">{s.description}</div>
            </button>
          ))}
        </Section>

        {recent.length > 0 && (
          <Section label="Local saves (IndexedDB)">
            {recent.slice(0, 6).map((r) => (
              <div
                key={r.name}
                className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-[11px]"
              >
                <button
                  onClick={() => handleLoadLocal(r.name)}
                  className="flex-1 truncate text-left hover:text-[var(--accent)]"
                >
                  {r.name}{' '}
                  <span className="ml-1 text-[var(--text-faint)]">
                    {formatRelative(r.savedAt)}
                  </span>
                </button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteLocal(r.name)}
                  title="Delete local save"
                >
                  ×
                </Button>
              </div>
            ))}
          </Section>
        )}
          </div>
        </details>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
        {label}
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
