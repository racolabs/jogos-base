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
