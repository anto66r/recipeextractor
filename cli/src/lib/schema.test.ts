import { describe, it, expect } from 'vitest';
import { ExtractedRecipeSchema } from './schema.js';

const validRecipe = {
  title: 'Pasta Carbonara',
  description: 'A classic Roman pasta dish.',
  originalServings: 2,
  servings: 4 as const,
  prepTime: '10 minutes',
  cookTime: '20 minutes',
  tags: ['Italian', 'dinner'],
  ingredients: [{ quantity: '400g', item: 'spaghetti' }],
  steps: ['Bring a large pot of salted water to a boil.'],
};

describe('ExtractedRecipeSchema', () => {
  it('accepts a valid recipe', () => {
    expect(() => ExtractedRecipeSchema.parse(validRecipe)).not.toThrow();
  });

  it('rejects when title is missing', () => {
    const { title: _t, ...rest } = validRecipe;
    expect(() => ExtractedRecipeSchema.parse(rest)).toThrow();
  });

  it('rejects when servings is not 4', () => {
    expect(() => ExtractedRecipeSchema.parse({ ...validRecipe, servings: 2 })).toThrow();
  });

  it('rejects a tag not in the taxonomy', () => {
    expect(() =>
      ExtractedRecipeSchema.parse({ ...validRecipe, tags: ['not-a-real-tag'] })
    ).toThrow();
  });

  it('rejects more than 6 tags', () => {
    expect(() =>
      ExtractedRecipeSchema.parse({
        ...validRecipe,
        tags: ['breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'drink', 'quick'],
      })
    ).toThrow();
  });

  it('rejects an empty ingredients array', () => {
    expect(() =>
      ExtractedRecipeSchema.parse({ ...validRecipe, ingredients: [] })
    ).toThrow();
  });

  it('rejects an empty steps array', () => {
    expect(() =>
      ExtractedRecipeSchema.parse({ ...validRecipe, steps: [] })
    ).toThrow();
  });

  it('rejects a negative originalServings', () => {
    expect(() =>
      ExtractedRecipeSchema.parse({ ...validRecipe, originalServings: -1 })
    ).toThrow();
  });

  it('accepts all valid tag taxonomy values', () => {
    const tags = ['breakfast', 'vegan', 'Italian', 'quick'] as const;
    expect(() =>
      ExtractedRecipeSchema.parse({ ...validRecipe, tags })
    ).not.toThrow();
  });
});
