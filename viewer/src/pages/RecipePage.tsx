import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Recipe, RecipeImage } from '../types';
import RecipeImageComponent from '../components/RecipeImage';
import styles from './RecipePage.module.css';

type Status = 'loading' | 'error' | 'notfound' | 'ready';

interface ImageFormState {
  open: boolean;
  urls: string[];
  submitting: boolean;
  error: string | null;
}

const EMPTY_FORM: ImageFormState = {
  open: false,
  urls: [''],
  submitting: false,
  error: null,
};

export default function RecipePage() {
  const { id } = useParams<{ id: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [imageForm, setImageForm] = useState<ImageFormState>(EMPTY_FORM);
  const firstUrlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/recipe?id=${encodeURIComponent(id ?? '')}`, { signal: controller.signal })
      .then((r) => {
        if (r.status === 404) {
          setStatus('notfound');
          return null;
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Recipe>;
      })
      .then((data) => {
        if (data) {
          setRecipe(data);
          setStatus('ready');
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setStatus('error');
      });

    return () => controller.abort();
  }, [id]);

  // Focus the first URL input when the form opens
  useEffect(() => {
    if (imageForm.open) {
      firstUrlRef.current?.focus();
    }
  }, [imageForm.open]);

  function openImageForm() {
    setImageForm({ open: true, urls: [''], submitting: false, error: null });
  }

  function closeImageForm() {
    setImageForm(EMPTY_FORM);
  }

  function setUrl(index: number, value: string) {
    setImageForm((prev) => {
      const urls = [...prev.urls];
      urls[index] = value;
      return { ...prev, urls, error: null };
    });
  }

  function addUrl() {
    setImageForm((prev) => ({ ...prev, urls: [...prev.urls, ''], error: null }));
  }

  function removeUrl(index: number) {
    setImageForm((prev) => {
      const urls = prev.urls.filter((_, i) => i !== index);
      return { ...prev, urls: urls.length > 0 ? urls : [''], error: null };
    });
  }

  async function submitImages(e: React.FormEvent) {
    e.preventDefault();
    const urls = imageForm.urls.map((u) => u.trim()).filter(Boolean);
    if (urls.length === 0) {
      setImageForm((prev) => ({ ...prev, error: 'Enter at least one image URL.' }));
      return;
    }

    setImageForm((prev) => ({ ...prev, submitting: true, error: null }));

    try {
      const res = await fetch('/api/set-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, urls }),
      });

      const data = (await res.json()) as { images?: RecipeImage[]; error?: string };

      if (!res.ok) {
        setImageForm((prev) => ({
          ...prev,
          submitting: false,
          error: data.error ?? `Server error (${res.status})`,
        }));
        return;
      }

      if (data.images) {
        setRecipe((prev) => (prev ? { ...prev, images: data.images! } : prev));
      }
      setImageForm(EMPTY_FORM);
    } catch {
      setImageForm((prev) => ({
        ...prev,
        submitting: false,
        error: 'Network error — please try again.',
      }));
    }
  }

  return (
    <div className={styles.page}>
      <Link to="/" className={styles.back}>
        ← Back to recipes
      </Link>

      {status === 'loading' && <p>Loading…</p>}
      {status === 'error' && <p>Could not load recipe.</p>}
      {status === 'notfound' && <p>Recipe not found.</p>}

      {status === 'ready' && recipe && (
        <>
          {recipe.images.length > 0 && (
            <RecipeImageComponent
              recipeId={recipe.id}
              images={recipe.images}
              index={0}
              className={styles.heroImage}
              loading="eager"
            />
          )}

          <h1 className={styles.title}>{recipe.title}</h1>
          <p className={styles.description}>{recipe.description}</p>

          <div className={styles.meta}>
            <span>Prep: {recipe.prepTime}</span>
            <span>•</span>
            <span>Cook: {recipe.cookTime}</span>
            <span>•</span>
            <span>Serves: {recipe.servings}</span>
          </div>

          <div className={styles.tags}>
            {recipe.tags.map((tag) => (
              <span key={tag} className={styles.tag}>
                {tag}
              </span>
            ))}
          </div>

          {/* ── Image editor ───────────────────────────────────────────────── */}
          {!imageForm.open ? (
            <button
              type="button"
              className={styles.editImagesBtn}
              onClick={openImageForm}
            >
              {recipe.images.length > 0 ? 'Replace images' : '+ Add images'}
            </button>
          ) : (
            <form className={styles.imageForm} onSubmit={(e) => void submitImages(e)}>
              <h3 className={styles.imageFormTitle}>Set image URLs</h3>
              <p className={styles.imageFormHint}>
                The first URL becomes the hero image. All existing images will be replaced.
              </p>

              {imageForm.urls.map((url, i) => (
                <div key={i} className={styles.imageFormRow}>
                  <input
                    ref={i === 0 ? firstUrlRef : undefined}
                    type="url"
                    className={styles.imageFormInput}
                    placeholder="https://example.com/image.jpg"
                    value={url}
                    onChange={(e) => setUrl(i, e.target.value)}
                    disabled={imageForm.submitting}
                  />
                  {imageForm.urls.length > 1 && (
                    <button
                      type="button"
                      className={styles.imageFormRemove}
                      onClick={() => removeUrl(i)}
                      disabled={imageForm.submitting}
                      aria-label="Remove URL"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                className={styles.imageFormAddUrl}
                onClick={addUrl}
                disabled={imageForm.submitting}
              >
                + Add another URL
              </button>

              {imageForm.error && (
                <p className={styles.imageFormError}>{imageForm.error}</p>
              )}

              <div className={styles.imageFormActions}>
                <button
                  type="submit"
                  className={styles.imageFormSubmit}
                  disabled={imageForm.submitting}
                >
                  {imageForm.submitting ? 'Saving…' : 'Save images'}
                </button>
                <button
                  type="button"
                  className={styles.imageFormCancel}
                  onClick={closeImageForm}
                  disabled={imageForm.submitting}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <section className={styles.section}>
            <h2>Ingredients</h2>
            <ul className={styles.ingredients}>
              {recipe.ingredients.map((ingredient, i) => (
                <li key={i}>
                  <span className={styles.qty}>{ingredient.quantity}</span>
                  {ingredient.item}
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.section}>
            <h2>Instructions</h2>
            <ol className={styles.steps}>
              {recipe.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </section>

          <a
            className={styles.sourceLink}
            href={recipe.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            View original recipe ↗
          </a>
        </>
      )}
    </div>
  );
}
