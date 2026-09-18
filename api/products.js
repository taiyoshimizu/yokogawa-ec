const QUALIT_BASE_URL = 'https://www.yrl-qualit.com';

function normalizeCodes(value) {
  const raw = Array.isArray(value) ? value.join(',') : String(value || '');
  return [...new Set(raw.split(',').map(v => v.trim()).filter(Boolean))]
    .filter(code => /^\d{12}$/.test(code))
    .slice(0, 100);
}

function setCors(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

function nowInJstString() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
}

const QUERY = `
query QualitBlogProducts($input: SearchProductRequest!) {
  searchProduct(input: $input) {
    products {
      systemCode
      customCode
      productName
      sellPrice
      quantity
      maxImageUrl
      minImageUrl
      tinyImageUrl
      display
      isSellStart
      isSellEnd
      isDisplayOutOfSellPeriod
      sellStartDateTime
      sellEndDateTime
      maker
      updatedAt
    }
    searchedCount
  }
}`;

module.exports = async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const endpoint = process.env.MAKESHOP_API_ENDPOINT;
  const token = process.env.MAKESHOP_API_TOKEN;
  const apiKey = process.env.MAKESHOP_API_KEY;

  if (!endpoint || !token || !apiKey) {
    res.status(503).json({
      error: 'MakeShop API is not configured',
      hint: 'Set MAKESHOP_API_ENDPOINT, MAKESHOP_API_TOKEN and MAKESHOP_API_KEY in the server environment.'
    });
    return;
  }

  const codes = normalizeCodes(req.query.codes);
  if (!codes.length) {
    res.status(400).json({
      error: 'No valid product codes',
      hint: 'Use ?codes=000000015488,000000013443'
    });
    return;
  }

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${token}`,
        'x-api-key': apiKey,
        'x-timestamp': String(Math.floor(Date.now() / 1000))
      },
      body: JSON.stringify({
        query: QUERY,
        variables: {
          input: {
            systemCodes: codes,
            page: 1,
            limit: codes.length
          }
        }
      })
    });

    const payload = await upstream.json();

    if (!upstream.ok || payload.errors) {
      res.status(502).json({
        error: 'MakeShop API request failed',
        status: upstream.status,
        details: payload.errors || payload
      });
      return;
    }

    const byCode = new Map(
      (payload.data?.searchProduct?.products || []).map(product => [product.systemCode, product])
    );
    const nowJst = nowInJstString();

    const products = codes.map(requestedCode => {
      const result = byCode.get(requestedCode);
      if (!result) {
        return {
          systemCode: requestedCode,
          found: false,
          available: false
        };
      }

      const hasStock = result.quantity === null || Number(result.quantity) > 0;
      const isPublic = result.display === 'Y';
      const beforeStart = result.isSellStart === 'Y' && result.sellStartDateTime && result.sellStartDateTime > nowJst;
      const afterEnd = result.isSellEnd === 'Y' && result.sellEndDateTime && result.sellEndDateTime < nowJst;
      const inSalePeriod = !beforeStart && !afterEnd;
      const available = Boolean(isPublic && hasStock && inSalePeriod);

      return {
        found: true,
        systemCode: result.systemCode,
        customCode: result.customCode,
        name: result.productName,
        price: result.sellPrice,
        quantity: result.quantity,
        image: result.maxImageUrl || result.minImageUrl || result.tinyImageUrl || null,
        maker: result.maker || null,
        display: result.display,
        isPublic,
        hasStock,
        inSalePeriod,
        available,
        sellStartDateTime: result.sellStartDateTime || null,
        sellEndDateTime: result.sellEndDateTime || null,
        updatedAt: result.updatedAt || null,
        url: `${QUALIT_BASE_URL}/shopdetail/${result.systemCode}/`
      };
    });

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ products, fetchedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({
      error: 'Unexpected server error',
      details: error instanceof Error ? error.message : String(error)
    });
  }
};
