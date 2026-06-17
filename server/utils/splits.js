// Aukeratutako banaketa-motaren arabera, splits array-a kalkulatu.
function calculateSplits(totalAmount, splitType, participants) {
  if (!participants || participants.length === 0) {
    throw new Error('Debe haber al menos un participante');
  }

  switch (splitType) {
    case 'equal': {
      const share = totalAmount / participants.length;
      const rounded = parseFloat((share).toFixed(2));
      const splits = participants.map((p) => ({ user: p.user, amount: rounded }));
      const diff = parseFloat((totalAmount - rounded * participants.length).toFixed(2));
      splits[0].amount = parseFloat((splits[0].amount + diff).toFixed(2));
      return splits;
    }

    case 'percentage': {
      const totalPct = participants.reduce((s, p) => s + (p.value || 0), 0);
      if (Math.abs(totalPct - 100) > 0.01) {
        throw new Error(`Ehunekoen batura 100 izan behar da (${totalPct} da)`);
      }
      const splits = participants.map((p) => ({
        user: p.user,
        amount: parseFloat(((p.value / 100) * totalAmount).toFixed(2)),
      }));
      const computed = splits.reduce((s, sp) => s + sp.amount, 0);
      splits[splits.length - 1].amount = parseFloat(
        (splits[splits.length - 1].amount + (totalAmount - computed)).toFixed(2)
      );
      return splits;
    }

    case 'exact': {
      const totalExact = participants.reduce((s, p) => s + (p.value || 0), 0);
      if (Math.abs(totalExact - totalAmount) > 0.01) {
        throw new Error(
          `Kopuruen batura ${totalAmount}€ izan behar da (${totalExact}€ da)`
        );
      }
      return participants.map((p) => ({
        user: p.user,
        amount: parseFloat((p.value).toFixed(2)),
      }));
    }

    default:
      throw new Error(`splitType ezezaguna: ${splitType}`);
  }
}

module.exports = { calculateSplits };