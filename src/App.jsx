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
// El modo "desktop/TV" (Clima y Energía lado a lado) se activa por
// ORIENTACIÓN (ancho > alto = landscape), no por un umbral de ancho fijo. Así
// un celular acostado (aunque tenga solo ~740-900px de ancho) también imita el
// layout de escritorio, igual que una TV real.
const useResponsiveLayout = () => {
  const calcular = () => {
    if (typeof window === 'undefined') return { ancho: 1200, columnas: 3, esPantallaGrande: true };
    const ancho = window.innerWidth;
    const alto = window.innerHeight;
    const esLandscape = ancho > alto;
    const columnas = (esLandscape || ancho >= 640) ? 3 : 2;
    const esPantallaGrande = esLandscape; // landscape = layout lado a lado tipo desktop/TV
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

// --- HOOK: calcular el alto DISPONIBLE para un contenedor, en px ---
// Se usa para el alto de las tarjetas de Clima/Energía en vez de porcentajes
// CSS o de `flex: 1`. Motivo: en este WebView viejo `flex-grow` no calcula
// bien el alto disponible en columnas anidadas — el contenedor de tarjetas
// quedaba con altura basada en su propio contenido en vez de crecer para
// llenar el espacio libre.
//
// Un primer intento midió `clientHeight` del propio contenedor y usó ese
// valor para fijarle una altura a sus tarjetas. Eso creó un bucle de
// retroalimentación: al fijar una altura, el contenedor cambiaba de tamaño,
// lo que disparaba una nueva medición con un valor distinto (más chico), que
// volvía a fijar una altura menor, y así en bucle — por eso las tarjetas
// empezaban ocupando media pantalla y se iban encogiendo.
//
// La solución es medir algo que NO dependa de la altura que le vamos a
// asignar al contenedor: su posición `top` real en la pantalla (que solo
// depende de lo que hay ARRIBA, no de su propio alto) y restarla a la altura
// de la ventana. Ese resultado nunca se retroalimenta con nuestra propia
// asignación de altura.
const useAlturaDisponible = (margenInferior) => {
  const ref = useRef(null);
  const [altura, setAltura] = useState(0);
  useEffect(() => {
    let activo = true;
    const medir = () => {
      if (!activo || !ref.current) return;
      const top = ref.current.getBoundingClientRect().top;
      const disponible = Math.max(0, window.innerHeight - top - margenInferior);
      setAltura((prev) => (Math.abs(prev - disponible) > 1 ? disponible : prev));
    };
    medir();
    window.addEventListener('resize', medir);
    window.addEventListener('orientationchange', medir);
    let observer = null;
    // Observamos el documento completo (viewport), NUNCA el propio
    // contenedor: observar el propio contenedor es lo que causaba el bucle
    // de retroalimentación descrito arriba.
    if (typeof window !== 'undefined' && typeof window.ResizeObserver !== 'undefined') {
      observer = new window.ResizeObserver(medir);
      observer.observe(document.documentElement);
    }
    // Sondeo periódico de respaldo: algunos WebViews viejos no tienen
    // ResizeObserver o no disparan resize/orientationchange de forma
    // confiable. Es barato y garantiza que la altura termine siendo correcta.
    const intervalo = setInterval(medir, 1000);
    return () => {
      activo = false;
      window.removeEventListener('resize', medir);
      window.removeEventListener('orientationchange', medir);
      if (observer) observer.disconnect();
      clearInterval(intervalo);
    };
  }, [margenInferior]);
  return [ref, altura];
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
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 50 }} onClick={onClose}>
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
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 50 }} onClick={onClose}>
      <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '14px', width: '100%', maxWidth: '800px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', color: '#e2e8f0' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid #1e293b' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#22d3ee', margin: 0 }}>Novedades y Observaciones de Operación</h3>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Registro reciente clasificado por área</p>
          </div>
          <button onClick={onClose} style={{ background: '#020617', border: '1px solid #1e293b', color: '#64748b', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', padding: '4px 10px', borderRadius: '6px' }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: columnaUnica ? 'column' : 'row', gap: '16px' }}>
          <div style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', padding: '12px', borderRadius: '10px', border: '1px solid #1e293b' }}>
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
          <div style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', padding: '12px', borderRadius: '10px', border: '1px solid #1e293b' }}>
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
    <div style={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155', borderTop: '2px solid #94a3b8', padding: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', width: '100%', minHeight: 0, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '4px', flexShrink: 0 }}>
        <h2 style={{ fontSize: '12px', fontWeight: 'bold', color: '#f8fafc', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '55%' }}>{datos.nombre || 'Sala'}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
          <span style={{ fontSize: '8px', color: '#94a3b8', backgroundColor: '#020617', padding: '1px 4px', borderRadius: '4px', border: '1px solid #1e293b', whiteSpace: 'nowrap' }}>Max KWF: {fmt(datos.maxKwf)}</span>
          <span style={{ fontSize: '8px', color: '#94a3b8', backgroundColor: '#020617', padding: '1px 4px', borderRadius: '4px', border: '1px solid #1e293b', whiteSpace: 'nowrap' }}>Max TI: {fmt(datos.maxTi)}</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', flex: 1, minHeight: 0, marginTop: '6px' }}>
        <button
          onClick={() => onClickMetrica(datos, 'temperatura')}
          style={{ width: 'calc(50% - 3px)', height: 'calc(50% - 3px)', backgroundColor: tempCritica ? hexA(COLOR_PREOCUPANTE, 0.2) : 'rgba(30, 58, 138, 0.3)', border: `1px solid ${tempCritica ? hexA(COLOR_PREOCUPANTE, 0.6) : 'rgba(30, 58, 138, 0.6)'}`, borderRadius: '8px', padding: '4px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', minHeight: 0, boxSizing: 'border-box' }}
        >
          <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>T°</span>
          <span style={{ fontSize: '15px', fontWeight: 'bold', color: tempCritica ? COLOR_PREOCUPANTE : '#38bdf8' }}>{fmt(temp, '°C')}</span>
        </button>

        <button
          onClick={() => onClickMetrica(datos, 'humedad')}
          style={{ width: 'calc(50% - 3px)', height: 'calc(50% - 3px)', backgroundColor: 'rgba(8, 51, 68, 0.3)', border: '1px solid rgba(14, 116, 144, 0.5)', borderRadius: '8px', padding: '4px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', minHeight: 0, boxSizing: 'border-box' }}
        >
          <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>H%</span>
          <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#22d3ee' }}>{fmt(datos.humedad, '%')}</span>
        </button>

        <button
          onClick={() => onClickMetrica(datos, 'kwf')}
          style={{ width: 'calc(50% - 3px)', height: 'calc(50% - 3px)', backgroundColor: colorKwf ? hexA(colorKwf, 0.18) : 'rgba(59, 7, 100, 0.3)', border: `1px solid ${colorKwf ? hexA(colorKwf, 0.55) : 'rgba(88, 28, 135, 0.5)'}`, borderRadius: '8px', padding: '4px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', minHeight: 0, boxSizing: 'border-box' }}
        >
          <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>KWF</span>
          <span style={{ fontSize: '15px', fontWeight: 'bold', color: colorKwf || '#c084fc' }}>{fmt(datos.kw)}</span>
          {hayDatoKwf && <span style={{ fontSize: '7px', fontWeight: 'bold', color: hexA(colorKwf, 0.85) }}>{fmtPorcentaje(pctKwf)} Op.</span>}
        </button>

        <button
          onClick={() => onClickMetrica(datos, 'cargati')}
          style={{ width: 'calc(50% - 3px)', height: 'calc(50% - 3px)', backgroundColor: 'rgba(124, 45, 18, 0.3)', border: '1px solid rgba(194, 65, 12, 0.5)', borderRadius: '8px', padding: '4px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', minHeight: 0, boxSizing: 'border-box' }}
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
    <div style={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155', borderTop: '2px solid #94a3b8', padding: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', width: '100%', minHeight: 0, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '4px', flexShrink: 0 }}>
        <h2 style={{ fontSize: '12px', fontWeight: 'bold', color: '#f8fafc', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '50%' }}>{datos.equipo || 'Chiller'}</h2>
        <div style={{ fontSize: '9px', color: '#94a3b8', backgroundColor: '#020617', padding: '1px 4px', borderRadius: '4px', border: '1px solid #1e293b', display: 'flex', gap: '2px' }}>
          <span>Comp:</span>
          {statusList.length > 0 ? statusList.map((st, idx) => (
            <span key={idx} style={{ fontWeight: 'bold', color: '#cbd5e1' }}>[{st || '—'}]</span>
          )) : <span>—</span>}
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', flex: 1, minHeight: 0, marginTop: '6px' }}>
        <div style={{ width: 'calc(50% - 3px)', backgroundColor: 'rgba(19, 78, 74, 0.3)', border: '1px solid rgba(15, 118, 110, 0.5)', borderRadius: '8px', padding: '4px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 0, boxSizing: 'border-box' }}>
          <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>T° Surtidor</span>
          <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#2dd4bf' }}>{fmt(datos.tempSurtidor, '°C')}</span>
        </div>
        <div style={{ width: 'calc(50% - 3px)', backgroundColor: 'rgba(12, 74, 110, 0.3)', border: '1px solid rgba(3, 105, 161, 0.5)', borderRadius: '8px', padding: '4px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 0, boxSizing: 'border-box' }}>
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
    <div style={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155', borderTop: '2px solid #f59e0b', padding: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', width: '100%', minHeight: 0, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '4px', flexShrink: 0 }}>
        <h2 style={{ fontSize: '12px', fontWeight: 'bold', color: '#f8fafc', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '55%' }}>{datos.equipo || 'UPS'}</h2>
        <span style={{ fontSize: '9px', color: '#94a3b8', backgroundColor: '#020617', padding: '1px 4px', borderRadius: '4px', border: '1px solid #1e293b', whiteSpace: 'nowrap' }}>
          KVA: <strong style={{ color: '#fde047' }}>{fmt(datos.kvaInicio)}</strong>
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', flex: 1, minHeight: 0, marginTop: '6px' }}>
        <button
          onClick={() => onClickMetrica(datos, 'energia')}
          style={{ width: 'calc(50% - 3px)', backgroundColor: 'rgba(49, 46, 129, 0.3)', border: '1px solid rgba(67, 56, 202, 0.5)', borderRadius: '8px', padding: '4px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', minHeight: 0, boxSizing: 'border-box' }}
        >
          <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>KW</span>
          <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#818cf8' }}>{fmt(datos.kvaTermino)}</span>
        </button>

        <button
          onClick={() => onClickMetrica(datos, 'energia')}
          style={{
            width: 'calc(50% - 3px)',
            backgroundColor: colorCarga ? hexA(colorCarga, 0.18) : 'rgba(2, 44, 34, 0.3)',
            border: `1px solid ${colorCarga ? hexA(colorCarga, 0.55) : 'rgba(6, 78, 59, 0.5)'}`,
            borderRadius: '8px', padding: '4px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', minHeight: 0, boxSizing: 'border-box'
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

  // --- MODAL ÚNICO ---
  // Antes había dos estados independientes (uno para el detalle de KPI y otro
  // para Novedades), lo que permitía tener ambos abiertos al mismo tiempo.
  // Ahora es un solo estado: modalActivo = null | { tipo: 'detalle', sala, metrica } | { tipo: 'novedades' }.
  // Abrir cualquier modal reemplaza automáticamente al que estuviera abierto.
  const [modalActivo, setModalActivo] = useState(null);
  const abrirDetalle = (sala, metrica) => setModalActivo({ tipo: 'detalle', sala, metrica });
  const abrirNovedades = () => setModalActivo({ tipo: 'novedades' });
  const cerrarModal = () => setModalActivo(null);

  const intervaloRef = useRef(null);
  const { columnas, esPantallaGrande } = useResponsiveLayout();
  // El margen inferior debe coincidir con el padding inferior real de la
  // página (ver el div raíz más abajo: 14px en TV/landscape, 10px en chico)
  // más un pequeño colchón de seguridad para evitar que aparezca scroll.
  const margenInferior = esPantallaGrande ? 18 : 14;
  const [climaRef, alturaDisponibleClima] = useAlturaDisponible(margenInferior);
  const [energiaRef, alturaDisponibleEnergia] = useAlturaDisponible(margenInferior);

  // --- VIEWPORT: siempre tamaño real, sin zoom artificial ---
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

  // --- TARJETAS: Flexbox en vez de CSS Grid ---
  // Motivo: el WebView de la Android TV (y el WebViewer de Kodular) usan un
  // Chromium muy viejo que no soporta bien `display: grid` con
  // `grid-template-rows: repeat(...)`. Flexbox con wrap tiene soporte mucho
  // más amplio en WebViews antiguos y da el mismo resultado visual.
  const gapPx = 8;
  const anchoTarjeta = `calc(${100 / columnas}% - ${(gapPx * (columnas - 1)) / columnas}px)`;
  // TV (pantalla grande): 2 filas fijas (ITEMS_POR_PAGINA / columnas), todo
  // visible sin scroll. Pantallas chicas: alto fijo razonable, con scroll si
  // no entra todo.
  const filas = esPantallaGrande ? Math.max(1, Math.ceil(ITEMS_POR_PAGINA / columnas)) : null;

  // El alto de cada tarjeta se calcula en PÍXELES REALES a partir del alto
  // DISPONIBLE (useAlturaDisponible: viewport - top - margen), no de la
  // altura propia del contenedor ni de `calc(%)`. Ver el comentario del hook
  // más arriba para el porqué (evita el bucle de retroalimentación que hacía
  // que las tarjetas se fueran encogiendo).
  const calcularAltoTarjetaPx = (alturaDisponible) => {
    if (!esPantallaGrande) return 150; // pantallas chicas: alto fijo, con scroll
    if (!alturaDisponible || !filas) return 130; // valor de arranque mientras se mide
    const alto = (alturaDisponible - gapPx * (filas - 1)) / filas;
    return Math.max(70, Math.floor(alto));
  };
  const altoTarjetaClima = calcularAltoTarjetaPx(alturaDisponibleClima);
  const altoTarjetaEnergia = calcularAltoTarjetaPx(alturaDisponibleEnergia);

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
            onClick={abrirNovedades}
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
          <div ref={climaRef} style={{ display: 'flex', flexWrap: 'wrap', gap: `${gapPx}px`, height: esPantallaGrande ? `${alturaDisponibleClima || altoTarjetaClima * filas + gapPx * (filas - 1)}px` : undefined, alignContent: 'flex-start' }}>
            {climaEnPantalla.map((item, i) => {
              const contenido = !item
                ? null
                : item.tipo === 'chiller'
                  ? <TarjetaChiller key={item.id || `chiller-${i}`} datos={item} />
                  : (
                    <TarjetaClima
                      key={item.id || `sala-${i}`}
                      datos={item}
                      onClickMetrica={abrirDetalle}
                    />
                  );
              return (
                <div key={`clima-slot-${i}`} style={{ width: anchoTarjeta, height: `${altoTarjetaClima}px`, boxSizing: 'border-box' }}>
                  {contenido}
                </div>
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
          <div ref={energiaRef} style={{ display: 'flex', flexWrap: 'wrap', gap: `${gapPx}px`, height: esPantallaGrande ? `${alturaDisponibleEnergia || altoTarjetaEnergia * filas + gapPx * (filas - 1)}px` : undefined, alignContent: 'flex-start' }}>
            {energiaEnPantalla.map((ups, i) => {
              const contenido = !ups ? null : (
                <TarjetaEnergia
                  key={ups.id || `ups-${i}`}
                  datos={ups}
                  onClickMetrica={abrirDetalle}
                />
              );
              return (
                <div key={`energia-slot-${i}`} style={{ width: anchoTarjeta, height: `${altoTarjetaEnergia}px`, boxSizing: 'border-box' }}>
                  {contenido}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {modalActivo?.tipo === 'detalle' && (
        <ModalDetalle
          config={{ sala: modalActivo.sala, metrica: modalActivo.metrica }}
          onClose={cerrarModal}
        />
      )}
      {modalActivo?.tipo === 'novedades' && (
        <ModalNovedades
          novedades={novedades}
          onClose={cerrarModal}
          columnaUnica={!esPantallaGrande && columnas < 3}
        />
      )}
    </div>
  );
};

export default IcetelProgramaVista;
