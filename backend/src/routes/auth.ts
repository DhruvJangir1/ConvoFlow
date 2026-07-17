/* eslint-disable react-hooks/rules-of-hooks */
import { Router } from 'express'
import AuthEmailVerificaitonRouter from './authEmailVerification.js';
import AuthTokenVerificationRouter from './authTokenVerification.js';
import AuthUserVerificaitonRouter from './authUserVerification.js';
import WsTicketRouter from './wsTicket.js';

const AuthRouter = Router();

AuthRouter.use("/EmailVerificaitonRouter",AuthEmailVerificaitonRouter);
AuthRouter.use("/TokenVerificationRouter",AuthTokenVerificationRouter);
AuthRouter.use("/UserVerificaitonRouter",AuthUserVerificaitonRouter);
AuthRouter.use("/WsTicketRouter", WsTicketRouter);

export default AuthRouter;
