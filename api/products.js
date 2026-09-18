const QUALIT_URL = 'https://www.yrl-qualit.com/';

function stripTags(value = '') {
  return value
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function absoluteUrl(value = '') {
  try {
    return new URL(value, QUALIT_URL).toString();
  } catch {
    return value;
  }
}

function canonicalProductUrl(value = '') {
  try {
    const u = new URL(value, QUALIT_URL);
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch {
    return value;
  }
}

function getSection(html, startMarker, endMarker) {
  const start = html.indexOf(startMarker);
  if (start === -1) return '';
  const end = endMarker ? html.indexOf(endMarker, start + startMarker.length) : -1;
  return end === -1 ? html.slice(start) : html.slice(start, end);
}

function parseSection(sectionHtml, type) {
  const results = [];
  // Qualit/MakeShop の商品カードは、商品画像リンクの直後に商品名・価格が続く。
  const imageLink = /<a\s+[^>]*href=["']([^"']*\/shopdetail\/(\d{12})[^"']*)["'][^>]*>\s*<img\s+([^>]*?)>/gim;
  let match;

  while ((match = imageLink.exec(sectionHtml))) {
    const [full, href, systemCode, imgAttrs] = match;
    const srcMatch = imgAttrs.match(/\bsrc=["']([^"']+)["']/i);
    const altMatch = imgAttrs.match(/\balt=["']([^"']*)["']/i);
    const from = match.index + full.length;
    const nearby = sectionHtml.slice(from, from + 2200);
    const priceMatch = nearby.match(/([0-9][0-9,]*)\s*円\s*[（(]税込[）)]/i);

    const name = stripTags(altMatch ? altMatch[1] : '');
    const price = priceMatch ? Number(priceMatch[1].replace(/,/g, '')) : null;

    if (!name || !systemCode) continue;
    if (results.some(p => p.systemCode === systemCode)) continue;

    results.push({
      type,
      systemCode,
      name,
      price,
      image: absoluteUrl(srcMatch ? srcMatch[1] : ''),
      url: canonicalProductUrl(href)
    });
  }

  return results;
}

module.exports = async function handler(req, res) {
  try {
    const response = await fetch(QUALIT_URL, {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; QualitBlogPoC/1.0; +https://vercel.com/)'
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      return res.status(502).json({
        ok: false,
        error: `Qualitの公開ページ取得に失敗しました (HTTP ${response.status})`
      });
    }

    const buf = await response.arrayBuffer();
    // Qualit は EUC-JP を宣言しているため、UTF-8 として読まず明示的にデコードする。
    const html = new TextDecoder('euc-jp').decode(buf);

    const newSection = getSection(
      html,
      '<div class="section" id="r_new">',
      '<div class="section" id="r_recommend">'
    );
    const recommendSection = getSection(
      html,
      '<div class="section" id="r_recommend">',
      '</div><!--rightContents_left-->'
    );

    const newProducts = parseSection(newSection, 'new');
    const recommendProducts = parseSection(recommendSection, 'recommend');
    const products = [...newProducts, ...recommendProducts]
      .filter((p, i, arr) => arr.findIndex(x => x.systemCode === p.systemCode) === i);

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      ok: true,
      source: 'public-html',
      sourceUrl: QUALIT_URL,
      fetchedAt: new Date().toISOString(),
      count: products.length,
      newCount: newProducts.length,
      recommendCount: recommendProducts.length,
      products
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error && error.message ? error.message : 'Unknown error'
    });
  }
};
