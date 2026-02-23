import { getAuthorizationUrl } from './src/oauth.js';
import { env } from './src/env-adapter.js';
try {
  console.log(getAuthorizationUrl('U123456', env));
} catch (e) {
  console.error("Error generating aut url", e);
}
