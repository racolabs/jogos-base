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
   `offlineHarness` serve a quem não fala com rede (e reprova se passar a falar). Para uma rede nova, o harness precisa ver o
   pedido de banner, intersticial e premiado e dizer se cada um saiu personalizado; harness que não vê pedido nenhum reprova
   ("teste cego"). Fábrica que só devolve classes já cobertas (como `adSenseFromEnv`) dispensa harness próprio.
3. Parâmetro novo para a rede (atributo, chave, query) reprova até entrar na lista permitida (`ALLOWED_*` no teste). Antes de
   acrescentar, confirme que não é dado do jogador.

O teste também prova que ele mesmo funciona, com um auto-teste para cada furo: provider só por fábrica, com métodos em campos de
seta, em subpasta, implementação que pede personalizado sem consentimento ou repassa dado do jogador, `import()` dinâmico,
`localStorage`/`sessionStorage` e `level`/`session` como parâmetro têm de ser reprovados.
