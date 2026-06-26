# Sign up functionality

    - User signs up -> his credentials are taken to the backend 
    - in the express route, the credentials are confirmed before they are inserted into the DB
    - Afterwards, the user is sent a 6-digit verification code to his email address, and the user is taken to a verificaiton page.
    - user types his verification code, we will take that code and confirm if it is the exact same code that was sent to the user.
    - if the code was the exact same, then we will provide the user with a JWT auth access and refresh token.
    - by providing this token, we will ensure that the user entering is valid and he wont need to re-login
    
    -Additionals-
    - We hash the password before storing it in the DB. 
    - We store the previous user signup/login attempt in a hashmap [key,val pairs] and also the verification codes that have been sent to a specific email For rate limiting purpose.

    - Potential Errors-
    - the user signs up with an existing email -> if u signed up with this email, then log in
    - the user tries to access some other user's data -> will be denied by our RLS polices which only allow each user to access only his own specific data.
    


# JWT Auth Workflow 
 
    - What is a JWT? -
 - JWT = header,payload,signature
 - Compact, URL-safe, signed token with claims (sub, iat, exp, aud)
 - JWTs prove the token issuer signed the payload. Typically used for stateless auth; verify signature + claims.
 
    - Access vs Refresh -
 - Access token: short-lived (15 min) for API auth
 - Refresh token: long-lived (7 days) to obtain new access tokens
 - Short access TTL limits exposure; refresh tokens let clients re-auth without re-login and should be stored/rotated securely.
 
    - How tokens are generated (code) -
 - Access: backend/src/services/auth.ts -> signAccessToken(sub,email) uses jwt.sign(..., SUPABASE_JWT_SECRET) (expiresIn: '15m')
 - Refresh: generateRefreshToken() -> crypto.randomBytes(48).toString('hex') and then store hash = sha256(token) in DB
 - Raw refresh token is returned once to client and never persisted; DB stores only its hash for verification.

    - Where tokens are stored & implications -
 - Backend sets httpOnly cookies: access_token (short), refresh_token (long)
 - Cookies: httpOnly, secure=true in production, sameSite: 'lax' in dev / 'none' in prod
 - httpOnly prevents JS access; frontend uses fetch(..., credentials:'include'). Cannot read tokens in JS, reducing XSS risk but consider CSRF protections.

    - Typical request flow -
 - Login: POST /api/auth/login -> sets cookies (access + refresh)
 - Requests: authenticate middleware reads access_token cookie and verifies JWT
 - Expired access: client calls POST /api/auth/refresh which hashes cookie, compares DB hash, issues new tokens and updates stored hash
 - Logout: clears refresh hash in DB and clears cookies
 - Refresh flow rotates refresh tokens (new raw token, new hash stored) â limits token replay window.

    - Security notes & best practices -
 - Store only refresh token hashes in DB; rotate on refresh
 - Use httpOnly + secure cookies and SameSite appropriate to deployment
 - Consider jti (token id) & revocation list for immediate invalidation
 - Protect refresh endpoint (rate-limit, IP checks), and design CSRF defenses if using cookies
 - Keep SUPABASE_JWT_SECRET and RESEND_API_KEY secret. Prefer server-side persistence for verification codes and logging for debugging.


    
    What's Missing From The Document Entirely
    - Token expiry times (access token TTL, refresh token TTL)
    - What constitutes a valid password (requirements)
    - HTTPS assumption (tokens in transit are only safe over TLS)
    - Code expiry time = max verification attempts before lockout (without this, the 6-digit code is brute-forceable in at most 1,000,000 attempts — add attempt limiting)