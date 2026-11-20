import hashlib,hmac,secrets
from datetime import datetime,timezone
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError,InvalidHashError
from app.config import settings

passwords=PasswordHasher()
DUMMY_HASH=passwords.hash(secrets.token_urlsafe(32))
def now(): return datetime.now(timezone.utc)
def token(): return secrets.token_urlsafe(32)
def digest(value): return hashlib.sha256(value.encode()).hexdigest()
def normalize_code(value): return ''.join(value.upper().split()).replace('-','')
def secret_hash(value,context='claim'):
    return hmac.new(settings().secret_key.encode(),(context+':'+value).encode(),hashlib.sha256).hexdigest()
def matches(value,stored,context='claim'):
    return hmac.compare_digest(secret_hash(value,context),stored)
def verification_code(): return f'{secrets.randbelow(1000000):06d}'
def claim_code():
    value=''.join(secrets.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(12))
    return '-'.join(value[i:i+4] for i in range(0,12,4))
def check_password(value,hashed):
    try: return passwords.verify(hashed,value)
    except (VerificationError,InvalidHashError): return False
