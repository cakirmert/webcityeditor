import { useCallback, useEffect, useRef, useState } from 'react';
import type { CityJsonDocument } from '../types';
import { deleteDocument, listDocuments, loadDocument } from '../lib/storage';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface Props {
  onLoaded: (doc: CityJsonDocument, fileName: string) => void;
}

type Status = { kind: 'idle' } | { kind: 'info' | 'ok' | 'err'; msg: string };

const DEFAULT_3DBAG =
  'https://3d.bk.tudelft.nl/opendata/cityjson/3dcities/v2.0/9-284-556.city.json';

interface QuickSample {
  label: string;
  description: string;
  url: string;
  guideOnly?: boolean;
}

const QUICK_SAMPLES: QuickSample[] = [
  {
    label: '3DBAG — Delft tile',
    description: 'CityJSON 2.0, ~1 MB, hundreds of LoD2 buildings',
    url: 'https://3d.bk.tudelft.nl/opendata/cityjson/3dcities/v2.0/9-284-556.city.json',
  },
  {
    label: 'Hamburg — local pipeline required',
    description:
      'Hamburg publishes only CityGML. Follow prototype/HAMBURG_PIPELINE.md to convert to CityJSON.',
    url: 'https://suche.transparenz.hamburg.de/dataset/3d-stadtmodell-lod2-de-hamburg2',
    guideOnly: true,
  },
  {
    label: 'twocube — minimal solid',
    description: 'Two adjacent unit cubes, for round-trip testing',
    url: 'https://3d.bk.tudelft.nl/opendata/cityjson/simplegeom/v2.0/twocube.city.json',
  },
];

export default function FileLoader({ onLoaded }: Props) {
  const [url, setUrl] = useState(DEFAULT_3DBAG);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [dragActive, setDragActive] = useState(false);
  const [recent, setRecent] = useState<{ name: string; savedAt: number }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listDocuments()
      .then(setRecent)
      .catch((e) => console.warn('Could not list local saves:', e));
  }, []);

  const parseAndEmit = useCallback(
    (text: string, name: string) => {
      try {
        const data = JSON.parse(text);
        if (data.type !== 'CityJSON') {
          throw new Error('File is not a CityJSON document (missing type:"CityJSON")');
        }
        if (!data.CityObjects || !data.vertices) {
          throw new Error('Missing required CityJSON fields (CityObjects/vertices)');
        }
        setStatus({
          kind: 'ok',
          msg: `Loaded v${data.version}, ${
            Object.keys(data.CityObjects).length
          } objects, ${data.vertices.length.toLocaleString()} vertices`,
        });
        onLoaded(data as CityJsonDocument, name);
      } catch (e) {
        setStatus({
          kind: 'err',
          msg: `Parse error: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    },
    [onLoaded]
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
        onLoaded(stored.doc, stored.name);
      } catch (e) {
        setStatus({
          kind: 'err',
          msg: `Local load failed: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    },
    [onLoaded]
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
    <div className="absolute inset-0 z-[5] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-[460px] max-w-[92%] rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
        <h2 className="mb-1 text-[15px] font-semibold">Load CityJSON</h2>
        <p className="mb-4 text-xs text-[var(--text-dim)]">
          Drop a <code className="rounded bg-[var(--bg)] px-1">.city.json</code> file, paste a
          URL, or pick a quick sample. CityJSON 2.0 is the primary format.
        </p>

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
            accept=".json,.city.json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>

        <div className="mb-2 flex gap-2">
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://... .city.json"
            className="flex-1"
          />
          <Button onClick={handleUrl}>Fetch URL</Button>
        </div>
        <div className="flex justify-end">
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

        <Section label="Quick samples (remote)">
          {QUICK_SAMPLES.map((s) => (
            <button
              key={s.url}
              onClick={() => {
                if (s.guideOnly) {
                  setStatus({
                    kind: 'info',
                    msg: `${s.description} — download portal opens in a new tab.`,
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
                {s.guideOnly && (
                  <span className="rounded bg-[var(--warn)] px-1.5 py-0 text-[9px] font-semibold text-black">
                    GUIDE
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
