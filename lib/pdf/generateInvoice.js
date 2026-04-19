// Server-side PDF generation. Doit être appelé depuis une API route Node.js.
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import InvoicePDF from './InvoicePDF';

export async function generateInvoicePDF(invoice) {
  const buffer = await renderToBuffer(React.createElement(InvoicePDF, { invoice }));
  return buffer;
}

// Récupère et incrémente le prochain numéro de facture (atomic via Supabase)
export async function getNextInvoiceNumber(supabase, prefix = 'MWX-2026-') {
  // Lit la valeur actuelle
  const { data } = await supabase
    .from('site_config')
    .select('value')
    .eq('key', 'invoice.next_number')
    .maybeSingle();
  const current = data?.value ? parseInt(data.value, 10) : 1;
  const nextValue = current + 1;
  const numberStr = String(current).padStart(4, '0');
  // Update atomique
  await supabase
    .from('site_config')
    .upsert(
      { key: 'invoice.next_number', value: nextValue, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
  return `${prefix}${numberStr}`;
}
