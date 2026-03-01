import { useState } from 'react';
import type { RecipeImage as RecipeImageType } from '../types';

interface Props {
  recipeId: string;
  images: RecipeImageType[];
  index?: number;
  className?: string;
  loading?: 'eager' | 'lazy';
}

const Placeholder = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 400 300"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="No image available"
  >
    <rect width="400" height="300" fill="#f0f0ec" />
    <text
      x="200"
      y="145"
      textAnchor="middle"
      fill="#aaa"
      fontSize="48"
      fontFamily="sans-serif"
    >
      🍽
    </text>
    <text
      x="200"
      y="185"
      textAnchor="middle"
      fill="#bbb"
      fontSize="14"
      fontFamily="sans-serif"
    >
      No image
    </text>
  </svg>
);

export default function RecipeImage({
  recipeId,
  images,
  index = 0,
  className,
  loading = 'lazy',
}: Props) {
  const [errored, setErrored] = useState(false);
  const imageData = images[index];

  if (!imageData || errored) {
    return <Placeholder className={className} />;
  }

  const src = `/api/image?id=${encodeURIComponent(recipeId)}&f=${encodeURIComponent(imageData.filename)}`;

  return (
    <img
      className={className}
      src={src}
      alt={imageData.alt}
      width={imageData.width}
      height={imageData.height}
      loading={loading}
      onError={() => setErrored(true)}
    />
  );
}
