/**
 * Calcula el array de splits a partir del tipo de reparto elegido.
 *
 * @param {number}   totalAmount  - Importe total del gasto
 * @param {string}   splitType    - 'equal' | 'percentage' | 'exact'
 * @param {Array}    participants - Array de { user: ObjectId, value?: number }
 *   · equal      → value ignorado; se reparte a partes iguales
 *   · percentage → value es el porcentaje (ej: 33.33); deben sumar 100
 *   · exact      → value es la cantidad exacta; deben sumar totalAmount
 *
 * @returns {Array} splits - Array de { user, amount } listo para guardar
 */
function calculateSplits(totalAmount, splitType, participants) {
  if (!participants || participants.length === 0) {
    throw new Error('Debe haber al menos un participante');
  }

  switch (splitType) {
    case 'equal': {
      const share = totalAmount / participants.length;
      // Repartimos y ajustamos el último céntimo al primer participante
      const rounded = parseFloat((share).toFixed(2));
      const splits = participants.map((p) => ({ user: p.user, amount: rounded }));
      // Corregimos posible diferencia por redondeo
      const diff = parseFloat((totalAmount - rounded * participants.length).toFixed(2));
      splits[0].amount = parseFloat((splits[0].amount + diff).toFixed(2));
      return splits;
    }

    case 'percentage': {
      const totalPct = participants.reduce((s, p) => s + (p.value || 0), 0);
      if (Math.abs(totalPct - 100) > 0.01) {
        throw new Error(`Los porcentajes deben sumar 100 (suman ${totalPct})`);
      }
      const splits = participants.map((p) => ({
        user: p.user,
        amount: parseFloat(((p.value / 100) * totalAmount).toFixed(2)),
      }));
      // Ajuste de redondeo en el último participante
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
          `Las cantidades exactas deben sumar ${totalAmount} (suman ${totalExact})`
        );
      }
      return participants.map((p) => ({
        user: p.user,
        amount: parseFloat((p.value).toFixed(2)),
      }));
    }

    default:
      throw new Error(`splitType desconocido: ${splitType}`);
  }
}

module.exports = { calculateSplits };
