import express from 'express';
import { handleChangePassword, handleForgotPassword, handleLogin, handleLogout, handleResendVerification, handleResetPassword, handleSignup, handleVerifyEmail, renderChangePassword, renderForgotPassword, renderLogin, renderResetPassword, renderSignup, renderVerifyNeeded, } from './forms.js';
import { finishGoogleLogin, startGoogleLogin } from './google.js';
export const authRouter = express.Router();
authRouter.get('/login', renderLogin);
authRouter.post('/login', handleLogin);
authRouter.get('/signup', renderSignup);
authRouter.post('/signup', handleSignup);
authRouter.get('/register', renderSignup);
authRouter.post('/register', handleSignup);
authRouter.get('/auth/google', startGoogleLogin);
authRouter.get('/auth/google/callback', finishGoogleLogin);
authRouter.get('/forgot-password', renderForgotPassword);
authRouter.post('/forgot-password', handleForgotPassword);
authRouter.get('/reset-password', renderResetPassword);
authRouter.post('/reset-password', handleResetPassword);
authRouter.get('/change-password', renderChangePassword);
authRouter.post('/change-password', handleChangePassword);
authRouter.post('/verify-email', handleVerifyEmail);
authRouter.get('/verify-needed', renderVerifyNeeded);
authRouter.post('/resend-verification', handleResendVerification);
authRouter.get('/callback', (_request, response) => {
    response.redirect('/');
});
authRouter.post('/logout', handleLogout);
//# sourceMappingURL=routes.js.map