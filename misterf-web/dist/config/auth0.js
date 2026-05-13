import { auth } from 'express-openid-connect';
import { env } from './env.js';
function requireValue(name, value) {
    if (!value) {
        throw new Error(`${name} is required for Auth0 authentication.`);
    }
    return value;
}
export function createAuth0Middleware() {
    const issuerBaseURL = `https://${requireValue('AUTH0_DOMAIN', env.auth0Domain)}`;
    const config = {
        authRequired: false,
        auth0Logout: true,
        baseURL: requireValue('APP_BASE_URL', env.appBaseUrl),
        clientID: requireValue('AUTH0_CLIENT_ID', env.auth0ClientId),
        clientSecret: requireValue('AUTH0_CLIENT_SECRET', env.auth0ClientSecret),
        issuerBaseURL,
        secret: requireValue('AUTH0_SECRET', env.auth0Secret),
        authorizationParams: {
            response_type: 'code',
            scope: 'openid profile email',
        },
        routes: {
            login: '/login',
            logout: '/logout',
            callback: '/callback',
            postLogoutRedirect: '/',
        },
    };
    return auth(config);
}
//# sourceMappingURL=auth0.js.map