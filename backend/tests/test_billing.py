import pytest
from app.services.billing_service import BillingService, PRICING_PLANS
from app.services.two_factor import TwoFactorService

class TestTwoFactorService:
    def test_secret_generation(self):
        secret = TwoFactorService.generate_secret()
        assert len(secret) >= 16
        assert secret.isalnum()

    def test_totp_code_generation_and_verification(self):
        secret = TwoFactorService.generate_secret()
        code = TwoFactorService.get_totp_code(secret)
        assert len(code) == 6
        assert code.isdigit()
        assert TwoFactorService.verify_code(secret, code) is True

    def test_totp_rejects_invalid_code(self):
        secret = TwoFactorService.generate_secret()
        assert TwoFactorService.verify_code(secret, "000000") is False or TwoFactorService.verify_code(secret, "999999") is False

    def test_otpauth_uri_generation(self):
        secret = "JBSWY3DPEHPK3PXP"
        uri = TwoFactorService.get_otpauth_uri(secret, "test@insightai.com")
        assert "otpauth://totp/InsightAI:test@insightai.com" in uri
        assert f"secret={secret}" in uri

class TestBillingService:
    def test_pricing_plans_configuration(self):
        assert "PRO" in PRICING_PLANS
        assert "ENTERPRISE" in PRICING_PLANS
        assert PRICING_PLANS["PRO"]["amount_inr"] == 799.0
        assert PRICING_PLANS["ENTERPRISE"]["amount_inr"] == 3999.0

    def test_razorpay_order_payload_creation(self):
        payload = BillingService.create_razorpay_order_payload("PRO", organization_id=1)
        assert payload["plan"] == "PRO"
        assert payload["amount"] == 79900 # in paise
        assert payload["currency"] == "INR"
        assert payload["order_id"].startswith("order_rzp_")

    def test_payment_signature_verification(self):
        order_id = "order_123"
        payment_id = "pay_456"
        secret = "test_secret"
        import hmac, hashlib
        sig = hmac.new(secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()

        assert BillingService.verify_payment_signature(order_id, payment_id, sig, secret=secret) is True
        assert BillingService.verify_payment_signature(order_id, payment_id, "invalid_sig", secret=secret) is False
