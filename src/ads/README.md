# ads

Anúncios atrás da interface `AdProvider` (AdMob, AdSense/H5, portais, nenhum). O jogo só vê a interface.

## AdSense: banner responsivo ou de tamanho fixo

`AdSenseProvider` desenha o banner num espaço (`slot`) que o jogo reserva. Há dois modos.

**Responsivo (padrão).** Sem `bannerSize`, o `ins` sai com `display:block`, `data-ad-format="auto"` e
`data-full-width-responsive="true"`. O Google escolhe a altura; o espaço do jogo precisa acomodá-la.

**Tamanho fixo.** Com `bannerSize`, o `ins` sai com `display:inline-block` e largura e altura em px no `style`,
sem `data-ad-format` e sem `data-full-width-responsive` (o formato documentado do AdSense para bloco fixo):

```ts
const ads = new AdSenseProvider({
  client: 'ca-pub-...',
  bannerSlots: { home: '1234567890', end: '0987654321' },
  bannerSize: { width: 320, height: 50 }, // ou, pelo ambiente: adSenseFromEnv(env, { bannerSize: { width: 320, height: 50 } })
});
```

```html
<ins class="adsbygoogle" style="display:inline-block;width:320px;height:50px"
     data-ad-client="ca-pub-..." data-ad-slot="1234567890"></ins>
```

Use o modo fixo quando o jogo reserva uma altura fixa (por exemplo 66 px para os botões não se mexerem):
o anúncio nunca passa do espaço, o que evita corte (política do AdSense). Escolha uma altura que caiba no espaço
(50 ou 60 px, por exemplo) e crie no painel do AdSense um bloco do tipo "fixo" com o mesmo tamanho; o tamanho do
bloco no painel e o do `bannerSize` devem coincidir. O mesmo `bannerSize` vale para todos os `bannerSlots`.

## CrazyGames (portal)

`CrazyGamesProvider` (`crazygames.ts`) é o único código que fala com o SDK HTML5 v3 do portal. O jogo continua só com `AdProvider`.

| `AdProvider` | SDK do CrazyGames |
| --- | --- |
| `showInterstitial()` | `ad.requestAd('midgame', callbacks)`; `true` só com `adFinished` |
| `showRewarded()` | `ad.requestAd('rewarded', callbacks)`; `earned` só com `adFinished`; `adError` depois de começar = `dismissed`, antes = `unavailable` (nunca premia) |
| `showBanner(placement, slot)` | cria um contêiner no `slot` e chama `banner.requestResponsiveBanner(id)`; `hideBanner` chama `clearBanner` |
| `preload` / `isReady` | o SDK não pré-carrega: pronto = SDK ativo, formato não desligado pelo portal e nenhum anúncio em andamento |
| `onPause` / `onResume` | no `adStarted` e no `adFinished`/`adError` (só quando o anúncio de fato começou, para não calar o som à toa) |

- **SDK ausente = no-op seguro.** Script bloqueado, domínio que não é do portal (`environment: 'disabled'`), `init()` que falha ou passa de
  `loadTimeoutMs` (8 s): nenhum anúncio, nenhum erro, o jogo segue. `adsDisabled` (Basic Launch, modo infantil) e bloqueador de anúncio
  escondem os formatos desligados (`isReady` passa a `false`), então o jogo não oferece botão de premiado sem efeito.
- **Um anúncio por vez** (o portal proíbe encadear). Pedido enquanto outro corre volta `false`/`unavailable`. Se o anúncio não começa em
  `requestTimeoutMs` (20 s), o jogo segue; o fim real do anúncio libera o pedido seguinte.
- **Frequência é do portal.** O `AdsController` continua decidindo *quanto* (suas travas), mas o SDK ignora pedido cedo demais (`adCooldown`)
  e o jogo segue sem anúncio. Não ligue o intersticial a botão de navegação (menu, configurações), regra do portal.
- **Privacidade.** O SDK não tem flag de "anúncio não personalizado" nem de "público infantil": o portal serve o anúncio e cuida do
  consentimento e do modo infantil. Este provider ignora `ConsentProvider` e o que não é política de privacidade, e só entrega ao SDK o formato
  e funções de retorno. O contrato (`contract.test.ts`, `crazyGamesHarness`) reprova qualquer dado a mais no pedido, na URL ou nos atributos
  do `<script>`. Em outras palavras: o que **podemos** garantir é que nada do jogador sai por aqui; a personalização em si é do portal.

### Eventos do portal (`portalOf`)

O portal mede carregamento e jogo. O jogo chama sempre `portalOf(ads)`; sem portal, o objeto não faz nada, então o jogo não conhece o SDK:

```ts
const portal = portalOf(ads);
portal.gameplayStart(); // iniciou ou retomou a partida (o primeiro mede o tamanho do download)
portal.gameplayStop();  // fim de partida, menu, pausa (não na troca de aba: o portal cuida)
portal.happyTime();     // conquista rara; use pouco
const off = portal.onAudioMutedChange((muted) => setMuted(muted)); // portal.audioMuted() vale mais que o som do jogo
```

### Composição do build do portal

O jogo escolhe tudo num lugar só, pelo ambiente do build (`VITE_PORTAL=crazygames`):

```ts
const profile = portalProfileFromEnv(import.meta.env);          // null fora do portal
const ads = crazyGamesFromEnv(import.meta.env, { onPause, onResume }); // null fora do portal
if (profile && ads) activatePortal(profile, ads.portal);        // antes de montar a interface
// <App adProvider={ads ?? undefined} />
```

Com o perfil ativo: `MoreGames` não renderiza, `useInstall` fica `unsupported` (cartão e passo a passo do iOS somem), `Feedback` cala som
quando o portal pede silêncio. `portalBlocks('serviceWorker' | 'externalLinks')` é para o build e para o jogo decidirem (service worker
desligado, sem links para fora). O guard `assertNoDirectAdSdk` barra o global `CrazyGames` e `sdk.crazygames.com` fora de `src/ads`.

## Consentimento (`ConsentProvider`)

Anúncio personalizado só com consentimento explícito de adulto; sem isso, tudo sai não personalizado. O jogo e o
`AdSenseProvider` falam só com a interface `ConsentProvider` (`consent.ts`): `state()` (`unknown` | `personalized` |
`non-personalized`), `init()`, `request()`, `privacyOptionsAvailable()`, `showPrivacyOptions()` e `subscribe()`.
`unknown` conta como não personalizado.

| Implementação | Onde | Uso |
| --- | --- | --- |
| `GoogleConsentProvider` | web (`consent-google.ts`) | CMP do Google (AdSense > Privacidade e mensagens), lido por `__tcfapi` (TCF v2) e reaberto por `googlefc.showRevocationMessage()` |
| `NoCmpConsentProvider` | qualquer | sem CMP: sempre `non-personalized`; não há o que rever |
| `FakeConsentProvider` | testes | formulário de um passo: `respond('accept' \| 'decline')`, conta `responses` |
| UMP (Capacitor) | app (`consent-app.ts`) | **não implementado**: depende do app Capacitor (racolabs/jogos-base#32, Fase 3). O arquivo documenta o mapa UMP -> interface e os tipos do plugin (`UmpBridge`) |

```ts
const consent = new GoogleConsentProvider();           // ou new NoCmpConsentProvider() em desenvolvimento
const ads = new AdSenseProvider({ client: 'ca-pub-...', consent });
await ads.init({ nonPersonalized: false, childDirected: false }); // o jogo sabe que o jogador é adulto
```

- **Personalizado** exige os dois: `policy.nonPersonalized === false` (decisão do jogo) e `consent.state() === 'personalized'`.
  Com a política padrão, sem `consent`, `unknown`, recusa ou `childDirected`, o pedido é não personalizado. A mudança de
  escolha vale para os próximos pedidos, sem recarregar.
- **Web/Google:** `personalized` só com os propósitos TCF 1, 3 e 4 e o fornecedor Google (755) consentidos. Fora da GDPR
  (`gdprApplies: false`) não há consentimento registrado, então fica `non-personalized`. O formulário é do Google e aparece
  quando o script do AdSense carrega; no painel, "Consentir" e "Não consentir" ficam na 1ª camada com o mesmo peso. Se o CMP não
  carregar, o estado fica `unknown` e nada trava (limites de tempo em `GoogleConsentOptions`).
- **Recusar é tão fácil quanto aceitar:** uma resposta, um estado novo, nos dois sentidos (testes em `consent.test.ts`).
- **Configurações:** `<PrivacyChoicesButton consent={consent} lang="pt" />` (`jogos-base/ui`) ou `openPrivacyChoices(consent)`.
  O botão só aparece se há o que rever.

## Contrato de anúncio (`contract.test.ts`)

Regras que toda implementação de `AdProvider` cumpre. O teste `contract.test.ts` as verifica em **todas** as implementações,
descobertas por forma e não por lista: qualquer export de `src/ads/index.ts` que seja (ou produza, sem argumentos) algo com os
métodos de `AdProvider` (classe com métodos no prototype ou em campos de seta, objeto, fábrica), mais a leitura recursiva dos
fontes de `src/ads` (qualquer subpasta, como `src/ads/admob/`) atrás de `class X implements AdProvider` e de funções que
declaram devolver um provider. O mesmo roteiro (init, banner, intersticial, premiado) roda em cada uma.

1. **Sem consentimento, nada personalizado.** Sem CMP, com consentimento `unknown` ou `non-personalized`, CMP que falha,
   consentimento revogado, política padrão ou `childDirected`, todo pedido (banner, intersticial e premiado) sai não
   personalizado. O pior caso testado é o jogo que se declara adulto (`nonPersonalized: false`). Personalizar exige os dois:
   decisão do jogo **e** `consent.state() === 'personalized'`. Para a rede, "personalizado" é qualquer pedido feito sem a
   flag de não personalizado ligada (no AdSense, `requestNonPersonalizedAds !== 1`).
2. **A segmentação própria só decide quanto, nunca qual.** Nível, sessão, métricas e o estado do jogador (`PlayerAdState`)
   só entram em `rules.ts`/`AdsController` (intervalo, limites, bloqueios). Nada disso chega à rede como parâmetro de
   targeting. O teste joga com um estado de jogador preenchido (valores-isca de nível, sessão e métricas) por um `AdsController`
   e reprova: (a) `init(policy)` receber algo além de `nonPersonalized`/`childDirected`; (b) qualquer chamada ao provider com
   argumento além de política, formato ou posição; (c) chave ou atributo novo na fila do Google, em `script`/`ins` ou na URL
   do script, e qualquer nome ou valor de segmentação, ou qualquer isca no que vai para a rede (inclusive com a política
   "suja" de dados do jogador: o provider tem de ignorá-los); (d) arquivo das implementações, em qualquer subpasta, que
   importe (estático, `import()` dinâmico ou `require`) `rules`/`controller`/`metrics`/`missions`/`storage`/`daily`, use
   `import()` com caminho não literal, leia `localStorage`/`sessionStorage`/`indexedDB` ou campos de `PlayerAdState`.

### Implementação nova

1. Exporte em `src/ads/index.ts`. Classe `implements AdProvider` ou fábrica que declara devolver `AdProvider` fora do índice
   também reprova (escaparia do contrato). Fábrica com argumentos obrigatórios: declare o tipo de retorno.
2. O teste falha em "todo provider tem harness" até você registrar um harness em `HARNESSES` (`contract.test.ts`), pelo nome do
   export. O harness diz como observar o que a rede recebe: `adsenseHarness` lê a fila e a flag de personalização;
   `offlineHarness` serve a quem não fala com rede (e reprova se passar a falar); `crazyGamesHarness` observa as chamadas ao SDK do portal (que não tem flag de personalização: o pedido só pode levar o formato e funções). Para uma rede nova, o harness precisa ver o
   pedido de banner, intersticial e premiado e dizer se cada um saiu personalizado; harness que não vê pedido nenhum reprova
   ("teste cego"). Fábrica que só devolve classes já cobertas (como `adSenseFromEnv`) dispensa harness próprio.
3. Parâmetro novo para a rede (atributo, chave, query) reprova até entrar na lista permitida (`ALLOWED_*` no teste). Antes de
   acrescentar, confirme que não é dado do jogador.

O teste também prova que ele mesmo funciona, com um auto-teste para cada furo: provider só por fábrica, com métodos em campos de
seta, em subpasta, implementação que pede personalizado sem consentimento ou repassa dado do jogador, `import()` dinâmico,
`localStorage`/`sessionStorage` e `level`/`session` como parâmetro têm de ser reprovados.
