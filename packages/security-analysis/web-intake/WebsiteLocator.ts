export interface WebsiteLocator { url: string; origin: string; }
export function createWebsiteLocator(url: string): WebsiteLocator { const parsed = new URL(url); return { url, origin: parsed.origin }; }
