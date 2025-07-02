const axios = require('axios');

function extractSubjectId(html, movieTitle) {
  const regex = new RegExp(`"(\\d{16,})",\\s*"[^"]*",\\s*"${movieTitle.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}"`, 'i');
  const match = html.match(regex);
  return match ? match[1] : null;
}

function extractDetailPathFromHtml(html, subjectId, movieTitle) {
  const slug = movieTitle
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    + '-';

  const idPattern = new RegExp(`"(${subjectId})"`);
  const idMatch = idPattern.exec(html);
  if (!idMatch) return null;
  const before = html.substring(0, idMatch.index);
  const detailPathRegex = new RegExp(`"((?:${slug})[^"]+)"`, 'gi');
  let match, lastMatch = null;
  while ((match = detailPathRegex.exec(before)) !== null) {
    lastMatch = match[1];
  }
  return lastMatch;
}

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const tmdbId = params.tmdbId;
  const TMDB_API_KEY = process.env.TMDB_API_KEY || '1e2d76e7c45818ed61645cb647981e5c';

  if (!tmdbId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing tmdbId' })
    };
  }

  try {
    const tmdbResp = await axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`);
    const title = tmdbResp.data.title;
    const year = tmdbResp.data.release_date?.split('-')[0];

    const searchKeyword = `${title} ${year}`;
    const searchUrl = `https://moviebox.ng/web/searchResult?keyword=${encodeURIComponent(searchKeyword)}`;

    const searchResp = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    const html = searchResp.data;

    const subjectId = extractSubjectId(html, title);
    if (!subjectId) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: '❌ subjectId not found in HTML' })
      };
    }

    const detailPath = extractDetailPathFromHtml(html, subjectId, title);
    const detailsUrl = detailPath ? `https://moviebox.ng/movies/${detailPath}?id=${subjectId}` : null;

    const downloadUrl = `https://moviebox.ng/wefeed-h5-bff/web/subject/download?subjectId=${subjectId}&se=0&ep=0`;

    const downloadResp = await axios.get(downloadUrl, {
      headers: {
        'accept': 'application/json',
        'accept-encoding': 'gzip, deflate, br, zstd',
        'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        'referer': detailsUrl,
        'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        'x-client-info': '{"timezone":"Africa/Lagos"}',
        'cookie': [
          '_ga=GA1.1.2113914.1736365446',
          'account=6328836939160473392|0|H5|1744461404|',
          '_ym_uid=1744461405935706898',
          '_ym_d=1744461405',
          'i18n_lang=en',
          '_ga_LF2XQTEPMF=GS2.1.s1751456194$o64$g1$t1751456489$j37$l0$h0'
        ].join('; ')
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        title,
        year,
        subjectId,
        detailPath: detailPath || '❌ Not found',
        detailsUrl: detailsUrl || '❌ Not available',
        downloadData: downloadResp.data
      })
    };

  } catch (err) {
    console.error('❌ Server error:', err.message, '| Stack:', err.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};