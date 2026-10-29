import { LANGS } from "../i18n/index.js";
const abs = (origin, pathOrUrl) => (/^https?:\/\//.test(pathOrUrl) ? pathOrUrl : origin + pathOrUrl);
/**
 * Dados estruturados `VideoGame` + `WebApplication` (schema.org) da página. A variação aponta para o jogo em `isPartOf`.
 * Sem `aggregateRating` nem `review`: avaliação só entra se for real e vier de dados reais, nunca inventada.
 */
export function videoGameJsonLd(game, page) {
    const ld = {
        '@context': 'https://schema.org',
        '@type': ['VideoGame', 'WebApplication'],
        name: page.heading,
        description: page.description,
        url: page.url,
        image: abs(game.origin, page.image),
        inLanguage: page.lang,
        genre: game.genre,
        applicationCategory: 'Game',
        operatingSystem: 'Any',
        playMode: 'SinglePlayer',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
    };
    if (game.publisher)
        ld.publisher = { '@type': 'Organization', name: game.publisher.name, url: game.publisher.url };
    if (page.variant) {
        ld.isPartOf = { '@type': 'VideoGame', name: game.name[page.lang], url: `${game.origin}/${page.lang}/` };
    }
    return ld;
}
/**
 * Confere o que `VideoGame` + `WebApplication` precisam para o validador do schema.org e os leitores do Google:
 * contexto, tipo, textos, endereços https e idioma conhecido. Vazio = válido.
 * (Dados válidos não garantem resultado rico: o Google só mostra o de app com avaliação real, que não inventamos.)
 */
export function validateVideoGameJsonLd(ld) {
    const errors = [];
    if (typeof ld !== 'object' || ld === null)
        return ['não é um objeto'];
    const o = ld;
    if (o['@context'] !== 'https://schema.org')
        errors.push('@context deve ser https://schema.org');
    const types = Array.isArray(o['@type']) ? o['@type'] : [o['@type']];
    if (!types.includes('VideoGame') || !types.includes('WebApplication'))
        errors.push('@type deve ser [VideoGame, WebApplication]');
    if (o.aggregateRating !== undefined || o.review !== undefined)
        errors.push('aggregateRating/review só com avaliação real');
    for (const key of ['name', 'description', 'genre', 'applicationCategory', 'operatingSystem']) {
        if (typeof o[key] !== 'string' || !o[key].trim())
            errors.push(`${key} ausente`);
    }
    for (const key of ['url', 'image']) {
        if (typeof o[key] !== 'string' || !/^https:\/\/\S+$/.test(o[key]))
            errors.push(`${key} deve ser um endereço https`);
    }
    if (!LANGS.includes(o.inLanguage))
        errors.push('inLanguage deve ser pt ou en');
    const offers = o.offers;
    if (!offers || offers['@type'] !== 'Offer')
        errors.push('offers deve ser um Offer');
    else {
        if (typeof offers.price !== 'string' || Number.isNaN(Number(offers.price)))
            errors.push('offers.price deve ser número em texto');
        if (typeof offers.priceCurrency !== 'string' || !/^[A-Z]{3}$/.test(offers.priceCurrency))
            errors.push('offers.priceCurrency deve ter 3 letras');
    }
    if (o.publisher !== undefined) {
        const p = o.publisher;
        if (p['@type'] !== 'Organization' || typeof p.name !== 'string' || !p.name)
            errors.push('publisher inválido');
    }
    return errors;
}
/** JSON seguro para dentro de <script>: o caractere menor-que vira o escape unicode, então nada fecha a tag antes da hora. */
export function jsonForScript(value) {
    return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(new RegExp(String.fromCharCode(0x2028), 'g'), '\\u2028')
        .replace(new RegExp(String.fromCharCode(0x2029), 'g'), '\\u2029');
}
