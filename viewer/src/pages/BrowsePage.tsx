import { useEffect, useMemo, useState } from 'react';
import type { RecipeIndex } from '../types';
import RecipeCard from '../components/RecipeCard';
import TagFilter from '../components/TagFilter';
import styles from './BrowsePage.module.css';

type Status = 'loading' | 'error' | 'ready';

export default function BrowsePage() {
  const [recipes, setRecipes] = useState<RecipeIndex[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/recipes', { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<RecipeIndex[]>;
      })
      .then((data) => {
        setRecipes(data);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setStatus('error');
      });

    return () => controller.abort();
  }, []);

  const allTags = useMemo(() => {
    const seen = new Set<string>();
    for (const recipe of recipes) {
      for (const tag of recipe.tags) seen.add(tag);
    }
    return [...seen].sort();
  }, [recipes]);

  const filtered = useMemo(
    () =>
      activeTag === null
        ? recipes
        : recipes.filter((r) => r.tags.includes(activeTag)),
    [recipes, activeTag],
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.heading}>My Recipes</h1>
      </header>

      <main className={styles.main}>
        {status === 'loading' && (
          <p className={styles.statusMessage}>Loading recipes…</p>
        )}

        {status === 'error' && (
          <p className={styles.errorMessage}>
            Could not load recipes. Make sure the API is running.
          </p>
        )}

        {status === 'ready' && recipes.length === 0 && (
          <p className={styles.statusMessage}>
            No recipes yet. Add one with <code>recipe add &lt;url&gt;</code>.
          </p>
        )}

        {status === 'ready' && recipes.length > 0 && (
          <>
            <div className={styles.filterBar}>
              <TagFilter
                tags={allTags}
                activeTag={activeTag}
                onSelect={setActiveTag}
              />
            </div>

            {filtered.length === 0 ? (
              <p className={styles.statusMessage}>
                No recipes match the selected tag.
              </p>
            ) : (
              <div className={styles.grid}>
                {filtered.map((recipe) => (
                  <RecipeCard key={recipe.id} recipe={recipe} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
