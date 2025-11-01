# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Notes

- The Firebase messaging service worker remains a static asset and is independent of runtime i18n features.

## Troubleshooting Updates

- If you cannot see the latest deployed UI, open the site in an incognito/private window, or go to **Application → Service Workers → Unregister**, then perform a **Hard Reload**.

## Deployment Preparation

Before deploying Firebase Functions, complete the following:

1. **Store the app base URL**

   ```bash
   firebase functions:secrets:set APP_BASE_URL
   ```

   - **Local development:** add `APP_BASE_URL=...` to `functions/.env` or export it in your shell before starting the emulator.

2. **Store the Resend API key**
   ```bash
   firebase functions:secrets:set RESEND_API_KEY
   ```
3. **(Recommended) Configure tracking endpoints**

   ```bash
   firebase functions:secrets:set OPEN_PIXEL_URL="https://asia-east1-<your-project-id>.cloudfunctions.net/openPixel"
   firebase functions:secrets:set CLICK_REDIRECT_URL="https://asia-east1-<your-project-id>.cloudfunctions.net/clickRedirect"
   ```

   - Replace `<your-project-id>` with your Firebase project ID.
   - If you omit `OPEN_PIXEL_URL` or `CLICK_REDIRECT_URL`, the functions fallback to the values derived from `APP_BASE_URL`.

Add the same values (especially `APP_BASE_URL`) to your CI/CD secrets when enabling automated deployments.

## Local Development

- Populate `functions/.env` with the same secrets (`APP_BASE_URL`, `RESEND_API_KEY`, optional tracking URLs) so the Functions emulator can resolve runtime values.
- Deploy functions after building:
  ```bash
  npm --prefix functions install
  npm --prefix functions run build
  firebase deploy --only functions
  ```

## User Preferences & FX Rates

- Each user document (`users/{uid}`) now supports a `preferredCurrency` field (`'TWD' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'KRW'`). When absent we default to `TWD`.
- Configure the FX admin allowlist with `firebase functions:secrets:set FX_ADMIN_EMAILS="a@b.com,c@d.com"` (adjust the emails to match your team).
- The front end keeps the preference in Firestore **and** `localStorage` so the interface switches currencies immediately even while offline.
- All monetary display logic runs through `src/lib/money.ts`. Amounts stay persisted in TWD and are formatted/conversion-ready via `formatCurrency(valueTwd, options)`.
- Currency formatting accepts optional rates (TWD→target). If you omit a rate, the UI falls back to symbol/locale-only formatting (`NT$ 1,234` becomes `$ 1,234` when set to USD but no rate is available), so end users still see a sensible format even when rates are missing.
- Only allowlisted admins can call the callable Cloud Function `setFxRates`; regular clients have read-only access to `fx_rates` through the backend. Manual FX entries land in `fx_rates/{dateISO}` and remain the source of truth until an automated refresh is available.
