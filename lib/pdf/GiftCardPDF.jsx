import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const PINK = '#e8005a';
const PURPLE = '#7b00e0';
const BLACK = '#0a0a0a';
const WHITE = '#ffffff';
const GRAY = '#888888';

const styles = StyleSheet.create({
  page: {
    padding: 0,
    fontFamily: 'Helvetica',
    backgroundColor: BLACK,
    color: WHITE,
  },
  bg: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: BLACK,
  },
  topBar: {
    height: 8,
    backgroundColor: PINK,
  },
  inner: { padding: 50 },
  brand: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 32,
    letterSpacing: 3,
    color: WHITE,
  },
  brandSub: {
    fontSize: 9,
    color: GRAY,
    marginTop: 4,
    letterSpacing: 1,
  },
  title: {
    marginTop: 50,
    fontFamily: 'Helvetica-Bold',
    fontSize: 42,
    color: PINK,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 14,
    color: WHITE,
    marginTop: 8,
    letterSpacing: 1,
  },
  amountBox: {
    marginTop: 40,
    padding: 30,
    backgroundColor: '#1a1a1a',
    borderLeft: `4pt solid ${PINK}`,
  },
  amountLabel: {
    fontSize: 9,
    color: GRAY,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  amount: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 56,
    color: PINK,
    marginTop: 4,
  },
  codeBox: {
    marginTop: 30,
    padding: 20,
    backgroundColor: '#1a1a1a',
    border: `1pt dashed ${PINK}`,
  },
  codeLabel: {
    fontSize: 9,
    color: GRAY,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  code: {
    fontFamily: 'Courier-Bold',
    fontSize: 28,
    color: WHITE,
    marginTop: 6,
    letterSpacing: 3,
  },
  msgBox: {
    marginTop: 30,
    padding: 18,
    backgroundColor: '#141414',
    border: `0.5pt solid #2a2a2a`,
  },
  msgFrom: {
    fontSize: 9,
    color: GRAY,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  msgText: {
    fontSize: 12,
    color: WHITE,
    fontStyle: 'italic',
    lineHeight: 1.5,
  },
  howto: {
    marginTop: 30,
    fontSize: 10,
    color: GRAY,
    lineHeight: 1.6,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    paddingTop: 12,
    borderTop: `0.5pt solid #2a2a2a`,
    fontSize: 8,
    color: GRAY,
    textAlign: 'center',
  },
});

export default function GiftCardPDF({ giftcard, company }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.bg} />
        <View style={styles.topBar} />
        <View style={styles.inner}>
          <Text style={styles.brand}>MULTIWEX</Text>
          <Text style={styles.brandSub}>FUN · INDOOR · GALAXY</Text>

          <Text style={styles.title}>CARTE CADEAU</Text>
          <Text style={styles.subtitle}>
            Pour : {giftcard.toName || 'Bénéficiaire'}
          </Text>

          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>Montant</Text>
            <Text style={styles.amount}>{Number(giftcard.amount).toFixed(2)} €</Text>
          </View>

          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>Code à utiliser</Text>
            <Text style={styles.code}>{giftcard.code}</Text>
          </View>

          {giftcard.message && (
            <View style={styles.msgBox}>
              <Text style={styles.msgFrom}>De {giftcard.fromName || 'Anonyme'}</Text>
              <Text style={styles.msgText}>« {giftcard.message} »</Text>
            </View>
          )}

          <Text style={styles.howto}>
            Comment l'utiliser ? Réservez sur {company?.website || 'multiwex.be'} et entrez votre code{'\n'}
            au moment du paiement. Valable sur toutes nos activités.
          </Text>
        </View>

        <Text style={styles.footer} fixed>
          {company?.legalName || 'MULTIWEX SRL'} · {company?.addressStreet} · {company?.addressZip} {company?.addressCity} · BCE {company?.bce}
        </Text>
      </Page>
    </Document>
  );
}
