import styles from './TagFilter.module.css';

interface Props {
  tags: string[];
  activeTag: string | null;
  onSelect: (tag: string | null) => void;
}

export default function TagFilter({ tags, activeTag, onSelect }: Props) {
  if (tags.length === 0) return null;

  return (
    <div className={styles.container} role="group" aria-label="Filter by tag">
      <button
        className={`${styles.tag} ${activeTag === null ? styles.active : ''}`}
        onClick={() => onSelect(null)}
        aria-pressed={activeTag === null}
      >
        All
      </button>
      {tags.map((tag) => (
        <button
          key={tag}
          className={`${styles.tag} ${activeTag === tag ? styles.active : ''}`}
          onClick={() => onSelect(activeTag === tag ? null : tag)}
          aria-pressed={activeTag === tag}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}
