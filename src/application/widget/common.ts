import type { WidgetContent } from '@gladysassistant/integration-sdk';
import type { Message } from '../stack/reconcileStack.ts';

export type Lang = 'en' | 'fr';

/** French for any `fr*` language, English otherwise. */
export function toLang(language: string | undefined): Lang {
  return language?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** Widget links must be https: a LAN http:// Bonap is never linked. */
export function httpsOnly(url: string | undefined): string | undefined {
  return url?.startsWith('https://') ? url : undefined;
}

/** Plain message content (not configured, Mealie unreachable…). */
export function buildMessageContent(
  message: Message,
  language: string | undefined,
  ttlSeconds = 60,
): WidgetContent {
  return {
    ttl_seconds: ttlSeconds,
    components: [{ type: 'text', variant: 'body', text: message[toLang(language)] }],
  };
}

export function openBonapButton(bonapUrl: string): WidgetContent['components'][number] {
  return {
    type: 'button',
    label: { en: 'Open Bonap', fr: 'Ouvrir Bonap' },
    style: 'secondary',
    link: { url: bonapUrl },
  };
}
