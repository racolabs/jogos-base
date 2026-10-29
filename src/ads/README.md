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
