import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'bellnexa-install-prompt-dismissed';

const wasDismissed = (): boolean => {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
};

const markDismissed = () => {
  try {
    window.localStorage.setItem(DISMISSED_KEY, 'true');
  } catch (error) {
    console.warn('Could not save the install prompt preference:', error);
  }
};

const getInstallInstructions = () => {
  if (typeof window === 'undefined') {
    return { showIOSInstructions: false, showBrowserInstructions: false };
  }

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && navigator.standalone === true);
  if (isStandalone) return { showIOSInstructions: false, showBrowserInstructions: false };

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isSafari = /safari/i.test(navigator.userAgent) && !/crios|fxios|edgios/i.test(navigator.userAgent);
  const showIOSInstructions = isIOS && isSafari;
  return {
    showIOSInstructions,
    showBrowserInstructions: !showIOSInstructions,
  };
};

export const InstallPrompt: React.FC = () => {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [instructions, setInstructions] = useState(getInstallInstructions);
  const [dismissed, setDismissed] = useState(wasDismissed);
  const { showIOSInstructions, showBrowserInstructions } = instructions;

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in navigator && navigator.standalone === true);

    if (isStandalone || dismissed) return;

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setInstructions({ showIOSInstructions: false, showBrowserInstructions: false });
    };
    const handleInstalled = () => {
      setInstallEvent(null);
      setInstructions({ showIOSInstructions: false, showBrowserInstructions: false });
      setDismissed(true);
    };

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [dismissed]);

  const dismiss = () => {
    markDismissed();
    setDismissed(true);
    setInstallEvent(null);
    setInstructions({ showIOSInstructions: false, showBrowserInstructions: false });
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    if (choice.outcome === 'dismissed') dismiss();
  };

  if (dismissed || (!installEvent && !showIOSInstructions && !showBrowserInstructions)) return null;

  return (
    <aside
      aria-label="Install BellNexa"
      className="fixed bottom-4 right-4 z-[70] w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-sky-800 bg-[#0A1B45] p-4 text-white shadow-2xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Download className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#54DDF4]" />
          <div>
            <h2 className="text-sm font-bold">Install BellNexa</h2>
            <p className="mt-1 text-xs leading-relaxed text-sky-100">
              {installEvent
                ? 'Add the app to your home screen for quicker access.'
                : showIOSInstructions
                  ? 'In Safari, tap Share, then choose “Add to Home Screen.”'
                  : 'Open your browser menu and choose “Install app” or “Add to Home Screen,” if available.'}
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-sky-200/80">
              Installing may cache the app shell. Browser playback still depends on the page staying active and device support.
            </p>
            {installEvent && (
              <button
                type="button"
                onClick={install}
                className="mt-3 rounded-lg bg-[#12C8E8] px-3 py-2 text-xs font-bold text-[#07142F] transition hover:bg-[#54DDF4]"
              >
                Install app
              </button>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="rounded p-1 text-sky-200 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
};
