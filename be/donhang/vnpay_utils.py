"""
VNPay 2.1.0 — HMAC-SHA512: chuỗi ký dùng giá trị đã encode (quote_plus / x-www-form-urlencoded);
URL redirect cũng quote_plus từng value (khớp tài liệu changeTypeHash).
"""
import hashlib
import hmac
import unicodedata
from urllib.parse import quote_plus

from django.conf import settings


def _cfg():
    return getattr(settings, 'VNPAY', None) or {}


def _secret_raw(cfg):
    return (cfg.get('HASH_SECRET') or '').strip()


def _order_info_ascii(text, max_len=255):
    if not text:
        return 'Thanh toan don hang'
    nfd = unicodedata.normalize('NFD', str(text)[:max_len])
    ascii_buf = ''.join(c for c in nfd if unicodedata.category(c) != 'Mn')
    out = ''.join(c if 32 <= ord(c) < 127 else ' ' for c in ascii_buf)
    out = ' '.join(out.split())[:max_len].strip()
    return out or 'Thanh toan don hang'


def _hmac_sha512_hex(secret: str, message: str) -> str:
    return hmac.new(
        secret.encode('utf-8'),
        message.encode('utf-8'),
        hashlib.sha512,
    ).hexdigest()


def _build_sign_string(params: dict, exclude: frozenset) -> str:
    """
    Chuỗi ký VNPAY 2.1.0 (HMAC-SHA512): sort key, bỏ hash; mỗi cặp key=value
    với value đã encode kiểu application/x-www-form-urlencoded (tương đương
    PHP urlencode / Java URLEncoder.encode), KHÔNG ký trên giá trị thô.
    Bỏ qua tham số có giá trị rỗng (khớp sample Java trong tài liệu VNPAY).
    """
    keys = sorted(
        k
        for k in params.keys()
        if k.startswith('vnp_') and k not in exclude
    )
    parts = []
    for k in keys:
        v = params.get(k)
        if v is None:
            continue
        val = str(v)
        if val == '':
            continue
        enc_val = quote_plus(val, safe='')
        parts.append(f'{k}={enc_val}')
    return '&'.join(parts)


def _payment_redirect_query(data: dict) -> str:
    """Ghép query redirect: quote_plus từng value, không dùng urlencode(dict)."""
    parts = []
    for k in sorted(data.keys()):
        v = data[k]
        parts.append(f'{k}={quote_plus(str(v), safe="")}')
    return '&'.join(parts)


def verify_vnpay_signature(params: dict):
    cfg = _cfg()
    secret = _secret_raw(cfg)
    if not secret:
        return False, 'Thiếu HASH_SECRET'

    recv = (params.get('vnp_SecureHash') or '').strip()
    if not recv:
        return False, 'Thiếu vnp_SecureHash'

    variants = (
        frozenset({'vnp_SecureHash'}),
        frozenset({'vnp_SecureHash', 'vnp_SecureHashType'}),
    )
    recv_l = recv.lower()
    for ex in variants:
        sign_data = _build_sign_string(params, ex)
        calc = _hmac_sha512_hex(secret, sign_data)
        try:
            if hmac.compare_digest(calc.lower(), recv_l):
                return True, None
        except (TypeError, ValueError):
            continue
    return False, 'Sai chữ ký'


verify_ipn_params = verify_vnpay_signature


def create_payment_url(
    *,
    amount_vnd,
    txn_ref,
    order_info,
    ip_addr,
    locale='vn',
):
    cfg = _cfg()
    tmn = (cfg.get('TMN_CODE') or '').strip()
    secret = _secret_raw(cfg)
    pay_url = (cfg.get('PAYMENT_URL') or '').strip() or 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'
    return_url = (cfg.get('RETURN_URL') or '').strip()
    ipn_url = (cfg.get('IPN_URL') or '').strip()

    if not (tmn and secret and return_url):
        return None, 'Chưa cấu hình settings.VNPAY (TMN_CODE, HASH_SECRET, RETURN_URL)'

    from django.utils import timezone

    create_date = timezone.localtime().strftime('%Y%m%d%H%M%S')
    amount = int(round(float(amount_vnd) * 100))
    if amount <= 0:
        return None, 'Số tiền không hợp lệ'

    data = {
        'vnp_Version': '2.1.0',
        'vnp_Command': 'pay',
        'vnp_TmnCode': tmn,
        'vnp_Amount': str(amount),
        'vnp_CurrCode': 'VND',
        'vnp_TxnRef': str(txn_ref)[:100],
        'vnp_OrderInfo': _order_info_ascii(order_info),
        'vnp_OrderType': 'other',
        'vnp_Locale': locale if locale in ('vn', 'en') else 'vn',
        'vnp_ReturnUrl': return_url,
        'vnp_CreateDate': create_date,
        'vnp_IpAddr': (ip_addr or '127.0.0.1')[:45],
    }
    if ipn_url:
        data['vnp_IpnUrl'] = ipn_url

    sign_data = _build_sign_string(data, frozenset({'vnp_SecureHash'}))
    data['vnp_SecureHash'] = _hmac_sha512_hex(secret, sign_data)

    qs = _payment_redirect_query(data)
    return f'{pay_url}?{qs}', None


def build_payment_url(*, amount_vnd, txn_ref, order_info, ip_addr, locale='vn'):
    return create_payment_url(
        amount_vnd=amount_vnd,
        txn_ref=txn_ref,
        order_info=order_info,
        ip_addr=ip_addr,
        locale=locale,
    )
