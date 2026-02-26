import { z } from 'zod';

export const IngredientSchema = z.object({
  quantity: z.string().min(1),
  item: z.string().min(1),
});

const TAG_TAXONOMY = [
  // Meal type
  'breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'drink',
  // Dietary
  'vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free', 'low-carb',
  // Cuisine
  'Italian', 'Asian', 'Mexican', 'Mediterranean', 'American', 'French',
  'Indian', 'Middle Eastern', 'Japanese', 'Thai',
  // Attribute
  'quick', 'meal-prep', 'one-pot', 'batch-cooking', 'comfort-food',
] as const;

export const TAG_VALUES = TAG_TAXONOMY;

export const ExtractedRecipeSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  originalServings: z.number().int().positive(),
  servings: z.literal(4),
  prepTime: z.string().min(1),
  cookTime: z.string().min(1),
  tags: z.array(z.enum(TAG_TAXONOMY)).max(6),
  ingredients: z.array(IngredientSchema).min(1),
  steps: z.array(z.string().min(1)).min(1),
});

export type ExtractedRecipe = z.infer<typeof ExtractedRecipeSchema>;
