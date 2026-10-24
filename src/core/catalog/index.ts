import raw from './data/catalog.json';
import { ProblemCatalog } from './catalog';
import { CatalogSchema } from './schema';

let instance: ProblemCatalog | undefined;

/** The bundled catalog, validated once on first use. */
export function getCatalog(): ProblemCatalog {
  instance ??= new ProblemCatalog(CatalogSchema.parse(raw));
  return instance;
}

export { ProblemCatalog, problemUrl, siteUrls } from './catalog';
export * from './schema';
