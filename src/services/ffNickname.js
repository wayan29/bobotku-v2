const axios = require('axios');

async function inquireViaGoPay(userId) {
  const url = `https://gopay.co.id/games/v1/order/prepare/FREEFIRE?userId=${encodeURIComponent(userId)}&zoneId=`;
  try {
    const { data, status } = await axios.get(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000,
    });
    if (status === 200 && String(data?.message).toLowerCase() === 'success' && typeof data?.data === 'string') {
      return { isSuccess: true, nickname: data.data, message: 'Nickname found via GoPay', rawResponse: data };
    }
    return { isSuccess: false, message: data?.message || 'Invalid User ID or unknown error', rawResponse: data };
  } catch (err) {
    return { isSuccess: false, message: `GoPay error: ${err.message}` };
  }
}

async function inquireFFNickname(userId) {
  const codashopUrl = 'https://order-sg.codashop.com/initPayment.action';
  const datePart = new Date().toLocaleDateString('en-CA');
  const nonce = `${datePart.replace(/-/g, '/')}-${Math.floor(Math.random() * 1000)}`;

  const postData = {
    'voucherPricePoint.id': 8120,
    'voucherPricePoint.price': 50000.0,
    'voucherPricePoint.variablePrice': 0,
    'n': nonce,
    'email': '',
    'userVariablePrice': 0,
    'order.data.profile': 'eyJuYW1lIjoiICIsImRhdGVvZmJpcnRoIjoiIiwiaWRfbm8iOiIifQ==',
    'user.userId': userId,
    'user.zoneId': '',
    'msisdn': '',
    'voucherTypeName': 'FREEFIRE',
    'shopLang': 'id_ID',
    'voucherTypeId': 17,
    'gvtId': 33,
    'checkoutId': '',
    'affiliateTrackingId': '',
    'impactClickId': '',
    'anonymousId': ''
  };

  try {
    const { data, status } = await axios.post(codashopUrl, postData, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://www.codashop.com',
        'Referer': 'https://www.codashop.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 10000,
    });

    if (status !== 200) {
      return inquireViaGoPay(userId);
    }

    if (data?.RESULT_CODE === '10001' || data?.resultCode === '10001') {
      return { isSuccess: false, message: 'Too many attempts. Please wait and try again.', rawResponse: data };
    }

    if (data?.success && !data?.errorMsg) {
      let extracted = undefined;
      if (data.result && typeof data.result === 'string') {
        try {
          const decoded = decodeURIComponent(data.result);
          const parsed = JSON.parse(decoded);
          if (parsed?.roles?.[0]?.role) extracted = decodeURIComponent(parsed.roles[0].role);
          else if (parsed?.username) extracted = decodeURIComponent(parsed.username);
        } catch {}
      }
      if (!extracted && data?.confirmationFields?.roles?.[0]?.role) {
        extracted = decodeURIComponent(data.confirmationFields.roles[0].role);
      }
      if (!extracted && data?.confirmationFields?.username) {
        extracted = decodeURIComponent(data.confirmationFields.username);
      }
      if (extracted) {
        return { isSuccess: true, nickname: extracted, message: 'Nickname found via Codashop', rawResponse: data };
      }
      // fallback if no nickname in success body
      return inquireViaGoPay(userId);
    }
    // on error, try fallback
    if (data?.errorMsg) return { isSuccess: false, message: data.errorMsg, rawResponse: data };
    return inquireViaGoPay(userId);
  } catch (err) {
    // network/client error -> fallback
    return inquireViaGoPay(userId);
  }
}

module.exports = { inquireFFNickname };

