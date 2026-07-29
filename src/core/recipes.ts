// Recipe System
// Defines and applies reusable configurations to elements.

export type RecipeConfig = Record<string, string | boolean | number>;

const recipes = new Map<string, RecipeConfig>();

/**
 * Registers a new recipe configuration.
 * Keys in the configuration correspond to the suffix of `fx-` attributes
 * (e.g., `toast: true` becomes `fx-toast`, `retry: 2` becomes `fx-retry="2"`).
 * CamelCase keys are converted to kebab-case (e.g., `focusError: true` -> `fx-focus-error`).
 */
export function registerRecipe(name: string, config: RecipeConfig): void {
  recipes.set(name, config);
}

/**
 * Retrieves a registered recipe.
 */
export function getRecipe(name: string): RecipeConfig | undefined {
  return recipes.get(name);
}

/**
 * Applies a recipe to an element by writing the corresponding `fx-*` attributes,
 * provided they do not already exist (explicit element attributes take precedence).
 */
export function applyRecipe(element: Element, recipeName: string): void {
  const config = getRecipe(recipeName);
  if (!config) {
    console.warn(`[flux] Recipe "${recipeName}" not found.`);
    return;
  }

  for (const [key, value] of Object.entries(config)) {
    if (value === false) continue; // Skip false boolean flags

    // Convert camelCase to kebab-case
    const kebabKey = key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    const attrName = `fx-${kebabKey}`;

    // Do not overwrite explicit attributes on the element
    if (!element.hasAttribute(attrName)) {
      element.setAttribute(attrName, value === true ? '' : String(value));
    }
  }
}
