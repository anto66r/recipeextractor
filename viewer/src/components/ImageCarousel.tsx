import { useState, useRef } from 'react';
import type { RecipeImage } from '../types';
import styles from './ImageCarousel.module.css';

// ── Pending item types (during edit) ─────────────────────────────────────────

type ExistingItem = {
  id: string;
  kind: 'existing';
  filename: string;
  previewSrc: string;
  width: number;
  height: number;
  alt: string;
};

type UrlItem = {
  id: string;
  kind: 'url';
  url: string;
};

type PastedItem = {
  id: string;
  kind: 'pasted';
  dataUrl: string;
};

type PendingItem = ExistingItem | UrlItem | PastedItem;

function uid() {
  return Math.random().toString(36).slice(2);
}

function itemPreviewSrc(item: PendingItem): string {
  if (item.kind === 'existing') return item.previewSrc;
  if (item.kind === 'pasted') return item.dataUrl;
  return item.url;
}

function itemLabel(item: PendingItem): string {
  if (item.kind === 'existing') return item.filename;
  if (item.kind === 'pasted') return 'Pasted image';
  return item.url;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  recipeId: string;
  images: RecipeImage[];
  onImagesChange: (images: RecipeImage[]) => void;
}

export default function ImageCarousel({ recipeId, images, onImagesChange }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<PendingItem[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const total = images.length;
  const idx = total > 0 ? Math.min(activeIndex, total - 1) : 0;

  // ── Edit mode helpers ───────────────────────────────────────────────────────

  function enterEdit() {
    setItems(
      images.map((img, i): ExistingItem => ({
        id: uid(),
        kind: 'existing',
        filename: img.filename,
        previewSrc: `/api/image?id=${encodeURIComponent(recipeId)}&n=${i + 1}`,
        width: img.width,
        height: img.height,
        alt: img.alt,
      })),
    );
    setNewUrl('');
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setError(null);
  }

  function move(i: number, dir: -1 | 1) {
    setItems((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, j) => j !== i));
  }

  function commitUrl() {
    const url = newUrl.trim();
    if (!url) return;
    setItems((prev) => [...prev, { id: uid(), kind: 'url', url }]);
    setNewUrl('');
    urlInputRef.current?.focus();
  }

  function handleUrlKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitUrl();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    for (const clipItem of Array.from(e.clipboardData.items)) {
      if (clipItem.type.startsWith('image/')) {
        e.preventDefault();
        const file = clipItem.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          if (dataUrl) {
            setItems((prev) => [...prev, { id: uid(), kind: 'pasted', dataUrl }]);
          }
        };
        reader.readAsDataURL(file);
        return;
      }
    }
    // text paste — falls through to update the input value normally
  }

  async function handleSave() {
    if (items.length === 0) {
      setError('Add at least one image.');
      return;
    }

    setSaving(true);
    setError(null);

    const imageSpecs = items.map((item) => {
      if (item.kind === 'existing') return { type: 'existing', filename: item.filename };
      if (item.kind === 'url') return { type: 'url', url: item.url };
      // pasted: strip the "data:<mime>;base64," prefix
      const [, data] = item.dataUrl.split(',');
      return { type: 'base64', data };
    });

    try {
      const res = await fetch('/api/set-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: recipeId, images: imageSpecs }),
      });

      const json = (await res.json()) as { images?: RecipeImage[]; error?: string };

      if (!res.ok) {
        setError(json.error ?? `Server error (${res.status})`);
        return;
      }

      if (json.images) {
        onImagesChange(json.images);
      }
      setEditing(false);
      setActiveIndex(0);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  }

  // ── View mode ───────────────────────────────────────────────────────────────

  if (!editing) {
    return (
      <section className={styles.section}>
        <div className={styles.header}>
          <span className={styles.label}>Photos</span>
          <button type="button" className={styles.editBtn} onClick={enterEdit}>
            {total > 0 ? 'Edit' : '+ Add'}
          </button>
        </div>

        {total === 0 ? (
          <p className={styles.empty}>No photos yet.</p>
        ) : (
          <>
            <div className={styles.track}>
              {total > 1 && (
                <button
                  type="button"
                  className={`${styles.arrow} ${styles.arrowLeft}`}
                  onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
                  disabled={idx === 0}
                  aria-label="Previous photo"
                >
                  ‹
                </button>
              )}

              <img
                key={idx}
                src={`/api/image?id=${encodeURIComponent(recipeId)}&n=${idx + 1}`}
                alt={images[idx].alt}
                className={styles.photo}
                width={images[idx].width}
                height={images[idx].height}
              />

              {total > 1 && (
                <button
                  type="button"
                  className={`${styles.arrow} ${styles.arrowRight}`}
                  onClick={() => setActiveIndex((i) => Math.min(total - 1, i + 1))}
                  disabled={idx === total - 1}
                  aria-label="Next photo"
                >
                  ›
                </button>
              )}
            </div>

            {total > 1 && (
              <div className={styles.dots} role="tablist">
                {images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    role="tab"
                    aria-selected={i === idx}
                    className={`${styles.dot}${i === idx ? ' ' + styles.dotActive : ''}`}
                    onClick={() => setActiveIndex(i)}
                    aria-label={`Photo ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </section>
    );
  }

  // ── Edit mode ───────────────────────────────────────────────────────────────

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <span className={styles.label}>Photos</span>
        <span className={styles.editHint}>Drag to reorder · paste or enter a URL to add</span>
      </div>

      {items.length === 0 ? (
        <p className={styles.empty}>No photos yet — add one below.</p>
      ) : (
        <ul className={styles.itemList}>
          {items.map((item, i) => (
            <li key={item.id} className={styles.item}>
              {/* thumbnail */}
              <img
                src={itemPreviewSrc(item)}
                alt=""
                className={styles.thumb}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                }}
              />

              {/* label */}
              <span className={styles.itemLabel} title={itemLabel(item)}>
                {itemLabel(item)}
              </span>

              {/* controls */}
              <span className={styles.itemControls}>
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label="Move up"
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                  aria-label="Move down"
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  aria-label="Remove"
                  title="Remove"
                  className={styles.removeBtn}
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Add image */}
      <div className={styles.addRow}>
        <input
          ref={urlInputRef}
          type="text"
          className={styles.urlInput}
          placeholder="Paste image or type URL, then press Enter…"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          onKeyDown={handleUrlKeyDown}
          onPaste={handlePaste}
          disabled={saving}
        />
        <button
          type="button"
          className={styles.addUrlBtn}
          onClick={commitUrl}
          disabled={!newUrl.trim() || saving}
        >
          Add
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.saveBtn}
          onClick={() => void handleSave()}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          className={styles.cancelBtn}
          onClick={cancelEdit}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
