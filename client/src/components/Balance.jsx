import { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import './Balance.css';

function resolveName(field, memberMap) {
  if (!field) return '?';
  if (typeof field === 'object') return field.displayName || '?';
  return memberMap[field] || field;
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawBalanceChart(canvas, balances, memberMap, activeId, barsRef) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  if (cssWidth === 0 || cssHeight === 0 || balances.length === 0) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const rootStyles = getComputedStyle(document.documentElement);
  const colorGreen  = rootStyles.getPropertyValue('--green').trim()    || '#2e7d32';
  const colorRed    = rootStyles.getPropertyValue('--red').trim()      || '#c62828';
  const colorZero   = rootStyles.getPropertyValue('--text-3').trim()   || '#9aa0a6';
  const colorText   = rootStyles.getPropertyValue('--text-1').trim()   || '#1a1a1a';
  const colorHover  = rootStyles.getPropertyValue('--bg-hover').trim() || 'rgba(0,0,0,0.06)';
  const baseFont    = getComputedStyle(canvas).fontFamily || 'sans-serif';

  const rows = balances.map((b) => ({
    userId: b.userId,
    name: memberMap[b.userId] || b.userId,
    net: b.net,
  }));

  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.net)));

  const paddingX = 10;
  const paddingY = 6;
  const rowHeight = (cssHeight - paddingY * 2) / rows.length;
  const barThickness = Math.max(6, Math.min(16, rowHeight * 0.45));

  ctx.font = `500 12px ${baseFont}`;
  let nameWidth = 0;
  rows.forEach((r) => { nameWidth = Math.max(nameWidth, ctx.measureText(r.name).width); });
  nameWidth = Math.min(Math.max(nameWidth + 10, 46), cssWidth * 0.36);

  const barAreaX0 = paddingX + nameWidth;
  const barAreaWidth = Math.max(20, cssWidth - paddingX - barAreaX0);
  const midX = barAreaX0 + barAreaWidth / 2;
  const halfWidth = barAreaWidth / 2 - 4;

  const newBars = [];

  rows.forEach((r, i) => {
    const rowY0 = paddingY + i * rowHeight;
    const rowYCenter = rowY0 + rowHeight / 2;
    const barY = rowYCenter - barThickness / 2;

    // hover/tap-aren atzeko fondoa
    if (activeId === r.userId) {
      ctx.fillStyle = colorHover;
      ctx.fillRect(0, rowY0, cssWidth, rowHeight);
    }

    // Erdiko lerroa (Zero)
    ctx.strokeStyle = colorZero;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(midX, rowY0 + 2);
    ctx.lineTo(midX, rowY0 + rowHeight - 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Kidearen izena
    ctx.fillStyle = colorText;
    ctx.font = `500 12px ${baseFont}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    let label = r.name;
    while (label.length > 1 && ctx.measureText(label).width > nameWidth - 8) {
      label = label.slice(0, -1);
    }
    if (label !== r.name) label = `${label.slice(0, -1)}…`;
    ctx.fillText(label, paddingX, rowYCenter);

    // Barra (Balantzea)
    const ratio = Math.abs(r.net) / maxAbs;
    const length = ratio * halfWidth;
    let barX = midX;
    let drawWidth = 4;

    if (r.net > 0.01) {
      ctx.fillStyle = colorGreen;
      barX = midX;
      drawWidth = length;
    } else if (r.net < -0.01) {
      ctx.fillStyle = colorRed;
      barX = midX - length;
      drawWidth = length;
    } else {
      ctx.fillStyle = colorZero;
      barX = midX - 2;
      drawWidth = 4;
    }

    const radius = Math.min(4, barThickness / 2);
    drawRoundedRect(ctx, barX, barY, drawWidth, barThickness, radius);
    ctx.fill();

    // Talka-eremua
    newBars.push({
      x: 0,
      y: rowY0,
      width: cssWidth,
      height: rowHeight,
      userId: r.userId,
      name: r.name,
      net: r.net,
    });
  });

  barsRef.current = newBars;
}

export default function Balance({ groupId, members, version = 0 }) {
  const [balances, setBalances]     = useState([]);
  const [transfers, setTransfers]   = useState(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError]           = useState('');

  const [activeId, setActiveId] = useState(null);
  const [tooltip, setTooltip]   = useState(null);

  const canvasRef = useRef(null);
  const barsRef = useRef([]);
  const hasLoadedRef = useRef(false);

  // Mapeoa: ID -> Izena
  const memberMap = Object.fromEntries(members.map(m => [m._id, m.displayName]));

  useEffect(() => {
    let cancelled = false;

    if (hasLoadedRef.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setTransfers(null);

    api.get(`/expenses/group/${groupId}/balance`)
      .then(r => { if (!cancelled) setBalances(r.data); })
      .catch(console.error)
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setRefreshing(false);
        hasLoadedRef.current = true;
      });

    return () => { cancelled = true; };
  }, [groupId, version]);

  useEffect(() => {
    setActiveId(null);
    setTooltip(null);
  }, [balances]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function redraw() {
      drawBalanceChart(canvas, balances, memberMap, activeId, barsRef);
    }

    redraw();

    const observer = new ResizeObserver(redraw);
    observer.observe(canvas);

    return () => observer.disconnect();
  }, [balances, members, activeId]);

  function locateBar(e) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return barsRef.current.find(
      b => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
    ) || null;
  }

  function handlePointerMove(e) {
    const bar = locateBar(e);
    if (!bar) {
      setActiveId(null);
      setTooltip(null);
      return;
    }
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    setActiveId(bar.userId);
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      name: bar.name,
      net: bar.net,
    });
  }

  function handlePointerLeave() {
    setActiveId(null);
    setTooltip(null);
  }

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

  function renderMemberAvatar(field) {
    const id = typeof field === 'object' ? (field._id || field.id) : field;
    const found = members.find(m => m._id === id);
    const name = found ? found.displayName : (typeof field === 'object' ? field.displayName : field) || '?';
    
    if (found && found.photoURL) {
      return (
        <div className="bal-transfer-user">
          <img src={found.photoURL} alt={name} className="bal-transfer-avatar" />
          <span className="bal-transfer-name">{name}</span>
        </div>
      );
    }
    
    const initial = name.trim().charAt(0).toUpperCase() || '?';
    return (
      <div className="bal-transfer-user">
        <div className="bal-transfer-avatar-fallback">{initial}</div>
        <span className="bal-transfer-name">{name}</span>
      </div>
    );
  }

  if (loading) return <div className="bal-loading">Kargatzen…</div>;

  const allSettled = balances.length > 0 && balances.every(b => Math.abs(b.net) < 0.01);

  return (
    <div className="bal-container">
      <section className="bal-section">
        <h3>Balantzeak</h3>
        {balances.length === 0 ? (
          <p className="bal-empty">Oraindik ez dago gasturik.</p>
        ) : (
          <>
            <div className={`bal-chart-wrap${refreshing ? ' is-refreshing' : ''}`}>
              <canvas
                ref={canvasRef}
                className="bal-canvas"
                aria-hidden="true"
                onMouseMove={handlePointerMove}
                onMouseLeave={handlePointerLeave}
                onClick={handlePointerMove}
              />
              {tooltip && (
                <div className="bal-tooltip" style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}>
                  <span className="bal-tooltip-name">{tooltip.name}</span>
                  <span className={`bal-net ${tooltip.net > 0.01 ? 'positive' : tooltip.net < -0.01 ? 'negative' : 'zero'}`}>
                    {tooltip.net > 0.01 ? '+' : ''}{tooltip.net.toFixed(2)} €
                  </span>
                </div>
              )}
              <span className="bal-chart-status">Eguneratzen…</span>
            </div>

            <div className="bal-chart-legend">
              <span className="bal-legend-item">
                <span className="bal-legend-dot positive" /> Jasotzekoa
              </span>
              <span className="bal-legend-item">
                <span className="bal-legend-dot negative" /> Zorra
              </span>
            </div>

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
          </>
        )}
      </section>

      {/* Optimizazioa (Zorrak kitatu) */}
      <section className="bal-section">
        <h3>Zorrak kitatu</h3>
        {balances.length === 0 ? (
          <p className="bal-empty">Oraindik ez dago gasturik.</p>
        ) : allSettled ? (
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
            <ul className="bal-transfers">
              {transfers.map((t, i) => (
                <li key={i} className="bal-transfer">
                  <span className="bal-transfer-from">
                    {renderMemberAvatar(t.from)}
                  </span>
                  <span className="bal-transfer-flow-center">
                    <span className="bal-transfer-amount">{t.amount.toFixed(2)} €</span>
                    <span className="bal-transfer-arrow">➔</span>
                  </span>
                  <span className="bal-transfer-to">
                    {renderMemberAvatar(t.to)}
                  </span>
                </li>
              ))}
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