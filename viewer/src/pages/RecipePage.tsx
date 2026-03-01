import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Recipe, RecipeImage as RecipeImageType } from '../types';
import ImageCarousel from '../components/ImageCarousel';
import RecipeImage from '../components/RecipeImage';
import styles from './RecipePage.module.css';

type Status = 'loading' | 'error' | 'notfound' | 'ready';

export default function RecipePage() {
  const { id } = useParams<{ id: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [status, setStatus] = useState<Status>('loading');

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

  function handleImagesChange(images: RecipeImageType[]) {
    setRecipe((prev) => (prev ? { ...prev, images } : prev));
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
          <RecipeImage
            recipeId={recipe.id}
            images={recipe.images}
            index={0}
            className={styles.hero}
            loading="eager"
          />

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

          <ImageCarousel
            recipeId={recipe.id}
            images={recipe.images}
            onImagesChange={handleImagesChange}
          />
        </>
      )}
    </div>
  );
}
