export interface Ingredient {
  quantity: string;
  item: string;
}

export interface Recipe {
  schemaVersion: 1;
  id: string;
  slug: string;
  title: string;
  description: string;
  sourceUrl: string;
  originalServings: number;
  servings: number;
  prepTime: string;
  cookTime: string;
  tags: string[];
  ingredients: Ingredient[];
  steps: string[];
  createdAt: string;
}

export interface RecipeIndex {
  id: string;
  slug: string;
  title: string;
  tags: string[];
  createdAt: string;
}
