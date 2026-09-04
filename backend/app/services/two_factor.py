import hmac
import hashlib
import time
import struct
import base64
import secrets
from typing import Tuple

class TwoFactorService:
    """
    RFC 6238 compliant Time-Based One-Time Password (TOTP) service
    compatible with Google Authenticator, Microsoft Authenticator, and Authy.
    """

    @staticmethod
    def generate_secret() -> str:
        """Generate a secure Base32 secret key."""
        random_bytes = secrets.token_bytes(20)
        return base64.b32encode(random_bytes).decode("utf-8").replace("=", "")

    @staticmethod
    def get_totp_code(secret: str, for_time: int = None) -> str:
        """Generate a 6-digit TOTP code for a given timestamp."""
        if for_time is None:
            for_time = int(time.time())

        time_step = for_time // 30
        # Add padding if needed for base32 decoding
        padded = secret + "=" * ((8 - len(secret) % 8) % 8)
        key = base64.b32decode(padded, casefold=True)

        msg = struct.pack(">Q", time_step)
        digest = hmac.new(key, msg, hashlib.sha1).digest()

        offset = digest[19] & 15
        code_int = (struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF) % 1000000
        return f"{code_int:06d}"

    @staticmethod
    def verify_code(secret: str, code: str, window: int = 1) -> bool:
        """
        Verify a 6-digit code against the secret key.
        Accepts codes within +/- window * 30 seconds for clock drift tolerance.
        """
        if not secret or not code:
            return False

        clean_code = str(code).strip()
        if len(clean_code) != 6 or not clean_code.isdigit():
            return False

        current_time = int(time.time())
        for offset in range(-window, window + 1):
            if TwoFactorService.get_totp_code(secret, current_time + offset * 30) == clean_code:
                return True
        return False

    @staticmethod
    def get_otpauth_uri(secret: str, user_email: str, issuer: str = "InsightAI") -> str:
        """Generate standard otpauth URI for QR code integration."""
        return f"otpauth://totp/{issuer}:{user_email}?secret={secret}&issuer={issuer}&algorithm=SHA1&digits=6&period=30"
