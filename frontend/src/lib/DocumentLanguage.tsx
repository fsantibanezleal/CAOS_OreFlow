import { useEffect } from 'react';
import { useShellLang } from '@fasl-work/caos-app-shell';

/**
 * Writes the interface language to <html lang> (shell known defect 4: the shell keeps the language in
 * its own state and never writes it to the document, so a Spanish page declared itself English to
 * screen readers, search engines and the browser's translate offer). Rendered inside AppShell and on
 * the focus route, which renders outside the shell.
 */
export function DocumentLanguage(): null {
  const lang = useShellLang();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return null;
}
