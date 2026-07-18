import { Building2, PencilRuler, X } from 'lucide-react';
import {
  BUILDING_ASSETS,
  type BuildingAssetDefinition,
} from '../lib/building-assets';
import { publicAssetUrl } from '../lib/public-assets';

interface Props {
  onDrawCustom: () => void;
  onPlaceAsset: (asset: BuildingAssetDefinition) => void;
  onCancel: () => void;
}

export default function BuildingStartPanel({ onDrawCustom, onPlaceAsset, onCancel }: Props) {
  return (
    <div className="building-start-backdrop" role="presentation">
      <section className="building-start-panel" aria-labelledby="building-start-title">
        <header className="building-start-header">
          <div>
            <h2 id="building-start-title">Add a building</h2>
            <p>Choose a ready-made detailed building, or draw one that fits this site.</p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close building choices">
            <X aria-hidden="true" />
          </button>
        </header>

        <button type="button" className="building-start-custom" onClick={onDrawCustom}>
          <span className="building-start-icon"><PencilRuler aria-hidden="true" /></span>
          <span>
            <strong>Draw a custom building</strong>
            <small>Tap its corners on the map, then choose height, roof, windows, and internal parts.</small>
          </span>
          <span className="building-start-action">Draw outline</span>
        </button>

        <div className="building-start-section-title">
          <span>Ready-made LoD3 buildings</span>
          <small>Tap an asset, then tap the map to place it.</small>
        </div>
        <div className="building-asset-grid">
          {BUILDING_ASSETS.map((asset) => (
            <button
              key={asset.id}
              type="button"
              className="building-asset-card"
              onClick={() => onPlaceAsset(asset)}
            >
              <span className="building-asset-image">
                <img src={publicAssetUrl(asset.texturePath)} alt="" />
                <span><Building2 aria-hidden="true" /> LoD3</span>
              </span>
              <span className="building-asset-copy">
                <strong>{asset.name}</strong>
                <small>{asset.description}</small>
                <em>{asset.size} · official texture</em>
              </span>
              <span className="building-start-action">Place</span>
            </button>
          ))}
        </div>
        <p className="building-asset-credit">
          Source: Freie und Hansestadt Hamburg, LGV · Datenlizenz Deutschland – Namensnennung 2.0
        </p>
      </section>
    </div>
  );
}
