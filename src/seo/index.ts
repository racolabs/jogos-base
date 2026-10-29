export type { Localized, SeoGame, SeoPage, SeoVariant } from './types.ts';
export { DEFAULT_LANG, pagesFor, validateGame } from './pages.ts';
export { jsonForScript, validateVideoGameJsonLd, videoGameJsonLd } from './jsonld.ts';
export { bodyContent, escapeHtml, headTags, renderPage, type RenderOptions } from './render.ts';
export { robotsTxt, sitemapXml } from './sitemap.ts';
export { SHARE_IMAGE_SIZE, shareImageSvg, wrapText } from './share-image.ts';
