# Existing Technology Stack

## Mobile target

- TypeScript with strict mode.
- Expo SDK 58, Expo Router 58, React 19.3, React Native 0.88.
- Jest 30 with `jest-expo` and `@testing-library/react-native`.
- Native core components are already used for screens and transport.

## Reference frontend

- Angular 20.3, Angular Router, Angular Forms, RxJS 7.8, TypeScript 5.9.
- Components use template-driven forms and Angular `HttpClient`.

## Backend interface

- Node.js/TypeScript with Express 5 and MongoDB Node driver 6.
- AI operations are exposed through existing authenticated REST routes.
- The mobile client receives its API origin through Expo config; no client-side database credentials are required.

## Constraints observed

- The Expo Router versioned documentation URL for SDK 58 returned 404 during this task; the current Expo Router docs were consulted for file routes and search parameters.
- No matching Angular-to-React-Native guideline file or endpoint contract test script was found.
