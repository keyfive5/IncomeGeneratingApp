// Metro picks iap.native.ts on iPhone and iap.web.ts in the browser; this
// file only gives TypeScript one module to resolve.
export { purchaser, CancelledError } from './iap.web';
