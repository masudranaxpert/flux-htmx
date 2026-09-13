// Recipe System
// Defines and applies reusable configurations to elements.

// Keys whose fx-* alias forms were removed in 2.0 map straight to raw htmx attributes.
const RAW_HX_KEYS = new Set([
  'target',
  'swap',
  'trigger',
  'select',
  'sync',
  'include',
  'vals',
  'headers',
  'confirm',
  'boost',
  'preload',
  'preserve',
]);

/** Resolves a config key to its final attribute: raw hx-* for htmx options, fx-* otherwise. */
export function attributeForKey(key: string): string {
  return RAW_HX_KEYS.has(key) ? `hx-${key}` : `fx-${key}`;
}

/** True when the element already declares the key (either form counts as explicit). */
export function hasExplicitAttribute(element: Element, key: string): boolean {
  return element.hasAttribute(`fx-${key}`) || element.hasAttribute(`hx-${key}`);
}

export type RecipeConfig = Record<string, string | boolean | number>;

const recipes = new Map<string, RecipeConfig>();

/**
 * Registers a new recipe configuration.
 * Keys in the configuration correspond to the suffix of `fx-` attributes
 * (e.g., `toast: true` becomes `fx-toast`, `retry: 2` becomes `fx-retry="2"`).
 * Htmx option keys (target, swap, trigger, ...) write the raw `hx-*` attribute.
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
 * Applies a recipe to an element by writing the corresponding `fx-*` / `hx-*`
 * attributes, provided they do not already exist (explicit element attributes win).
 */
export function applyRecipe(
  element: Element,
  recipeName: string,
  writtenKeys?: Map<string, string>,
): void {
  const config = getRecipe(recipeName);
  if (!config) {
    console.warn(`[flux] Recipe "${recipeName}" not found.`);
    return;
  }

  for (const [key, value] of Object.entries(config)) {
    if (value === false) continue; // Skip false boolean flags

    // Convert camelCase to kebab-case
    const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    const attrName = attributeForKey(kebabKey);

    // Do not overwrite explicit attributes on the element
    if (!hasExplicitAttribute(element, kebabKey)) {
      const attrValue = value === true ? '' : String(value);
      element.setAttribute(attrName, attrValue);
      writtenKeys?.set(attrName, attrValue);
    }
  }
}
