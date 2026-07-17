import { COOKIE_OPTIONS } from "../util/constants";
import { REFRESH_TOKEN_EXPIRY_MS } from "./auth";
import type { Response } from 'express';

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string, refreshSalt: string,userId:string) {
  res.cookie('user_id',userId,{
    ...COOKIE_OPTIONS,
    maxAge:REFRESH_TOKEN_EXPIRY_MS
  });

  res.cookie('access_token', accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: 15 * 60 * 1000, // 15 mins
  });
  res.cookie('refresh_token', refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: REFRESH_TOKEN_EXPIRY_MS,  // 1 month
  });
  res.cookie('refresh_salt', refreshSalt, {
    ...COOKIE_OPTIONS,
    maxAge: REFRESH_TOKEN_EXPIRY_MS, // 1 month
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie('access_token', COOKIE_OPTIONS);
  res.clearCookie('refresh_token', COOKIE_OPTIONS);
  res.clearCookie('refresh_salt', COOKIE_OPTIONS);
  res.clearCookie('user_id',COOKIE_OPTIONS);
}