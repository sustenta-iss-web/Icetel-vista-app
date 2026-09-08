
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

// --- MODAL DINÁMICO DE DETALLE (KWF y Energía) ---
const ModalDetalle = ({ config, onClose }) => {
  const { sala, metrica } = config;
  if (!sala || !metrica) return null;

  let titulo = '';
  let contenido = null;

  if (metrica === 'temperatura') {
    titulo = `Temperaturas - ${sala.nombre}`;
    contenido = (
      <div className="space-y-3">
        {(!sala.equipos || sala.equipos.length === 0) ? (
          <p className="text-slate-500 text-sm text-center py-4">No hay equipos registrados.</p>
        ) : (
          sala.equipos.map((eq, i) => (
            <div key={i} className="bg-slate-900/60 rounded-xl px-4 py-3 border border-slate-800 flex justify-between items-center">
              <span className="font-bold text-slate-200">{eq.nombre || 'Equipo'}</span>
              <div className="flex gap-4 text-sm bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 shadow-inner">
                <span className="text-blue-400 font-bold">{fmt(eq.temperatura, '°C')}</span>
              </div>
            </div>
          ))
        )}
      </div>
    );
  } else if (metrica === 'humedad') {
    titulo = `Humedad - ${sala.nombre}`;
    contenido = (
      <div className="space-y-3">
        {(!sala.equipos || sala.equipos.length === 0) ? (
          <p className="text-slate-500 text-sm text-center py-4">No hay equipos registrados.</p>
        ) : (
          sala.equipos.map((eq, i) => (
            <div key={i} className="bg-slate-900/60 rounded-xl px-4 py-3 border border-slate-800 flex justify-between items-center">
              <span className="font-bold text-slate-200">{eq.nombre || 'Equipo'}</span>
              <div className="flex gap-4 text-sm bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 shadow-inner">
                <span className="text-cyan-400 font-bold">{fmt(eq.humedad, '%')}</span>
              </div>
            </div>
          ))
        )}
      </div>
    );
  } else if (metrica === 'kwf') {
    titulo = `Estado de Circuitos KWF - ${sala.nombre}`;
    contenido = (
      <div className="space-y-3">
        {(!sala.detalleKwf || sala.detalleKwf.length === 0) ? (
          <p className="text-slate-500 text-sm text-center py-4">No hay detalle de circuitos registrado.</p>
        ) : (
          sala.detalleKwf.map((eq, i) => (
            <div key={i} className="bg-slate-900/60 rounded-xl p-3 border border-slate-800 flex flex-col gap-2">
              <div className="flex justify-between items-center border-b border-slate-800/80 pb-2">
                <span className="font-bold text-slate-200">{sala.nombre} - {eq.equipo}</span>
                <span className={`text-xs font-bold px-2 py-1 rounded-md ${eq.val === 1 ? 'bg-emerald-950/50 text-emerald-400' : eq.val === 0.5 ? 'bg-amber-950/50 text-amber-400' : 'bg-red-950/50 text-red-400'}`}>
                  {eq.val * 100}% Op.
                </span>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 shadow-inner flex justify-between items-center">
                  <span className="text-xs text-slate-500">Circuito 1</span>
                  <span className={`text-sm font-bold ${eq.c1 === 'OK' ? 'text-emerald-400' : eq.c1 === 'NOK' ? 'text-red-400' : 'text-slate-400'}`}>{eq.c1}</span>
                </div>
                <div className="flex-1 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 shadow-inner flex justify-between items-center">
                  <span className="text-xs text-slate-500">Circuito 2</span>
                  <span className={`text-sm font-bold ${eq.c2 === 'OK' ? 'text-emerald-400' : eq.c2 === 'NOK' ? 'text-red-400' : 'text-slate-400'}`}>{eq.c2}</span>
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
      <div className="bg-slate-900/60 rounded-xl p-5 border border-slate-800 space-y-4">
        <div className="flex justify-between border-b border-slate-800/80 pb-3">
          <span className="text-slate-400 font-medium">Capacidad Total TI (Máx TI)</span>
          <span className="text-slate-200 font-bold text-lg">{fmt(sala.maxTi, ' kW')}</span>
        </div>
        <div className="flex justify-between border-b border-slate-800/80 pb-3">
          <span className="text-slate-400 font-medium">Carga TI Actual</span>
          <span className="text-orange-400 font-bold text-lg">{fmt(sala.cargaTiKw, ' kW')}</span>
        </div>
        <div className="flex justify-between items-center pt-1">
          <span className="text-slate-400 font-medium">Porcentaje de Carga</span>
          <span className="text-orange-300 font-extrabold text-xl bg-orange-950/30 px-3 py-1 rounded-lg border border-orange-900/50">
            {fmtPorcentaje(sala.cargaTi)}
          </span>
        </div>
      </div>
    );
  } else if (metrica === 'energia') {
    titulo = `Detalle UPS - ${sala.equipo}`;
    contenido = (
      <div className="bg-slate-900/60 rounded-xl p-5 border border-slate-800 space-y-4">
        <div className="flex justify-between border-b border-slate-800/80 pb-3">
          <span className="text-slate-400 font-medium">KVA Inicio</span>
          <span className="text-amber-400 font-bold text-lg">{fmt(sala.kvaInicio)}</span>
        </div>
        <div className="flex justify-between border-b border-slate-800/80 pb-3">
          <span className="text-slate-400 font-medium">KW Término</span>
          <span className="text-indigo-400 font-bold text-lg">{fmt(sala.kvaTermino)}</span>
        </div>
        <div className="flex justify-between items-center pt-1">
          <span className="text-slate-400 font-medium">Porcentaje Carga</span>
          <span className="text-emerald-400 font-extrabold text-xl bg-emerald-950/30 px-3 py-1 rounded-lg border border-emerald-900/50">
            {fmtPorcentaje(sala.porcentajeCarga)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-5 border-b border-slate-800">
          <h3 className="text-xl font-bold text-slate-100">{titulo}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-2xl font-bold px-2 py-1 leading-none rounded-md">×</button>
        </div>
        <div className="overflow-y-auto p-5">
          {contenido}
        </div>
      </div>
    </div>
  );
};

// --- MODAL DE NOVEDADES ---
const ModalNovedades = ({ novedades, onClose }) => {
  if (!novedades) return null;

  const novClima = novedades.filter(n => (n.area || '').toLowerCase().includes('clima'));
  const novEnergia = novedades.filter(n => (n.area || '').toLowerCase().includes('energia') || (n.area || '').toLowerCase().includes('energía'));
  const novOtras = novedades.filter(n => {
    const a = (n.area || '').toLowerCase();
    return !a.includes('clima') && !a.includes('energia') && !a.includes('energía');
  });

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col text-slate-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-5 border-b border-slate-800 shrink-0">
          <div>
            <h3 className="text-xl font-bold text-cyan-400 tracking-wide">Novedades y Observaciones de Operación</h3>
            <p className="text-sm text-slate-400">Registro reciente clasificado por área de supervisión</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-2xl font-bold px-3 py-1 leading-none rounded-md bg-slate-900 border border-slate-800">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
          <div className="flex flex-col min-w-0 bg-slate-900/40 p-4 rounded-xl border border-slate-800">
            <h4 className="text-sm font-bold uppercase tracking-wider text-blue-400 mb-3 border-b border-blue-900/40 pb-2">
              Clima ({novClima.length})
            </h4>
            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              {novClima.length === 0 ? (
                <p className="text-slate-500 text-xs text-center py-6">No hay novedades registradas en Clima.</p>
              ) : (
                novClima.map((n, i) => (
                  <div key={i} className="bg-slate-900 border border-slate-800 p-3 rounded-lg shadow-inner space-y-1">
                    <div className="flex justify-between text-xs text-slate-400 font-medium">
                      <span>Sala: <strong className="text-slate-200">{n.sala || '—'}</strong> {n.equipo ? `(${n.equipo})` : ''}</span>
                      <span className="text-cyan-500">{n.fecha}</span>
                    </div>
                    <p className="text-sm text-slate-200 pt-1 font-normal">{n.observacion}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-col min-w-0 bg-slate-900/40 p-4 rounded-xl border border-slate-800">
            <h4 className="text-sm font-bold uppercase tracking-wider text-amber-400 mb-3 border-b border-amber-900/40 pb-2">
              Energía ({novEnergia.length})
            </h4>
            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              {novEnergia.length === 0 ? (
                <p className="text-slate-500 text-xs text-center py-6">No hay novedades registradas en Energía.</p>
              ) : (
                novEnergia.map((n, i) => (
                  <div key={i} className="bg-slate-900 border border-slate-800 p-3 rounded-lg shadow-inner space-y-1">
                    <div className="flex justify-between text-xs text-slate-400 font-medium">
                      <span>Sala: <strong className="text-slate-200">{n.sala || '—'}</strong> {n.equipo ? `(${n.equipo})` : ''}</span>
                      <span className="text-cyan-500">{n.fecha}</span>
                    </div>
                    <p className="text-sm text-slate-200 pt-1 font-normal">{n.observacion}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {novOtras.length > 0 && (
          <div className="px-6 pb-6 shrink-0">
            <p className="text-xs text-slate-500 uppercase mb-2">Otras áreas / General:</p>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {novOtras.map((n, i) => (
                <div key={i} className="bg-slate-900 border border-slate-800 p-2 rounded text-xs flex justify-between">
                  <span><strong>{n.area || 'General'}</strong> - {n.sala}: {n.observacion}</span>
                  <span className="text-cyan-500">{n.fecha}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- TARJETA CLIMA ---
const TarjetaClima = ({ datos, onClickMetrica }) => {
  if (!datos) return <div className="bg-transparent rounded-xl border border-transparent p-2.5 h-full w-full"></div>;

  const pctKwf = datos.porcentajeOperativo;
  const hayDatoKwf = pctKwf !== undefined && pctKwf !== null;
  const kwfCritico = hayDatoKwf && pctKwf < UMBRAL_KWF;
  const colorKwf = hayDatoKwf ? (kwfCritico ? COLOR_PREOCUPANTE : COLOR_KWF_OK) : null;

  const temp = datos.temperatura;
  const hayDatoTemp = temp !== undefined && temp !== null;
  const tempCritica = hayDatoTemp && temp >= UMBRAL_TEMP;

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-[0_8px_20px_rgba(0,0,0,0.4)] border border-slate-700 border-t-[2px] border-t-slate-400/60 p-3 flex flex-col justify-between h-full w-full overflow-hidden">

      <div className="flex justify-between items-center mb-2 border-b border-slate-800/60 pb-2 shrink-0">
        <h2 className="text-sm font-bold text-slate-200 tracking-wide truncate">{datos.nombre || 'Sala'}</h2>
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <div className="text-[9px] font-medium text-slate-400 bg-slate-950/80 px-2 py-0.5 rounded-md border border-slate-800 whitespace-nowrap shadow-inner">
            Max KWF: <span className="text-slate-200 font-bold">{fmt(datos.maxKwf)}</span>
          </div>
          <div className="text-[9px] font-medium text-slate-400 bg-slate-950/80 px-2 py-0.5 rounded-md border border-slate-800 whitespace-nowrap shadow-inner">
            Max TI: <span className="text-slate-200 font-bold">{fmt(datos.maxTi)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">

        <button
          onClick={() => onClickMetrica(datos, 'temperatura')}
          className="bg-blue-950/30 shadow-inner p-2 rounded-xl border border-blue-900/50 flex flex-col justify-center text-center transition-all cursor-pointer hover:border-blue-500/60 hover:bg-blue-900/40 focus:outline-none w-full"
          style={tempCritica ? { backgroundColor: hexA(COLOR_PREOCUPANTE, 0.18), borderColor: hexA(COLOR_PREOCUPANTE, 0.55) } : undefined}
        >
          <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">T°</p>
          <p className={`text-xl font-bold ${tempCritica ? '' : 'text-blue-400'}`} style={tempCritica ? { color: COLOR_PREOCUPANTE } : undefined}>
            {fmt(temp, '°C')}
          </p>
        </button>

        <button
          onClick={() => onClickMetrica(datos, 'humedad')}
          className="bg-cyan-950/30 shadow-inner p-2 rounded-xl border border-cyan-900/50 flex flex-col justify-center text-center transition-all cursor-pointer hover:border-cyan-500/60 hover:bg-cyan-900/40 focus:outline-none w-full"
        >
          <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">H%</p>
          <p className="text-xl font-bold text-cyan-400">{fmt(datos.humedad, '%')}</p>
        </button>

        <button
          onClick={() => onClickMetrica(datos, 'kwf')}
          className="p-2 rounded-xl border shadow-inner flex flex-col justify-center text-center transition-all cursor-pointer hover:border-purple-500/60 hover:bg-purple-950/30 focus:outline-none w-full"
          style={{
            backgroundColor: colorKwf ? hexA(colorKwf, 0.18) : 'rgba(59, 7, 100, 0.3)',
            borderColor: colorKwf ? hexA(colorKwf, 0.55) : 'rgba(88, 28, 135, 0.5)'
          }}
        >
          <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">KWF</p>
          <p className="text-xl font-bold" style={{ color: colorKwf || '#c084fc' }}>{fmt(datos.kw)}</p>
          {hayDatoKwf && (
            <p className="text-[9px] font-bold mt-0.5" style={{ color: hexA(colorKwf, 0.85) }}>
              {fmtPorcentaje(pctKwf)} Operativo
            </p>
          )}
        </button>

        <button
          onClick={() => onClickMetrica(datos, 'cargati')}
          className="bg-orange-950/30 shadow-inner p-2 rounded-xl border border-orange-900/50 flex flex-col justify-center text-center transition-all cursor-pointer hover:border-orange-500/60 hover:bg-orange-900/40 focus:outline-none w-full"
        >
          <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Carga TI</p>
          <p className="text-xl font-bold text-orange-400">{fmt(datos.cargaTiKw)}</p>
          {datos.cargaTi !== undefined && datos.cargaTi !== null && (
            <p className="text-[9px] font-bold text-orange-300/70 mt-0.5">
              {fmtPorcentaje(datos.cargaTi)} Carga
            </p>
          )}
        </button>

      </div>
    </div>
  );
};

// --- TARJETA CHILLER ---
const TarjetaChiller = ({ datos }) => {
  if (!datos) return <div className="bg-transparent rounded-xl border border-transparent p-2.5 h-full w-full"></div>;
  const statusList = datos.statusCompresores || [];

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-[0_8px_20px_rgba(0,0,0,0.4)] border border-slate-700 border-t-[2px] border-t-slate-400/60 p-3 flex flex-col justify-between h-full w-full text-left overflow-hidden">
      <div className="flex justify-between items-center mb-2 border-b border-slate-800/60 pb-2 shrink-0">
        <h2 className="text-sm font-bold text-slate-200 tracking-wide truncate">{datos.equipo || 'Chiller'}</h2>
        <div className="text-[10px] font-medium text-slate-400 bg-slate-950/80 px-2 py-0.5 rounded-md border border-slate-800 whitespace-nowrap flex gap-1 shadow-inner">
          <span>Comp:</span>
          {statusList.length > 0 ? statusList.map((st, idx) => (
            <span key={idx} className="font-bold text-slate-300">[{st || '—'}]</span>
          )) : <span className="text-slate-600">—</span>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
        <div className="bg-teal-950/30 shadow-inner p-2 rounded-xl border border-teal-900/50 flex flex-col justify-center text-center">
          <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">T° Surtidor</p>
          <p className="text-xl font-bold text-teal-400">{fmt(datos.tempSurtidor, '°C')}</p>
        </div>
        <div className="bg-sky-950/30 shadow-inner p-2 rounded-xl border border-sky-900/50 flex flex-col justify-center text-center">
          <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">T° Retorno</p>
          <p className="text-xl font-bold text-sky-400">{fmt(datos.tempRetorno, '°C')}</p>
        </div>
      </div>
    </div>
  );
};

// --- TARJETA ENERGÍA ---
const TarjetaEnergia = ({ datos, onClickMetrica }) => {
  if (!datos) return <div className="bg-transparent rounded-xl border border-transparent p-2.5 h-full w-full"></div>;

  const pctCarga = datos.porcentajeCarga;
  const hayDatoCarga = pctCarga !== undefined && pctCarga !== null;
  const cargaCritica = hayDatoCarga && pctCarga >= UMBRAL_CARGA_UPS;
  const colorCarga = hayDatoCarga ? (cargaCritica ? COLOR_PREOCUPANTE : COLOR_ENERGIA_OK) : null;

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-[0_8px_20px_rgba(0,0,0,0.4)] border border-slate-700 border-t-[2px] border-t-amber-500/60 p-3 flex flex-col h-full w-full overflow-hidden">

      <div className="flex justify-between items-center mb-2 border-b border-slate-800/60 pb-2 shrink-0">
        <h2 className="text-sm font-bold text-slate-200 tracking-wide truncate">{datos.equipo || 'UPS'}</h2>
        <div className="text-[10px] font-medium text-slate-400 bg-slate-950/80 px-2 py-0.5 rounded-md border border-slate-800 whitespace-nowrap shadow-inner">
          KVA: <span className="text-amber-300 font-bold">{fmt(datos.kvaInicio)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2 flex-1 min-h-0">

        <button
          onClick={() => onClickMetrica(datos, 'energia')}
          className="bg-indigo-950/30 shadow-inner p-2 rounded-xl border border-indigo-900/50 flex flex-col justify-center text-center transition-all cursor-pointer hover:border-indigo-500/60 hover:bg-indigo-900/40 focus:outline-none w-full"
        >
          <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">KW</p>
          <p className="text-xl font-bold text-indigo-400">{fmt(datos.kvaTermino)}</p>
        </button>

        <button
          onClick={() => onClickMetrica(datos, 'energia')}
          className="p-2 rounded-xl border shadow-inner flex flex-col justify-center text-center transition-all cursor-pointer hover:border-emerald-500/60 hover:bg-emerald-950/30 focus:outline-none w-full"
          style={{
            backgroundColor: colorCarga ? hexA(colorCarga, 0.18) : 'rgba(2, 44, 34, 0.3)',
            borderColor: colorCarga ? hexA(colorCarga, 0.55) : 'rgba(6, 78, 59, 0.5)'
          }}
        >
          <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Porcentaje Carga</p>
          <p className="text-xl font-bold" style={{ color: colorCarga || '#34d399' }}>{fmtPorcentaje(pctCarga)}</p>
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

    // --- CONTROL DINÁMICO DE VIEWPORT Y ZOOM (ROTACIÓN) ---
  useEffect(() => {
    const ajustarPantalla = () => {
      let viewport = document.querySelector('meta[name="viewport"]');
      if (!viewport) {
        viewport = document.createElement('meta');
        viewport.name = 'viewport';
        document.head.appendChild(viewport);
      }

      if (window.matchMedia("(orientation: landscape)").matches) {
        // Forzamos 1200px de ancho y aplicamos un zoom de alejamiento al 70% (0.7)
        viewport.setAttribute("content", "width=1200, initial-scale=0.6, maximum-scale=1.0, user-scalable=no");
      } else {
        // Celular vertical normal
        viewport.setAttribute("content", "width=device-width, initial-scale=1.0");
      }
    };

    // Ejecutar al cargar la app
    ajustarPantalla();

    // Quedarse escuchando cada vez que el usuario gire el teléfono
    window.addEventListener("resize", ajustarPantalla);
    
    // Limpieza del evento
    return () => window.removeEventListener("resize", ajustarPantalla);
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

  return (
    <div className="min-h-[100dvh] lg:h-[100dvh] w-full overflow-y-auto bg-slate-950 p-4 flex flex-col font-sans text-slate-200">

      <header className="mb-3 flex flex-col lg:flex-row lg:justify-between lg:items-end gap-3 shrink-0">
        <div>
          <h1 className="text-xl lg:text-2xl font-extrabold text-slate-100 tracking-tight">Icetel Visualización</h1>
          <p className="text-slate-400 text-sm font-medium mt-0.5">
            {cargando ? 'Cargando datos...' : `Mostrando panel ${paginaActual + 1} de ${totalPaginas} (rotación cada 10s · usa ← → para cambiar)`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setMostrarNovedades(true)}
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2 rounded-xl shadow-lg border border-cyan-300 transition-all text-sm flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <span className="w-2 h-2 rounded-full bg-slate-950 animate-pulse"></span>
            Novedades ({novedades.length})
          </button>

                    <button 
            onClick={() => window.location.reload()}
            title="Recargar página"
            className="flex items-center space-x-2 bg-slate-900/60 px-3 py-2 rounded-xl border border-slate-800 shadow-inner cursor-pointer hover:bg-slate-800 transition-all active:scale-95 focus:outline-none"
          >
            <span className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${error ? 'bg-red-500' : 'bg-emerald-500'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${error ? 'bg-red-600' : 'bg-emerald-500'}`}></span>
            </span>
            <span className="text-sm font-bold text-slate-300">{error ? 'Error de conexión' : 'EN LÍNEA'}</span>
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-3 bg-red-950/40 border border-red-900/50 text-red-400 text-sm rounded-xl px-4 py-2 shrink-0 shadow-lg">
          Error: {error}
        </div>
      )}

      <div className="flex flex-col lg:flex-row flex-1 gap-4 lg:gap-6 min-h-0">

        {/* CLIMA */}
        <div className="flex-1 flex flex-col min-w-0">
          <h2 className="text-lg font-bold mb-2 border-b-2 border-slate-700/80 pb-1 uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-slate-200 via-slate-400 to-slate-200 drop-shadow-sm">
            Clima
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-rows-2 gap-3 flex-1 min-h-0">
            {climaEnPantalla.map((item, i) => {
              if (!item) {
                return <div key={`empty-${i}`} className="bg-transparent rounded-xl border border-transparent p-2.5 h-full w-full"></div>;
              }
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

        <div className="hidden lg:block w-[2px] bg-slate-800/80 rounded-full my-4"></div>
        <div className="block lg:hidden h-[2px] bg-slate-800/80 rounded-full"></div>

        {/* ENERGÍA */}
        <div className="flex-1 flex flex-col min-w-0">
          <h2 className="text-lg font-bold mb-2 border-b-2 border-amber-800/50 pb-1 uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-500 to-amber-400 drop-shadow-sm">
            Energía
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-rows-2 gap-3 flex-1 min-h-0">
            {energiaEnPantalla.map((ups, i) => {
              if (!ups) {
                return <div key={`empty-ups-${i}`} className="bg-transparent rounded-xl border border-transparent p-2.5 h-full w-full"></div>;
              }
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
      {mostrarNovedades && <ModalNovedades novedades={novedades} onClose={() => setMostrarNovedades(false)} />}

    </div>
  );
};

export default IcetelProgramaVista;
