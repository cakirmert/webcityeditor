import { useCallback, useEffect, useRef, useState } from 'react';
import type { CityJsonDocument } from '../types';
import { deleteDocument, listDocuments, loadDocument } from '../lib/storage';

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
  /** If true, clicking shows a help message instead of fetching (no direct URL available). */
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

  // Fetch the list of locally-saved documents once on mount
  useEffect(() => {
    listDocuments()
      .then(setRecent)
      .catch((e) => console.warn('Could not list local saves:', e));
  }, []);

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
      transform: { scale: [0.001, 0.001, 0.001], translate: [0, 0, 0] },
      metadata: { referenceSystem: 'https://www.opengis.net/def/crs/EPSG/0/4978' },
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
    <div className="loader-overlay">
      <div className="loader-card">
        <h2>Load CityJSON</h2>
        <p>
          Drop a <code>.city.json</code> file, paste a URL, or try the built-in sample cube.
          Works with CityJSON 2.0 files from 3DBAG, Berlin Senat, or any compliant source.
        </p>

        <div
          className={`drop-zone ${dragActive ? 'active' : ''}`}
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
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>

        <div className="loader-actions">
          <div className="row">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://... .city.json"
            />
            <button onClick={handleUrl}>Fetch URL</button>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button onClick={handleSample}>Use built-in sample cube</button>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div
            style={{
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              color: 'var(--text-dim)',
              marginBottom: 6,
            }}
          >
            Quick samples (remote)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
                        msg: `Fetch failed: ${
                          e instanceof Error ? e.message : String(e)
                        }`,
                      });
                    }
                  })();
                }}
                style={{
                  textAlign: 'left',
                  padding: '6px 8px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                  fontSize: 11,
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  {s.label}
                  {s.guideOnly && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 9,
                        padding: '1px 5px',
                        borderRadius: 2,
                        background: 'var(--warn)',
                        color: '#000',
                      }}
                    >
                      GUIDE
                    </span>
                  )}
                </div>
                <div style={{ color: 'var(--text-faint)', fontSize: 10 }}>
                  {s.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {status.kind !== 'idle' && (
          <div className={`status-message ${status.kind}`}>{status.msg}</div>
        )}

        {recent.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div
              style={{
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                color: 'var(--text-dim)',
                marginBottom: 6,
              }}
            >
              Local saves (browser IndexedDB)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {recent.slice(0, 6).map((r) => (
                <div
                  key={r.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 8px',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 3,
                    fontSize: 11,
                  }}
                >
                  <button
                    onClick={() => handleLoadLocal(r.name)}
                    style={{ flex: 1, textAlign: 'left' }}
                  >
                    {r.name}{' '}
                    <span style={{ color: 'var(--text-faint)', marginLeft: 4 }}>
                      {formatRelative(r.savedAt)}
                    </span>
                  </button>
                  <button
                    onClick={() => handleDeleteLocal(r.name)}
                    title="Delete local save"
                    style={{ padding: '2px 6px' }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
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
