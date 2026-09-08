import React, { useState, useEffect, useCallback, useRef } from 'react';

// --- CONFIGURACIÓN ---
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwVRISt9dGOt0lXWimGVCkH2jLmWKHL1h-CLNEBymE6Q9gp_WOeJzTTUh6cKjqynBms/exec';
const ITEMS_POR_PAGINA = 6;
const INTERVALO_DATOS_MS = 15000;
const INTERVALO_PAGINA_MS = 10000;

// --- COLORES DE ESTADO (umbrales) ---
const COLOR_PREOCUPANTE = '#cb2330';
const COLOR_KWF_OK = '#e3f565';
const COLOR_ENERGIA_OK = '#32817c';
const UMBRAL_KWF = 50;
const UMBRAL_CARGA_UPS = 80;
const UMBRAL_TEMP = 28;

const hexA = (hex, alpha) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const fmt = (valor, sufijo = '') => (valor === null || valor === undefined || valor === '' || isNaN(valor) ? '—' : `${valor}${sufijo}`);

const fmtPorcentaje = (valor) => {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (typeof valor === 'number') {
    let num = valor;
    if (num > 100) {
      let s_dig = String(Math.floor(num));
      if (s_dig.length >= 3) {
        num = Number(s_dig.slice(0, 2) + '.' + s_dig.slice(2));
      }
    }
    return `${num.toFixed(1)}%`;
  }
  try {
    let s = String(valor).trim().replace(/\s+/g, '');
    s = s.replace(/,/g, '.');
    const parts = s.split('.');
    if (parts.length > 2) {
      s = parts[0] + '.' + parts.slice(1).join('');
    }
    let num = Number(s);
    if (isNaN(num)) return '—';
    if (num > 100) {
      let s_dig = String(Math.floor(num));
      if (s_dig.length >= 3) {
        num = Number(s_dig.slice(0, 2) + '.' + s_dig.slice(2));
      }
    }
    return `${num.toFixed(1)}%`;
  } catch (e) {
    return '—';
  }
};

// --- HOOK: layout responsive ---
// Se basa SOLO en el ancho de ventana (igual que los breakpoints sm/lg de Tailwind
// del diseño original), no en la orientación. Así un celular en landscape (ancho
// típico ~700-900px) no se confunde con una TV real (ancho >=1024px).
const useResponsiveLayout = () => {
  const calcular = () => {
    if (typeof window === 'undefined') return { ancho: 1200, columnas: 3, esPantallaGrande: true };
    const ancho = window.innerWidth;
    let columnas = 2;
    if (ancho >= 640) columnas = 3; // tablet / celular horizontal / TV
    const esPantallaGrande = ancho >= 1024; // TV o desktop: layout fijo sin scroll de página
    return { ancho, columnas, esPantallaGrande };
  };
  const [layout, setLayout] = useState(calcular);
  useEffect(() => {
    const onResize = () => setLayout(calcular());
    // En navegadores viejos (TV/celular) el ancho a veces se lee ANTES de que
    // termine la rotación física de pantalla. Se vuelve a medir con un pequeño
    // delay tras el evento de orientación para evitar quedarse con el valor viejo.
    const onOrientationChange = () => {
      onResize();
      setTimeout(onResize, 150);
      setTimeout(onResize, 400);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onOrientationChange);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onOrientationChange);
    };
  }, []);
  return layout;
};

// --- MODAL DINÁMICO DE DETALLE ---
const ModalDetalle = ({ config, onClose }) => {
  const { sala, metrica } = config;
  if (!sala || !metrica) return null;

  let titulo = '';
  let contenido = null;

  if (metrica === 'temperatura') {
    titulo = `Temperaturas - ${sala.nombre}`;
    contenido = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {(!sala.equipos || sala.equipos.length === 0) ? (
          <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '16px' }}>No hay equipos registrados.</p>
        ) : (
          sala.equipos.map((eq, i) => (
            <div key={i} style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', borderRadius: '10px', padding: '10px 14px', border: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', color: '#e2e8f0' }}>{eq.nombre || 'Equipo'}</span>
              <span style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '14px' }}>{fmt(eq.temperatura, '°C')}</span>
            </div>
          ))
        )}
      </div>
    );
  } else if (metrica === 'humedad') {
    titulo = `Humedad - ${sala.nombre}`;
    contenido = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {(!sala.equipos || sala.equipos.length === 0) ? (
          <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '16px' }}>No hay equipos registrados.</p>
        ) : (
          sala.equipos.map((eq, i) => (
            <div key={i} style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', borderRadius: '10px', padding: '10px 14px', border: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', color: '#e2e8f0' }}>{eq.nombre || 'Equipo'}</span>
              <span style={{ color: '#22d3ee', fontWeight: 'bold', fontSize: '14px' }}>{fmt(eq.humedad, '%')}</span>
            </div>
          ))
        )}
      </div>
    );
  } else if (metrica === 'kwf') {
    titulo = `Estado de Circuitos KWF - ${sala.nombre}`;
    contenido = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {(!sala.detalleKwf || sala.detalleKwf.length === 0) ? (
          <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '16px' }}>No hay detalle de circuitos registrado.</p>
        ) : (
          sala.detalleKwf.map((eq, i) => (
            <div key={i} style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', borderRadius: '10px', padding: '10px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(30, 41, 59, 0.8)', paddingBottom: '6px' }}>
                <span style={{ fontWeight: 'bold', color: '#e2e8f0' }}>{sala.nombre} - {eq.equipo}</span>
                <span style={{ fontSize: '11px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', backgroundColor: eq.val === 1 ? 'rgba(6, 78, 59, 0.5)' : eq.val === 0.5 ? 'rgba(120, 53, 15, 0.5)' : 'rgba(127, 29, 29, 0.5)', color: eq.val === 1 ? '#34d399' : eq.val === 0.5 ? '#fbbf24' : '#f87171' }}>
                  {eq.val * 100}% Op.
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1, backgroundColor: '#020617', padding: '8px', borderRadius: '6px', border: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Circuito 1</span>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: eq.c1 === 'OK' ? '#34d399' : eq.c1 === 'NOK' ? '#f87171' : '#94a3b8' }}>{eq.c1}</span>
                </div>
                <div style={{ flex: 1, backgroundColor: '#020617', padding: '8px', borderRadius: '6px', border: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Circuito 2</span>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: eq.c2 === 'OK' ? '#34d399' : eq.c2 === 'NOK' ? '#f87171' : '#94a3b8' }}>{eq.c2}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    );
  } else if (metrica === 'cargati') {
    titulo = `Detalle Carga TI - ${sala.nombre}`;
    contenido = (
      <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', borderRadius: '10px', padding: '16px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '8px' }}>
          <span style={{ color: '#94a3b8' }}>Capacidad Total TI (Máx TI)</span>
          <span style={{ color: '#e2e8f0', fontWeight: 'bold' }}>{fmt(sala.maxTi, ' kW')}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '8px' }}>
          <span style={{ color: '#94a3b8' }}>Carga TI Actual</span>
          <span style={{ color: '#fb923c', fontWeight: 'bold' }}>{fmt(sala.cargaTiKw, ' kW')}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#94a3b8' }}>Porcentaje de Carga</span>
          <span style={{ color: '#fbbf24', fontWeight: 'bold', backgroundColor: 'rgba(124, 45, 18, 0.3)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(194, 65, 12, 0.5)' }}>
            {fmtPorcentaje(sala.cargaTi)}
          </span>
        </div>
      </div>
    );
  } else if (metrica === 'energia') {
    titulo = `Detalle UPS - ${sala.equipo}`;
    contenido = (
      <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', borderRadius: '10px', padding: '16px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '8px' }}>
          <span style={{ color: '#94a3b8' }}>KVA Inicio</span>
          <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{fmt(sala.kvaInicio)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '8px' }}>
          <span style={{ color: '#94a3b8' }}>KW Término</span>
          <span style={{ color: '#818cf8', fontWeight: 'bold' }}>{fmt(sala.kvaTermino)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#94a3b8' }}>Porcentaje Carga</span>
          <span style={{ color: '#34d399', fontWeight: 'bold', backgroundColor: 'rgba(6, 78, 59, 0.3)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(4, 120, 87, 0.5)' }}>
            {fmtPorcentaje(sala.porcentajeCarga)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 50 }} onClick={onClose}>
      <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '14px', width: '100%', maxWidth: '420px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid #1e293b' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#f8fafc', margin: 0 }}>{titulo}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '20px', fontWeight: 'bold', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '16px' }}>{contenido}</div>
      </div>
    </div>
  );
};

// --- MODAL DE NOVEDADES ---
const ModalNovedades = ({ novedades, onClose, columnaUnica }) => {
  if (!novedades) return null;
  const novClima = novedades.filter(n => (n.area || '').toLowerCase().includes('clima'));
  const novEnergia = novedades.filter(n => (n.area || '').toLowerCase().includes('energia') || (n.area || '').toLowerCase().includes('energía'));
  const novOtras = novedades.filter(n => {
    const a = (n.area || '').toLowerCase();
    return !a.includes('clima') && !a.includes('energia') && !a.includes('energía');
  });

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 50 }} onClick={onClose}>
      <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '14px', width: '100%', maxWidth: '800px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', color: '#e2e8f0' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid #1e293b' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#22d3ee', margin: 0 }}>Novedades y Observaciones de Operación</h3>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Registro reciente clasificado por área</p>
          </div>
          <button onClick={onClose} style={{ background: '#020617', border: '1px solid #1e293b', color: '#64748b', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', padding: '4px 10px', borderRadius: '6px' }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'grid', gridTemplateColumns: columnaUnica ? '1fr' : '1fr 1fr', gap: '16px' }}>
          <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)', padding: '12px', borderRadius: '10px', border: '1px solid #1e293b' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: '#60a5fa', marginBottom: '8px', borderBottom: '1px solid rgba(59, 130, 246, 0.3)', paddingBottom: '6px', margin: '0 0 8px 0' }}>Clima ({novClima.length})</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
              {novClima.length === 0 ? <p style={{ color: '#64748b', fontSize: '11px', textAlign: 'center' }}>Sin novedades en Clima.</p> : novClima.map((n, i) => (
                <div key={i} style={{ backgroundColor: '#020617', padding: '8px', borderRadius: '6px', border: '1px solid #1e293b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8' }}>
                    <span>Sala: <strong>{n.sala || '—'}</strong></span>
                    <span style={{ color: '#22d3ee' }}>{n.fecha}</span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#cbd5e1', margin: '4px 0 0 0' }}>{n.observacion}</p>
                </div>
              ))}
            </div>
          </div>
          <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)', padding: '12px', borderRadius: '10px', border: '1px solid #1e293b' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: '#fbbf24', marginBottom: '8px', borderBottom: '1px solid rgba(245, 158, 11, 0.3)', paddingBottom: '6px', margin: '0 0 8px 0' }}>Energía ({novEnergia.length})</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
              {novEnergia.length === 0 ? <p style={{ color: '#64748b', fontSize: '11px', textAlign: 'center' }}>Sin novedades en Energía.</p> : novEnergia.map((n, i) => (
                <div key={i} style={{ backgroundColor: '#020617', padding: '8px', borderRadius: '6px', border: '1px solid #1e293b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8' }}>
                    <span>Sala: <strong>{n.sala || '—'}</strong></span>
                    <span style={{ color: '#22d3ee' }}>{n.fecha}</span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#cbd5e1', margin: '4px 0 0 0' }}>{n.observacion}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        {novOtras.length > 0 && (
          <div style={{ padding: '0 16px 16px 16px' }}>
            <p style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Otras áreas / General:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '128px', overflowY: 'auto' }}>
              {novOtras.map((n, i) => (
                <div key={i} style={{ backgroundColor: '#020617', border: '1px solid #1e293b', padding: '6px', borderRadius: '4px', fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
                  <span><strong>{n.area || 'General'}</strong> - {n.sala}: {n.observacion}</span>
                  <span style={{ color: '#22d3ee' }}>{n.fecha}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- TARJETA CLIMA (altura flexible, ya no fija en 142px) ---
const TarjetaClima = ({ datos, onClickMetrica }) => {
  if (!datos) return <div style={{ height: '100%', width: '100%' }}></div>;

  const pctKwf = datos.porcentajeOperativo;
  const hayDatoKwf = pctKwf !== undefined && pctKwf !== null;
  const kwfCritico = hayDatoKwf && pctKwf < UMBRAL_KWF;
  const colorKwf = hayDatoKwf ? (kwfCritico ? COLOR_PREOCUPANTE : COLOR_KWF_OK) : null;

  const temp = datos.temperatura;
  const hayDatoTemp = temp !== undefined && temp !== null;
  const tempCritica = hayDatoTemp && temp >= UMBRAL_TEMP;

  return (
    <div style={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155', borderTop: '2px solid #94a3b8', padding: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', width: '100%', minHeight: 0, boxSizing: 'border-box', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '4px', flexShrink: 0 }}>
        <h2 style={{ fontSize: '12px', fontWeight: 'bold', color: '#f8fafc', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '55%' }}>{datos.nombre || 'Sala'}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
          <span style={{ fontSize: '8px', color: '#94a3b8', backgroundColor: '#020617', padding: '1px 4px', borderRadius: '4px', border: '1px solid #1e293b', whiteSpace: 'nowrap' }}>Max KWF: {fmt(datos.maxKwf)}</span>
          <span style={{ fontSize: '8px', color: '#94a3b8', backgroundColor: '#020617', padding: '1px 4px', borderRadius: '4px', border: '1px solid #1e293b', whiteSpace: 'nowrap' }}>Max TI: {fmt(datos.maxTi)}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '6px', flex: 1, minHeight: 0, marginTop: '6px' }}>
        <button
          onClick={() => onClickMetrica(datos, 'temperatura')}
          style={{ backgroundColor: tempCritica ? hexA(COLOR_PREOCUPANTE, 0.2) : 'rgba(30, 58, 138, 0.3)', border: `1px solid ${tempCritica ? hexA(COLOR_PREOCUPANTE, 0.6) : 'rgba(30, 58, 138, 0.6)'}`, borderRadius: '8px', padding: '4px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', minHeight: 0 }}
        >
          <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>T°</span>
          <span style={{ fontSize: '15px', fontWeight: 'bold', color: tempCritica ? COLOR_PREOCUPANTE : '#38bdf8' }}>{fmt(temp, '°C')}</span>
        </button>

        <button
          onClick={() => onClickMetrica(datos, 'humedad')}
          style={{ backgroundColor: 'rgba(8, 51, 68, 0.3)', border: '1px solid rgba(14, 116, 144, 0.5)', borderRadius: '8px', padding: '4px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', minHeight: 0 }}
        >
          <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>H%</span>
          <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#22d3ee' }}>{fmt(datos.humedad, '%')}</span>
        </button>

        <button
          onClick={() => onClickMetrica(datos, 'kwf')}
          style={{ backgroundColor: colorKwf ? hexA(colorKwf, 0.18) : 'rgba(59, 7, 100, 0.3)', border: `1px solid ${colorKwf ? hexA(colorKwf, 0.55) : 'rgba(88, 28, 135, 0.5)'}`, borderRadius: '8px', padding: '4px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', minHeight: 0 }}
        >
          <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>KWF</span>
          <span style={{ fontSize: '15px', fontWeight: 'bold', color: colorKwf || '#c084fc' }}>{fmt(datos.kw)}</span>
          {hayDatoKwf && <span style={{ fontSize: '7px', fontWeight: 'bold', color: hexA(colorKwf, 0.85) }}>{fmtPorcentaje(pctKwf)} Op.</span>}
        </button>

        <button
          onClick={() => onClickMetrica(datos, 'cargati')}
          style={{ backgroundColor: 'rgba(124, 45, 18, 0.3)', border: '1px solid rgba(194, 65, 12, 0.5)', borderRadius: '8px', padding: '4px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', minHeight: 0 }}
        >
          <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Carga TI</span>
          <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#fb923c' }}>{fmt(datos.cargaTiKw)}</span>
          {datos.cargaTi !== undefined && datos.cargaTi !== null && (
            <span style={{ fontSize: '7px', fontWeight: 'bold', color: '#fed7aa' }}>{fmtPorcentaje(datos.cargaTi)}</span>
          )}
        </button>
      </div>
    </div>
  );
};

// --- TARJETA CHILLER ---
const TarjetaChiller = ({ datos }) => {
  if (!datos) return <div style={{ height: '100%', width: '100%' }}></div>;
  const statusList = datos.statusCompresores || [];

  return (
    <div style={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155', borderTop: '2px solid #94a3b8', padding: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', width: '100%', minHeight: 0, boxSizing: 'border-box', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '4px', flexShrink: 0 }}>
        <h2 style={{ fontSize: '12px', fontWeight: 'bold', color: '#f8fafc', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '50%' }}>{datos.equipo || 'Chiller'}</h2>
        <div style={{ fontSize: '9px', color: '#94a3b8', backgroundColor: '#020617', padding: '1px 4px', borderRadius: '4px', border: '1px solid #1e293b', display: 'flex', gap: '2px' }}>
          <span>Comp:</span>
          {statusList.length > 0 ? statusList.map((st, idx) => (
            <span key={idx} style={{ fontWeight: 'bold', color: '#cbd5e1' }}>[{st || '—'}]</span>
          )) : <span>—</span>}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', flex: 1, minHeight: 0, marginTop: '6px' }}>
        <div style={{ backgroundColor: 'rgba(19, 78, 74, 0.3)', border: '1px solid rgba(15, 118, 110, 0.5)', borderRadius: '8px', padding: '4px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 0 }}>
          <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>T° Surtidor</span>
          <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#2dd4bf' }}>{fmt(datos.tempSurtidor, '°C')}</span>
        </div>
        <div style={{ backgroundColor: 'rgba(12, 74, 110, 0.3)', border: '1px solid rgba(3, 105, 161, 0.5)', borderRadius: '8px', padding: '4px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 0 }}>
          <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>T° Retorno</span>
          <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#38bdf8' }}>{fmt(datos.tempRetorno, '°C')}</span>
        </div>
      </div>
    </div>
  );
};

// --- TARJETA ENERGÍA ---
const TarjetaEnergia = ({ datos, onClickMetrica }) => {
  if (!datos) return <div style={{ height: '100%', width: '100%' }}></div>;

  const pctCarga = datos.porcentajeCarga;
  const hayDatoCarga = pctCarga !== undefined && pctCarga !== null;
  const cargaCritica = hayDatoCarga && pctCarga >= UMBRAL_CARGA_UPS;
  const colorCarga = hayDatoCarga ? (cargaCritica ? COLOR_PREOCUPANTE : COLOR_ENERGIA_OK) : null;

  return (
    <div style={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155', borderTop: '2px solid #f59e0b', padding: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', width: '100%', minHeight: 0, boxSizing: 'border-box', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '4px', flexShrink: 0 }}>
        <h2 style={{ fontSize: '12px', fontWeight: 'bold', color: '#f8fafc', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '55%' }}>{datos.equipo || 'UPS'}</h2>
        <span style={{ fontSize: '9px', color: '#94a3b8', backgroundColor: '#020617', padding: '1px 4px', borderRadius: '4px', border: '1px solid #1e293b', whiteSpace: 'nowrap' }}>
          KVA: <strong style={{ color: '#fde047' }}>{fmt(datos.kvaInicio)}</strong>
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', flex: 1, minHeight: 0, marginTop: '6px' }}>
        <button
          onClick={() => onClickMetrica(datos, 'energia')}
          style={{ backgroundColor: 'rgba(49, 46, 129, 0.3)', border: '1px solid rgba(67, 56, 202, 0.5)', borderRadius: '8px', padding: '4px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', minHeight: 0 }}
        >
          <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>KW</span>
          <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#818cf8' }}>{fmt(datos.kvaTermino)}</span>
        </button>

        <button
          onClick={() => onClickMetrica(datos, 'energia')}
          style={{
            backgroundColor: colorCarga ? hexA(colorCarga, 0.18) : 'rgba(2, 44, 34, 0.3)',
            border: `1px solid ${colorCarga ? hexA(colorCarga, 0.55) : 'rgba(6, 78, 59, 0.5)'}`,
            borderRadius: '8px', padding: '4px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', minHeight: 0
          }}
        >
          <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>% Carga</span>
          <span style={{ fontSize: '15px', fontWeight: 'bold', color: colorCarga || '#34d399' }}>{fmtPorcentaje(pctCarga)}</span>
        </button>
      </div>
    </div>
  );
};

// --- VISTA PRINCIPAL ---
const IcetelProgramaVista = () => {
  const [datosClima, setDatosClima] = useState([]);
  const [datosEnergia, setDatosEnergia] = useState([]);
  const [novedades, setNovedades] = useState([]);
  const [paginaActual, setPaginaActual] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [modalConfig, setModalConfig] = useState({ sala: null, metrica: null });
  const [mostrarNovedades, setMostrarNovedades] = useState(false);

  const intervaloRef = useRef(null);
  const { columnas, esPantallaGrande } = useResponsiveLayout();

  // --- VIEWPORT: siempre tamaño real, sin zoom artificial ---
  // Se probó alejar el zoom para la TV (width=1200, initial-scale reducido) pero
  // se veía todo muy chico. Ahora se deja fijo en tamaño real; el layout se
  // adapta con CSS (columnas, tamaños de fuente) en vez de "engañar" al navegador
  // con un viewport falso.
  useEffect(() => {
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      document.head.appendChild(viewport);
    }
    viewport.setAttribute("content", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no");
  }, []);

  const cargarDatos = useCallback(async () => {
    try {
      const res = await fetch(GAS_URL);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Error desconocido');

      const salas = json.salas || [];
      let chillers = json.chillers || [];
      chillers.sort((a, b) => (a.equipo || '').localeCompare(b.equipo || ''));

      const indiceInicioPanel3 = ITEMS_POR_PAGINA * 2;
      let salasModificadas = [...salas];
      while (salasModificadas.length < indiceInicioPanel3) {
        salasModificadas.push(null);
      }

      const salasPanel1y2 = salasModificadas.slice(0, indiceInicioPanel3);
      const salasRestantes = salasModificadas.slice(indiceInicioPanel3);
      const climaCombinado = [...salasPanel1y2, ...chillers, ...salasRestantes];

      setDatosClima(climaCombinado);
      setDatosEnergia(json.energia || json.ups || []);
      setNovedades(json.novedades || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
    const intervaloDatos = setInterval(cargarDatos, INTERVALO_DATOS_MS);
    return () => clearInterval(intervaloDatos);
  }, [cargarDatos]);

  const totalPaginas = Math.max(1, Math.ceil(Math.max(datosClima.length, datosEnergia.length) / ITEMS_POR_PAGINA));

  useEffect(() => {
    if (paginaActual >= totalPaginas) setPaginaActual(0);
  }, [totalPaginas, paginaActual]);

  const reiniciarRotacion = useCallback(() => {
    if (intervaloRef.current) clearInterval(intervaloRef.current);
    if (totalPaginas <= 1) return;
    intervaloRef.current = setInterval(() => {
      setPaginaActual((p) => (p + 1) % totalPaginas);
    }, INTERVALO_PAGINA_MS);
  }, [totalPaginas]);

  useEffect(() => {
    reiniciarRotacion();
    return () => { if (intervaloRef.current) clearInterval(intervaloRef.current); };
  }, [reiniciarRotacion]);

  // --- NAVEGACIÓN POR TECLADO (restaurada, útil para control remoto de TV) ---
  useEffect(() => {
    const manejarTeclado = (ev) => {
      if (totalPaginas <= 1) return;
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') {
        ev.preventDefault();
        setPaginaActual((p) => (p + 1) % totalPaginas);
        reiniciarRotacion();
      } else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        setPaginaActual((p) => (p - 1 + totalPaginas) % totalPaginas);
        reiniciarRotacion();
      }
    };
    window.addEventListener('keydown', manejarTeclado);
    return () => window.removeEventListener('keydown', manejarTeclado);
  }, [totalPaginas, reiniciarRotacion]);

  const indiceInicio = paginaActual * ITEMS_POR_PAGINA;
  const indiceFin = indiceInicio + ITEMS_POR_PAGINA;
  const climaEnPantalla = datosClima.slice(indiceInicio, indiceFin);
  const energiaEnPantalla = datosEnergia.slice(indiceInicio, indiceFin);

  const gridColsCss = `repeat(${columnas}, 1fr)`;
  // TV (pantalla grande): 2 filas fijas, todo visible sin scroll (así funciona la
  // rotación automática de páginas). En cualquier pantalla más chica (celular
  // vertical u horizontal, tablet): filas automáticas que crecen con el
  // contenido, y el contenedor scrollea si no entra todo.
  const gridRowsCss = esPantallaGrande ? 'repeat(2, 1fr)' : undefined;
  const gridAutoRowsCss = esPantallaGrande ? undefined : '150px';

  return (
    <div style={{
      width: '100%',
      height: '100dvh',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
      backgroundColor: '#020617',
      padding: esPantallaGrande ? '14px' : '10px',
      boxSizing: 'border-box',
      color: '#f1f5f9',
      fontFamily: 'sans-serif',
      display: 'flex',
      flexDirection: 'column'
    }}>

      {/* HEADER */}
      <div style={{ display: 'flex', flexDirection: esPantallaGrande ? 'row' : 'column', justifyContent: 'space-between', alignItems: esPantallaGrande ? 'center' : 'flex-start', gap: '8px', marginBottom: '10px', borderBottom: '1px solid #1e293b', paddingBottom: '8px', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: esPantallaGrande ? '18px' : '16px', fontWeight: 'bold', margin: 0 }}>Icetel Visualización</h1>
          <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>
            {cargando ? 'Cargando...' : `Panel ${paginaActual + 1} de ${totalPaginas} (Rotación 10s)`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => setMostrarNovedades(true)}
            style={{ backgroundColor: '#06b6d4', color: '#020617', fontWeight: 'bold', padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px' }}
          >
            Novedades ({novedades.length})
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{ backgroundColor: '#0f172a', padding: '6px 10px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '11px', fontWeight: 'bold', color: error ? '#ef4444' : '#10b981', cursor: 'pointer' }}
          >
            {error ? 'Error de conexión' : 'EN LÍNEA'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: '8px', backgroundColor: 'rgba(127, 29, 29, 0.4)', border: '1px solid #991b1b', color: '#f87171', fontSize: '12px', padding: '6px', borderRadius: '4px', flexShrink: 0 }}>
          Error: {error}
        </div>
      )}

      {/* CONTENEDOR PRINCIPAL: columna apilada en pantallas chicas, fila en TV */}
      <div style={{
        display: 'flex',
        flexDirection: esPantallaGrande ? 'row' : 'column',
        gap: esPantallaGrande ? '16px' : '18px',
        flex: esPantallaGrande ? 1 : undefined,
        minHeight: esPantallaGrande ? 0 : undefined,
        width: '100%'
      }}>

        {/* COLUMNA CLIMA */}
        <div style={{ flex: esPantallaGrande ? 1 : undefined, display: 'flex', flexDirection: 'column', minHeight: esPantallaGrande ? 0 : undefined }}>
          <h2 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', color: '#cbd5e1', borderBottom: '2px solid #334155', paddingBottom: '4px', margin: '0 0 8px 0', flexShrink: 0 }}>
            Clima
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: gridColsCss, gridTemplateRows: gridRowsCss, gridAutoRows: gridAutoRowsCss, gap: '8px', flex: esPantallaGrande ? 1 : undefined, minHeight: esPantallaGrande ? 0 : undefined }}>
            {climaEnPantalla.map((item, i) => {
              if (!item) return <div key={`empty-${i}`}></div>;
              if (item.tipo === 'chiller') {
                return <TarjetaChiller key={item.id || `chiller-${i}`} datos={item} />;
              }
              return (
                <TarjetaClima
                  key={item.id || `sala-${i}`}
                  datos={item}
                  onClickMetrica={(sala, metrica) => setModalConfig({ sala, metrica })}
                />
              );
            })}
          </div>
        </div>

        {/* DIVISORIA: vertical en TV, horizontal apilado en pantallas chicas */}
        <div style={esPantallaGrande
          ? { width: '2px', backgroundColor: '#1e293b', borderRadius: '2px', flexShrink: 0 }
          : { height: '2px', backgroundColor: '#1e293b', borderRadius: '2px', flexShrink: 0 }}
        ></div>

        {/* COLUMNA ENERGÍA */}
        <div style={{ flex: esPantallaGrande ? 1 : undefined, display: 'flex', flexDirection: 'column', minHeight: esPantallaGrande ? 0 : undefined }}>
          <h2 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', color: '#fbbf24', borderBottom: '2px solid #92400e', paddingBottom: '4px', margin: '0 0 8px 0', flexShrink: 0 }}>
            Energía
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: gridColsCss, gridTemplateRows: gridRowsCss, gridAutoRows: gridAutoRowsCss, gap: '8px', flex: esPantallaGrande ? 1 : undefined, minHeight: esPantallaGrande ? 0 : undefined }}>
            {energiaEnPantalla.map((ups, i) => {
              if (!ups) return <div key={`empty-ups-${i}`}></div>;
              return (
                <TarjetaEnergia
                  key={ups.id || `ups-${i}`}
                  datos={ups}
                  onClickMetrica={(sala, metrica) => setModalConfig({ sala, metrica })}
                />
              );
            })}
          </div>
        </div>

      </div>

      <ModalDetalle config={modalConfig} onClose={() => setModalConfig({ sala: null, metrica: null })} />
      {mostrarNovedades && <ModalNovedades novedades={novedades} onClose={() => setMostrarNovedades(false)} columnaUnica={!esPantallaGrande && columnas < 3} />}
    </div>
  );
};

export default IcetelProgramaVista;
