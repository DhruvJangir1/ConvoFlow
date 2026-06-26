export interface TokenPayload {
  sub: string;
  email: string;
  aud: 'authenticated';
  iat: number;
  exp: number;
}


export interface insertPayloadType {
  id: string;
  user_name: string;
  email: string;
  password: string;
  refresh_token_hash: string;
  refresh_token_expiry: Date;
  last_login: Date;
  is_verified: boolean;
  user_tag: string;
}