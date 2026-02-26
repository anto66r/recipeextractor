import { Link } from 'react-router-dom';
import styles from './RecipePage.module.css';

/**
 * FR-8 placeholder — recipe detail view will be implemented in FR-8.
 * The route param `:id` is a UUID (recipe.id from index.json).
 * FR-8 will call GET /api/recipe?id=<id> to load the full recipe.
 */
export default function RecipePage() {
  return (
    <div className={styles.page}>
      <Link to="/" className={styles.back}>
        ← Back to recipes
      </Link>
      <p className={styles.notice}>
        Recipe detail view coming in FR-8.
      </p>
    </div>
  );
}
