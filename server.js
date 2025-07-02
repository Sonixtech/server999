const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000; // <-- Use Railway's provided port
const TMDB_API_KEY = process.env.TMDB_API_KEY || '1e2d76e7c45818ed61645cb647981e5c';

// === 1. Your original subjectId extractor ===
function extractSubjectId(html, movieTitle) {
  const regex = new RegExp(`"(\\d{16,})",\\s*"[^"]*",\\s*"${movieTitle.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}"`, 'i');
  const match = html.match(regex);
  return match ? match[1] : null;
}

// Improved detailPath extractor: finds "<slug>-..." before subjectId
function extractDetailPathFromHtml(html, subjectId, movieTitle) {
  // Generate slug from movie title (e.g., "The Amateur" -> "the-amateur-")
  const slug = movieTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '-';

  // Find the index of the subjectId in the HTML
  const idPattern = new RegExp(`"(${subjectId})"`);
  const idMatch = idPattern.exec(html);
  if (!idMatch) {
    console.log('❌ subjectId not found in HTML for detailPath extraction');
    return null;
  }
  // Get the substring before the subjectId
  const before = html.substring(0, idMatch.index);
  // Find the last occurrence of "<slug>..." before the subjectId
  const detailPathRegex = new RegExp(`"((?:${slug})[^"]+)"`, 'gi');
  let match, lastMatch = null;
  while ((match = detailPathRegex.exec(before)) !== null) {
    lastMatch = match[1];
  }
  if (lastMatch) {
    console.log('✅ detailPath found:', lastMatch);
    return lastMatch;
  }
  console.log('❌ detailPath not found for subjectId:', subjectId);
  return null;
}

// === MOVIE ROUTE ===
app.get('/movie/:tmdbId', async (req, res) => {
  const { tmdbId } = req.params;

  try {
    console.log('🔎 Fetching TMDb info for:', tmdbId);
    const tmdbResp = await axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`);
    const title = tmdbResp.data.title;
    const year = tmdbResp.data.release_date?.split('-')[0];
    console.log('🎬 Title:', title, '| Year:', year);

    const searchKeyword = `${title} ${year}`;
    const searchUrl = `https://moviebox.ng/web/searchResult?keyword=${encodeURIComponent(searchKeyword)}`;
    console.log('🌐 Search URL:', searchUrl);

    const searchResp = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    const html = searchResp.data;
    console.log('📄 HTML fetched, length:', html.length);

    const subjectId = extractSubjectId(html, title);
    console.log('🆔 subjectId:', subjectId);
    if (!subjectId) {
      return res.status(404).json({ error: '❌ subjectId not found in HTML' });
    }

    const detailPath = extractDetailPathFromHtml(html, subjectId, title);
    const detailsUrl = detailPath ? `https://moviebox.ng/movies/${detailPath}?id=${subjectId}` : null;
    console.log('📝 detailPath:', detailPath);
    console.log('🔗 detailsUrl:', detailsUrl);

    const downloadUrl = `https://moviebox.ng/wefeed-h5-bff/web/subject/download?subjectId=${subjectId}&se=0&ep=0`;
    console.log('⬇️ Download URL:', downloadUrl);

    const downloadResp = await axios.get(downloadUrl, {
      headers: {
        'accept': 'application/json',
        'user-agent': 'Mozilla/5.0',
        'x-client-info': JSON.stringify({ timezone: 'Africa/Lagos' }),
        'referer': detailsUrl // <-- Use detailsUrl as referer
      }
    });

    console.log('✅ Download data fetched');

    return res.json({
      title,
      year,
      subjectId,
      detailPath: detailPath || '❌ Not found',
      detailsUrl: detailsUrl || '❌ Not available',
      downloadData: downloadResp.data
    });

  } catch (err) {
    console.error('❌ Server error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// === TV SHOW ROUTE ===
app.get('/tv/:tmdbId/:season/:episode', async (req, res) => {
  const { tmdbId, season, episode } = req.params;

  try {
    console.log('🔎 Fetching TMDb TV info for:', tmdbId);
    const tmdbResp = await axios.get(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}`);
    const title = tmdbResp.data.name;
    const year = tmdbResp.data.first_air_date?.split('-')[0];
    console.log('📺 Title:', title, '| Year:', year);

    const searchKeyword = `${title} ${year}`;
    const searchUrl = `https://moviebox.ng/web/searchResult?keyword=${encodeURIComponent(searchKeyword)}`;
    console.log('🌐 Search URL:', searchUrl);

    const searchResp = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    const html = searchResp.data;
    console.log('📄 HTML fetched, length:', html.length);

    const subjectId = extractSubjectId(html, title);
    console.log('🆔 subjectId:', subjectId);
    if (!subjectId) {
      return res.status(404).json({ error: '❌ subjectId not found in HTML' });
    }

    const detailPath = extractDetailPathFromHtml(html, subjectId, title);
    const detailsUrl = detailPath ? `https://moviebox.ng/movies/${detailPath}?id=${subjectId}` : null;
    console.log('📝 detailPath:', detailPath);
    console.log('🔗 detailsUrl:', detailsUrl);

    const downloadUrl = `https://moviebox.ng/wefeed-h5-bff/web/subject/download?subjectId=${subjectId}&se=${season}&ep=${episode}`;
    console.log('⬇️ Download URL:', downloadUrl);

    const downloadResp = await axios.get(downloadUrl, {
      headers: {
        'accept': 'application/json',
        'user-agent': 'Mozilla/5.0',
        'x-client-info': JSON.stringify({ timezone: 'Africa/Lagos' }),
        'referer': detailsUrl // <-- Use detailsUrl as referer
      }
    });

    console.log('✅ Download data fetched');

    return res.json({
      title,
      year,
      subjectId,
      detailPath: detailPath || '❌ Not found',
      detailsUrl: detailsUrl || '❌ Not available',
      downloadData: downloadResp.data
    });

  } catch (err) {
    console.error('❌ Server error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Add at the top, after app initialization
app.get('/', (req, res) => {
  res.send('Server is running!');
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
