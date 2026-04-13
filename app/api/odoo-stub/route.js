import { NextResponse } from 'next/server';

// Stub API route — montre où brancher Odoo en prod.
// En démo, retourne simplement { ok: true }.
//
// En prod, remplacer par un appel XML-RPC vers Odoo :
//
//   const auth = await fetch(`${process.env.ODOO_URL}/xmlrpc/2/common`, { ... });
//   const result = await fetch(`${process.env.ODOO_URL}/xmlrpc/2/object`, {
//     method: 'POST',
//     body: buildXmlRpc('execute_kw', [db, uid, apiKey, 'sale.order', 'create', [{...}]])
//   });
//
// Ou via l'API REST Odoo 17+ :
//   POST ${ODOO_URL}/api/v1/sale.order
//
// Endpoints à implémenter :
//   POST /api/bookings      -> crée un devis/commande Odoo
//   POST /api/giftcards     -> crée une carte cadeau dans loyalty.card (ou product voucher)
//   POST /api/send-email    -> envoie confirmation via Nodemailer/Resend

export async function POST(req) {
  const body = await req.json();
  console.log('[odoo-stub] received:', body);
  return NextResponse.json({
    ok: true,
    message: 'Stub — brancher Odoo ici en prod',
    odooEnv: {
      ODOO_URL: process.env.ODOO_URL || 'non configuré',
      ODOO_DB: process.env.ODOO_DB || 'non configuré',
    },
    received: body,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoints: [
      'POST /api/odoo-stub — demo',
      'POST /api/bookings — à implémenter (Odoo sale.order)',
      'POST /api/giftcards — à implémenter (Odoo loyalty.card)',
    ],
  });
}
