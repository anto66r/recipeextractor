import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import styles from './AddRecipePage.module.css';

type Status = 'idle' | 'submitting' | 'error';

interface ApiError {
  error: string;
  recipeId?: string;
}

export default function AddRecipePage() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [existingRecipeId, setExistingRecipeId] = useState<string | null>(null);
  const navigate = useNavigate();

  const isValidUrl = (input: string): boolean => {
    try {
      const parsed = new URL(input);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const trimmedUrl = url.trim();

    if (!isValidUrl(trimmedUrl)) {
      setStatus('error');
      setErrorMessage('Please enter a valid http or https URL.');
      setExistingRecipeId(null);
      return;
    }

    setStatus('submitting');
    setErrorMessage('');
    setExistingRecipeId(null);

    try {
      const response = await fetch('/api/add-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmedUrl }),
      });

      if (response.status === 409) {
        const data = (await response.json()) as ApiError;
        setStatus('error');
        setErrorMessage(data.error);
        setExistingRecipeId(data.recipeId ?? null);
        return;
      }

      if (!response.ok) {
        const data = (await response.json()) as ApiError;
        throw new Error(data.error || `Server error (HTTP ${response.status})`);
      }

      const { recipeId } = (await response.json()) as { recipeId: string };
      navigate(`/recipe/${recipeId}`);
    } catch (err: unknown) {
      setStatus('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to add recipe. Please try again.',
      );
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.backLink}>← My Recipes</Link>
        <h1 className={styles.heading}>Add Recipe</h1>
      </header>

      <main className={styles.main}>
        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <label htmlFor="url" className={styles.label}>
            Recipe URL
          </label>
          <input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/my-recipe"
            disabled={status === 'submitting'}
            className={styles.input}
            autoFocus
          />

          <button
            type="submit"
            disabled={status === 'submitting' || url.trim() === ''}
            className={styles.submitButton}
          >
            {status === 'submitting' ? 'Adding recipe…' : 'Add Recipe'}
          </button>

          {status === 'submitting' && (
            <p className={styles.hint}>This may take up to 60 seconds.</p>
          )}

          {status === 'error' && (
            <div className={styles.error} role="alert">
              <p>{errorMessage}</p>
              {existingRecipeId && (
                <Link to={`/recipe/${existingRecipeId}`} className={styles.errorLink}>
                  View existing recipe →
                </Link>
              )}
            </div>
          )}
        </form>

        <div className={styles.help}>
          <h2 className={styles.helpHeading}>How it works</h2>
          <ol className={styles.helpList}>
            <li>Paste a recipe URL from any website</li>
            <li>The recipe is extracted and normalized to 4 servings</li>
            <li>Tags are automatically assigned</li>
          </ol>
        </div>
      </main>
    </div>
  );
}
