import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Couleurs Multiwex
const PINK = '#e8005a';
const BLACK = '#0a0a0a';
const GRAY = '#666666';
const BORDER = '#e5e5e5';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: BLACK,
    backgroundColor: '#ffffff',
  },
  // Bandeau haut couleur Multiwex
  topBar: {
    height: 6,
    backgroundColor: PINK,
    marginHorizontal: -40,
    marginTop: -40,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headerLeft: { flex: 1 },
  headerRight: { textAlign: 'right' },
  brandName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 24,
    color: BLACK,
    letterSpacing: 1.5,
  },
  brandSub: {
    fontSize: 8,
    color: GRAY,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  invoiceTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 18,
    color: PINK,
    letterSpacing: 1,
  },
  invoiceMeta: { fontSize: 9, color: GRAY, marginTop: 4 },
  // Blocs entreprise / client côte à côte
  blocksRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  block: {
    flex: 1,
    border: `1pt solid ${BORDER}`,
    padding: 12,
  },
  blockLabel: {
    fontSize: 8,
    color: GRAY,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  blockName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    marginBottom: 4,
  },
  blockLine: { fontSize: 9, color: BLACK, marginBottom: 2 },
  // Tableau items
  table: { marginTop: 8, marginBottom: 16 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: BLACK,
    color: '#ffffff',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottom: `0.5pt solid ${BORDER}`,
  },
  th: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  td: { fontSize: 9 },
  colDesc: { flex: 3 },
  colDate: { flex: 1.4 },
  colQty: { flex: 0.6, textAlign: 'right' },
  colUnit: { flex: 0.9, textAlign: 'right' },
  colTotal: { flex: 1, textAlign: 'right' },
  // Totaux
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  totalsBox: { width: 220 },
  totalsLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    fontSize: 10,
  },
  totalsLineFinal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    backgroundColor: BLACK,
    color: '#ffffff',
    paddingHorizontal: 8,
    marginTop: 4,
  },
  totalsLabel: { color: GRAY, fontSize: 10 },
  totalsValue: { fontFamily: 'Helvetica-Bold', fontSize: 10 },
  totalFinalLabel: { color: '#ffffff', fontFamily: 'Helvetica-Bold', fontSize: 12 },
  totalFinalValue: { color: PINK, fontFamily: 'Helvetica-Bold', fontSize: 14 },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    paddingTop: 10,
    borderTop: `0.5pt solid ${BORDER}`,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: GRAY, lineHeight: 1.4 },
  footerRight: { fontSize: 7, color: GRAY, textAlign: 'right' },
  // Mention légale
  legal: {
    marginTop: 12,
    fontSize: 8,
    color: GRAY,
    fontStyle: 'italic',
  },
});

function fmtMoney(n) {
  return `${(Number(n) || 0).toFixed(2)} €`;
}
function fmtDate(d) {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function InvoicePDF({ invoice }) {
  const {
    number,           // ex: "MWX-2026-0001"
    issueDate,        // Date d'émission
    booking,          // { reference, date, items, customer, total, subtotal, discount, paymentMethod }
    company,          // { legalName, bce, tva, addressStreet, addressZip, addressCity, addressCountry, iban, bic, website, email, phone }
    tvaRate = 21,     // %
    cgvUrl,
    footerLegal,
  } = invoice;

  const customer = booking.customer || {};
  const items = booking.items || [];
  const totalTTC = Number(booking.total || 0);
  const totalHT = totalTTC / (1 + tvaRate / 100);
  const tvaAmount = totalTTC - totalHT;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topBar} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.brandName}>MULTIWEX</Text>
            <Text style={styles.brandSub}>FUN · INDOOR · GALAXY</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.invoiceTitle}>FACTURE</Text>
            <Text style={styles.invoiceMeta}>N° {number}</Text>
            <Text style={styles.invoiceMeta}>Émise le {fmtDate(issueDate)}</Text>
            <Text style={styles.invoiceMeta}>Réservation : {booking.reference || booking.id}</Text>
          </View>
        </View>

        {/* Blocs Émetteur / Client */}
        <View style={styles.blocksRow}>
          <View style={styles.block}>
            <Text style={styles.blockLabel}>Émetteur</Text>
            <Text style={styles.blockName}>{company.legalName}</Text>
            <Text style={styles.blockLine}>{company.addressStreet}</Text>
            <Text style={styles.blockLine}>{company.addressZip} {company.addressCity}</Text>
            <Text style={styles.blockLine}>{company.addressCountry}</Text>
            <Text style={styles.blockLine}>BCE : {company.bce}</Text>
            {company.tva && company.tva !== company.bce && (
              <Text style={styles.blockLine}>TVA : {company.tva}</Text>
            )}
            {company.email && <Text style={styles.blockLine}>{company.email}</Text>}
            {company.phone && <Text style={styles.blockLine}>{company.phone}</Text>}
          </View>

          <View style={styles.block}>
            <Text style={styles.blockLabel}>Facturé à</Text>
            <Text style={styles.blockName}>
              {customer.companyName || customer.name || 'Client'}
            </Text>
            {customer.companyName && customer.name && (
              <Text style={styles.blockLine}>{customer.name}</Text>
            )}
            {customer.address && <Text style={styles.blockLine}>{customer.address}</Text>}
            {customer.email && <Text style={styles.blockLine}>{customer.email}</Text>}
            {customer.phone && <Text style={styles.blockLine}>{customer.phone}</Text>}
            {customer.vatNumber && (
              <Text style={styles.blockLine}>TVA : {customer.vatNumber}</Text>
            )}
          </View>
        </View>

        {/* Tableau items */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.colDesc]}>Description</Text>
            <Text style={[styles.th, styles.colDate]}>Date / Heure</Text>
            <Text style={[styles.th, styles.colQty]}>Qté</Text>
            <Text style={[styles.th, styles.colUnit]}>P.U.</Text>
            <Text style={[styles.th, styles.colTotal]}>Total</Text>
          </View>
          {items.map((it, idx) => (
            <View key={idx} style={styles.tableRow} wrap={false}>
              <View style={styles.colDesc}>
                <Text style={[styles.td, { fontFamily: 'Helvetica-Bold' }]}>
                  {it.activityName || it.activityId}
                </Text>
                {it.roomName && (
                  <Text style={[styles.td, { color: GRAY, fontSize: 8 }]}>{it.roomName}</Text>
                )}
              </View>
              <Text style={[styles.td, styles.colDate]}>
                {fmtDate(it.slotDate || booking.date)}{'\n'}
                <Text style={{ color: GRAY, fontSize: 8 }}>
                  {it.start}–{it.end}
                </Text>
              </Text>
              <Text style={[styles.td, styles.colQty]}>{it.players}</Text>
              <Text style={[styles.td, styles.colUnit]}>{fmtMoney(it.unit)}</Text>
              <Text style={[styles.td, styles.colTotal, { fontFamily: 'Helvetica-Bold' }]}>
                {fmtMoney(it.total)}
              </Text>
            </View>
          ))}
        </View>

        {/* Totaux */}
        <View style={styles.totalsRow}>
          <View style={styles.totalsBox}>
            <View style={styles.totalsLine}>
              <Text style={styles.totalsLabel}>Sous-total HT</Text>
              <Text style={styles.totalsValue}>{fmtMoney(totalHT)}</Text>
            </View>
            <View style={styles.totalsLine}>
              <Text style={styles.totalsLabel}>TVA ({tvaRate}%)</Text>
              <Text style={styles.totalsValue}>{fmtMoney(tvaAmount)}</Text>
            </View>
            {booking.discount > 0 && (
              <View style={styles.totalsLine}>
                <Text style={styles.totalsLabel}>Remise</Text>
                <Text style={styles.totalsValue}>−{fmtMoney(booking.discount)}</Text>
              </View>
            )}
            <View style={styles.totalsLineFinal}>
              <Text style={styles.totalFinalLabel}>TOTAL TTC</Text>
              <Text style={styles.totalFinalValue}>{fmtMoney(totalTTC)}</Text>
            </View>
            {booking.paid && (
              <View style={[styles.totalsLine, { marginTop: 6 }]}>
                <Text style={[styles.totalsLabel, { color: '#16a34a' }]}>✓ Payée</Text>
                <Text style={[styles.totalsValue, { color: '#16a34a', fontSize: 9 }]}>
                  {booking.paymentMethod || 'Réglée'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Mention légale */}
        {footerLegal && <Text style={styles.legal}>{footerLegal}</Text>}

        {/* Footer fixe en bas */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {company.legalName} · BCE {company.bce}{'\n'}
            {company.addressStreet}, {company.addressZip} {company.addressCity}
          </Text>
          <Text style={styles.footerRight}>
            {company.iban && `IBAN : ${company.iban}\n`}
            {cgvUrl && `CGV : ${cgvUrl}`}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
