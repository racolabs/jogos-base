/**
 * Consentimento no app (Android e iOS): UMP (User Messaging Platform) do Google. SEM IMPLEMENTAÇÃO AINDA.
 *
 * O UMP é um SDK nativo; só existe depois que o app Capacitor existir (racolabs/jogos-base#32, Fase 3).
 * Quando existir, a implementação `UmpConsentProvider` deve ser escrita nesta pasta (`src/ads`, único lugar
 * onde SDK de anúncio é permitido pelo guard `assertNoDirectAdSdk`) e cumprir `ConsentProvider`
 * (consent.ts) usando o plugin descrito abaixo. O jogo não muda: troca-se a implementação.
 *
 * Mapa UMP -> ConsentProvider:
 * - init()                    -> requestConsentInfoUpdate (com tagForUnderAgeOfConsent conforme a idade conhecida)
 *                                e leitura do consentStatus e dos consentimentos. Com limite de tempo.
 * - request()                 -> loadAndShowConsentFormIfRequired (só abre se a lei pede; 1ª camada com
 *                                "Consentir" e "Não consentir" no mesmo peso, configurada no painel do AdMob).
 * - privacyOptionsAvailable() -> privacyOptionsRequirementStatus === 'required'
 * - showPrivacyOptions()      -> showPrivacyOptionsForm
 * - state()                   -> 'personalized' só se os propósitos 1, 3 e 4 e o fornecedor Google estiverem
 *                                consentidos (mesma regra de consent-google.ts); 'non-personalized' para qualquer
 *                                outra situação já lida; 'unknown' antes da primeira leitura.
 * - subscribe()               -> a cada retorno de request()/showPrivacyOptions() e ao reabrir o app.
 * Pedido de anúncio só sai depois de `canRequestAds` ser true.
 */

export type UmpConsentStatus = 'unknown' | 'required' | 'notRequired' | 'obtained';
export type UmpPrivacyOptionsStatus = 'unknown' | 'required' | 'notRequired';

export interface UmpConsentInfo {
  consentStatus: UmpConsentStatus;
  canRequestAds: boolean;
  privacyOptionsRequirementStatus: UmpPrivacyOptionsStatus;
  /** Propósitos TCF com consentimento (ex.: [1, 3, 4]), lidos da string guardada pelo UMP. */
  purposeConsents: readonly number[];
  /** Consentimento do fornecedor Google (id 755 na lista TCF). */
  googleVendorConsent: boolean;
}

/** O que o plugin Capacitor do UMP precisa expor. Tipos prontos para a jogos-base#32; nada usa isto ainda. */
export interface UmpBridge {
  requestConsentInfoUpdate(opts: { tagForUnderAgeOfConsent: boolean }): Promise<UmpConsentInfo>;
  loadAndShowConsentFormIfRequired(): Promise<UmpConsentInfo>;
  showPrivacyOptionsForm(): Promise<UmpConsentInfo>;
}
