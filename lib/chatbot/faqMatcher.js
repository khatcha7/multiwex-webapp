// Matching d'une question utilisateur contre la FAQ.
// 3 niveaux de matching, par ordre de priorité :
// 1. Exact match (question identique normalisée)
// 2. Keyword match (tous les keywords présents dans la question)
// 3. Fuzzy match (au moins 1 keyword présent + score similarité)

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^\w\s]/g, ' ') // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s) {
  return normalize(s).split(' ').filter((t) => t.length > 1);
}

export function matchFAQ(question, faqs) {
  if (!question || !faqs || faqs.length === 0) return null;
  const normQ = normalize(question);
  const qTokens = new Set(tokens(question));
  if (qTokens.size === 0) return null;

  // 1. Exact match (sur la question complète normalisée)
  for (const f of faqs) {
    if (!f.enabled) continue;
    if (normalize(f.question) === normQ) return { faq: f, source: 'exact', score: 1 };
  }

  // 2. Keyword score : nb de keywords FAQ présents dans la question
  let best = null;
  for (const f of faqs) {
    if (!f.enabled) continue;
    const kws = (f.keywords || []).map(normalize).filter(Boolean);
    if (kws.length === 0) continue;
    let hits = 0;
    for (const kw of kws) {
      // un keyword peut être multi-word ("carte cadeau") → check si la phrase normQ le contient
      if (normQ.includes(kw)) hits++;
    }
    const score = hits / kws.length;
    if (score > 0 && (!best || score > best.score)) {
      best = { faq: f, source: 'keyword', score };
    }
  }
  if (best && best.score >= 0.5) return best; // au moins la moitié des keywords matchent

  // 3. Fuzzy : au moins 1 keyword match + bonus si question similaire
  for (const f of faqs) {
    if (!f.enabled) continue;
    const fqTokens = new Set(tokens(f.question));
    let common = 0;
    for (const t of qTokens) if (fqTokens.has(t)) common++;
    const score = common / Math.max(fqTokens.size, 1);
    if (score >= 0.4 && (!best || score > best.score * 0.8)) {
      best = { faq: f, source: 'fuzzy', score };
    }
  }

  return best && best.score >= 0.3 ? best : null;
}
