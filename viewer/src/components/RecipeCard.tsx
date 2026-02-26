import { Link } from 'react-router-dom';
import type { RecipeIndex } from '../types';
import RecipeImage from './RecipeImage';
import styles from './RecipeCard.module.css';

interface Props {
  recipe: RecipeIndex;
}

export default function RecipeCard({ recipe }: Props) {
  return (
    <Link to={`/recipe/${recipe.id}`} className={styles.card}>
      <div className={styles.imageWrapper}>
        <RecipeImage
          recipeId={recipe.id}
          images={recipe.images}
          index={0}
          className={styles.image}
          loading="lazy"
        />
      </div>
      <div className={styles.body}>
        <h2 className={styles.title}>{recipe.title}</h2>
        {recipe.tags.length > 0 && (
          <div className={styles.tags}>
            {recipe.tags.map((tag) => (
              <span key={tag} className={styles.tag}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
