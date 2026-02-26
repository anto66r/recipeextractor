export interface RecipeImage {
  filename: string;
  alt: string;
  width: number;
  height: number;
}

export interface RecipeIndex {
  id: string;
  slug: string;
  title: string;
  tags: string[];
  images: RecipeImage[];
  sourceUrl: string;
  createdAt: string;
}

export interface Ingredient {
  quantity: string;
  item: string;
}

export interface Recipe {
  schemaVersion: 2;
  id: string;
  slug: string;
  title: string;
  description: string;
  sourceUrl: string;
  originalServings: number;
  servings: 4;
  prepTime: string;
  cookTime: string;
  tags: string[];
  images: RecipeImage[];
  ingredients: Ingredient[];
  steps: string[];
  createdAt: string;
}
