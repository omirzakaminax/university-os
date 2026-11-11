export const THEMES = ["light", "dark", "system"] as const;
export type ThemeMode = (typeof THEMES)[number];
export const THEME_COOKIE = "uos_theme";

export const isThemeMode = (v: unknown): v is ThemeMode => typeof v === "string" && (THEMES as readonly string[]).includes(v);

/**
 * Blocking script that runs before first paint so there is no flash of the wrong theme.
 * It reads the same cookie the server reads; "system" resolves through prefers-color-scheme.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]+)/);var t=m?decodeURIComponent(m[1]):'system';if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','light')}})();`;
