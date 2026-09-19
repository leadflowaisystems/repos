import type { Metadata } from 'next';

/**
 * HEADWAY, INSTALLED (mobile polish pass).
 *
 * The owner's side of Headway can be added to a phone's home screen and opens
 * like an app: its own icon, no browser bar, navy at the top. This is the whole
 * of it — a manifest (`public/app.webmanifest`), the icons rendered from the
 * existing mark (`public/icons`), and these tags. No service worker: nothing is
 * cached offline, so a signed-in page can never be served stale or to the wrong
 * person, and every screen is as fresh as it is in the browser.
 *
 * WHO GETS IT. Only the owner's trees — sign-in and the workspace — link the
 * manifest. The customer feedback page behind the QR code and the public site
 * do not, so a customer is never offered "install Headway" on a page that is
 * meant to take ten seconds and close.
 *
 * WHERE IT OPENS. `start_url` is `/login`, which already sends a signed-in
 * owner straight on to their workspace and shows the form to anyone else — so
 * tapping the icon lands on Home, and a signed-out phone lands on sign-in.
 * The session is the same cookie the browser uses; installing changes nothing
 * about how long it lasts.
 */

/** The navy of the app bar: the colour the phone's own status bar takes. */
export const APP_THEME_COLOR = '#102a43';

export const INSTALLABLE_METADATA = {
  applicationName: 'Headway',
  manifest: '/app.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Headway',
    statusBarStyle: 'default',
  },
  icons: {
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  formatDetection: { telephone: false },
} satisfies Metadata;
