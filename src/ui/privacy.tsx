/**
 * "Escolhas de privacidade" nas configurações: o jogador muda, a qualquer hora, o que respondeu sobre anúncio personalizado.
 * Um toque abre o formulário do CMP (o mesmo de quando aceitou ou recusou); a resposta chega ao provider de anúncio sozinha.
 * Sem o que rever (sem CMP, fora das regiões que pedem), o botão nem aparece.
 */
import { useEffect, useState } from 'react';
import type { ConsentProvider } from '../ads/consent.ts';
import { Button } from './components.tsx';

const LABEL = { pt: 'Escolhas de privacidade', en: 'Privacy choices' } as const;

/** Ação sem React, para quem já tem seu próprio botão. Devolve false se não havia o que abrir. */
export function openPrivacyChoices(consent: ConsentProvider): Promise<boolean> {
  return consent.privacyOptionsAvailable() ? consent.showPrivacyOptions() : Promise.resolve(false);
}

export interface PrivacyChoicesButtonProps {
  consent: ConsentProvider;
  lang?: 'pt' | 'en';
  /** Texto próprio; substitui o padrão do idioma. */
  label?: string;
  className?: string;
}

export function PrivacyChoicesButton({ consent, lang = 'pt', label, className }: PrivacyChoicesButtonProps) {
  // Reavalia quando o CMP muda de estado (ele pode ficar disponível depois de carregar).
  const [, bump] = useState(0);
  useEffect(() => consent.subscribe(() => bump((n) => n + 1)), [consent]);
  if (!consent.privacyOptionsAvailable()) return null;
  return (
    <Button variant="quiet" className={className} onClick={() => void openPrivacyChoices(consent)}>
      {label ?? LABEL[lang]}
    </Button>
  );
}
