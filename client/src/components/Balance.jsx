import { useEffect, useState, useRef, useCallback } from 'react';
import api from '../services/api';
import './Balance.css';

// ─── Componente canvas: diagrama de barras horizontales ──────────────────────
function TransferChart({ transfers, memberMap }) {
  const canvasRef = useRef(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !transfers?.length) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Leemos las variables CSS del tema para que el canvas respete dark/light mode
    const style  = getComputedStyle(document.documentElement);
    const accent  = style.getPropertyValue('--accent').trim()   || '#7c6af7';
    const text1   = style.getPropertyValue('--text-1').trim()   || '#f0f0f0';
    const text2   = style.getPropertyValue('--text-2').trim()   || '#9a9aad';
    const bgHover = style.getPropertyValue('--bg-hover').trim() || '#1e1e2e';

    // Dimensiones lógicas
    const ROW_H    = 48;
    const PADDING  = { top: 12, right: 16, bottom: 12, left: 8 };
    const LABEL_W  = 130; // espacio reservado para "Nombre → Nombre"
    const AMT_W    = 64;  // espacio reservado para el importe
    const BAR_GAP  = 8;

    const logicalW = canvas.parentElement.clientWidth || 340;
    const logicalH = PADDING.top + transfers.length * ROW_H + PADDING.bottom;

    // Escalado HiDPI
    canvas.width  = logicalW * dpr;
    canvas.height = logicalH * dpr;
    canvas.style.width  = `${logicalW}px`;
    canvas.style.height = `${logicalH}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, logicalW, logicalH);

    const maxAmount = Math.max(...transfers.map(t => t.amount));
    const barMaxW   = logicalW - LABEL_W - AMT_W - PADDING.left - PADDING.right - BAR_GAP * 2;

    transfers.forEach((t, i) => {
      const y       = PADDING.top + i * ROW_H;
      const barW    = Math.max(4, (t.amount / maxAmount) * barMaxW);
      const barX    = PADDING.left + LABEL_W + BAR_GAP;
      const barY    = y + ROW_H * 0.25;
      const barH    = ROW_H * 0.5;
      const radius  = 4;

      const fromId = t.from && typeof t.from === 'object' ? t.from._id : t.from;
      const toId   = t.to && typeof t.to === 'object' ? t.to._id : t.to;

      const fromName = memberMap[fromId] || (t.from && typeof t.from === 'object' ? t.from.displayName : t.from);
      const toName   = memberMap[toId]   || (t.to && typeof t.to === 'object' ? t.to.displayName : t.to);

      // ── Barra redondeada ─────────────────────────────────────────────────
      ctx.beginPath();
      ctx.moveTo(barX + radius, barY);
      ctx.lineTo(barX + barW - radius, barY);
      ctx.quadraticCurveTo(barX + barW, barY, barX + barW, barY + radius);
      ctx.lineTo(barX + barW, barY + barH - radius);
      ctx.quadraticCurveTo(barX + barW, barY + barH, barX + barW - radius, barY + barH);
      ctx.lineTo(barX + radius, barY + barH);
      ctx.quadraticCurveTo(barX, barY + barH, barX, barY + barH - radius);
      ctx.lineTo(barX, barY + radius);
      ctx.quadraticCurveTo(barX, barY, barX + radius, barY);
      ctx.closePath();
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;

      // ── Etiqueta izquierda: "Nombre → Nombre" ────────────────────────────
      ctx.font = '500 12px system-ui, sans-serif';
      ctx.fillStyle = text1;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';

      const label = `${fromName} → ${toName}`;
      const maxLabelPx = LABEL_W - 8;
      let displayLabel = label;
      while (ctx.measureText(displayLabel).width > maxLabelPx && displayLabel.length > 4) {
        displayLabel = displayLabel.slice(0, -1);
      }
      if (displayLabel !== label) displayLabel += '…';

      ctx.fillText(displayLabel, PADDING.left, y + ROW_H / 2);

      // ── Importe a la derecha ─────────────────────────────────────────────
      ctx.font = '600 12px "DM Mono", monospace';
      ctx.fillStyle = accent;
      ctx.textAlign = 'right';
      ctx.fillText(`${t.amount.toFixed(2)} €`, logicalW - PADDING.right, y + ROW_H / 2);
    });
  }, [transfers, memberMap]);

  useEffect(() => {
    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="bal-canvas"
      aria-label="Transferentzien diagrama"
      role="img"
    />
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Balance({ groupId, members }) {
  const [balances, setBalances]     = useState([]);
  const [transfers, setTransfers]   = useState(null);
  const [loading, setLoading]       = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError]           = useState('');

  const memberMap = Object.fromEntries(members.map(m => [m._id, m.displayName]));

  useEffect(() => {
    api.get(`/expenses/group/${groupId}/balance`)
      .then(r => setBalances(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [groupId]);

  async function optimize() {
    setOptimizing(true);
    setError('');
    try {
      const { data } = await api.get(`/groups/${groupId}/optimize`);
      setTransfers(data.transfers);
    } catch (err) {
      setError('Ezin izan da optimizatu. Saiatu berriro.');
    } finally {
      setOptimizing(false);
    }
  }

  if (loading) return <div className="bal-loading">Kargatzen…</div>;

  const allSettled = balances.every(b => Math.abs(b.net) < 0.01);

  return (
    <div className="bal-container">

      {/* ── Balances netos ── */}
      <section className="bal-section">
        <h3>Saldo garbia</h3>
        {balances.length === 0 ? (
          <p className="bal-empty">Oraindik ez dago gasturik.</p>
        ) : (
          <ul className="bal-list">
            {balances.map(b => (
              <li key={b.userId} className="bal-item">
                <span className="bal-name">{memberMap[b.userId] || b.userId}</span>
                <span className={`bal-net ${b.net > 0.01 ? 'positive' : b.net < -0.01 ? 'negative' : 'zero'}`}>
                  {b.net > 0.01 ? '+' : ''}{b.net.toFixed(2)} €
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Optimización ── */}
      <section className="bal-section">
        <h3>Zorrak kitatu</h3>
        {allSettled ? (
          <p className="bal-settled">✓ Dena saldatuta dago.</p>
        ) : transfers === null ? (
          <>
            <p className="bal-hint">
              Kalkulatu transferentzia kopuru minimoa zorra kitatzeko.
            </p>
            <button className="btn-primary" onClick={optimize} disabled={optimizing}>
              {optimizing ? 'Optimizatzen…' : 'Optimizatu'}
            </button>
            {error && <p className="bal-error">{error}</p>}
          </>
        ) : transfers.length === 0 ? (
          <p className="bal-settled">✓ Dena saldatuta dago.</p>
        ) : (
          <>
            {/* Diagrama de barras canvas desactivado para unificar diseño visual idéntico a Preview */}
            {/* <TransferChart transfers={transfers} memberMap={memberMap} /> */}

            {/* ── Lista de texto (accesibilidad y detalle) ── */}
            <ul className="bal-transfers">
              {transfers.map((t, i) => {
                const fromId = t.from && typeof t.from === 'object' ? t.from._id : t.from;
                const toId   = t.to && typeof t.to === 'object' ? t.to._id : t.to;

                return (
                  <li key={i} className="bal-transfer">
                    <span className="bal-transfer-from">{memberMap[fromId] || (t.from && typeof t.from === 'object' ? t.from.displayName : t.from)}</span>
                    <span className="bal-transfer-arrow">→</span>
                    <span className="bal-transfer-to">{memberMap[toId] || (t.to && typeof t.to === 'object' ? t.to.displayName : t.to)}</span>
                    <span className="bal-transfer-amount">{t.amount.toFixed(2)} €</span>
                  </li>
                );
              })}
            </ul>
            <button className="btn-ghost bal-recalc" onClick={() => setTransfers(null)}>
              Berriro kalkulatu
            </button>
          </>
        )}
      </section>
    </div>
  );
}