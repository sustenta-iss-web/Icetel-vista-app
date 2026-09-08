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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" onClick={onClose}>
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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col text-slate-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-5 border-b border-slate-800 shrink-0">
          <div>
            <h3 className="text-xl font-bold text-cyan-400 tracking-wide">Novedades y Observaciones de Operación</h3>
            <p className="text-sm text-slate-400">Registro reciente clasificado por área de supervisión</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-2xl font-bold px-3 py-1 leading-none rounded-md bg-slate-900 border border-slate-800">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="flex flex-col bg-slate-900/40 p-4 rounded-xl border border-slate-800">
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

          <div className="flex flex-col bg-slate-900/40 p-4 rounded-xl border border-slate-800">
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
    <div className="bg-slate-900 rounded-2xl border border-slate-700 border-t-[2px] border-t-slate-400/60 p-2.5 flex flex-col justify-between w-full" style={{ height: '145px' }}>
      <div className="flex justify-between items-center mb-1 border-b border-slate-800 pb-1 shrink-0">
        <h2 className="text-xs font-bold text-slate-200 truncate">{datos.nombre || 'Sala'}</h2>
        <div className="flex gap-1">
          <span className="text-[8px] text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">KWF: {fmt(datos.maxKwf)}</span>
          <span className="text-[8px] text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">TI: {fmt(datos.maxTi)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 flex-1">
        <button
          onClick={() => onClickMetrica(datos, 'temperatura')}
          className="bg-blue-950/30 p-1.5 rounded-lg border border-blue-900/50 flex flex-col justify-center text-center cursor-pointer hover:bg-blue-900/40"
          style={tempCritica ? { backgroundColor: hexA(COLOR_PREOCUPANTE, 0.18), borderColor: hexA(COLOR_PREOCUPANTE, 0.55) } : undefined}
        >
          <span className="text-[9px] uppercase font-bold text-slate-500">T°</span>
          <span className={`text-base font-bold ${tempCritica ? '' : 'text-blue-400'}`} style={tempCritica ? { color: COLOR_PREOCUPANTE } : undefined}>
            {fmt(temp, '°C')}
          </span>
        </button>

        <button
          onClick={() => onClickMetrica(datos, 'humedad')}
          className="bg-cyan-950/30 p-1.5 rounded-lg border border-cyan-900/50 flex flex-col justify-center text-center cursor-pointer hover:bg-cyan-900/40"
        >
          <span className="text-[9px] uppercase font-bold text-slate-500">H%</span>
          <span className="text-base font-bold text-cyan-400">{fmt(datos.humedad, '%')}</span>
        </button>

        <button
          onClick={() => onClickMetrica(datos, 'kwf')}
          className="p-1.5 rounded-lg border flex flex-col justify-center text-center cursor-pointer"
          style={{
            backgroundColor: colorKwf ? hexA(colorKwf, 0.18) : 'rgba(59, 7, 100, 0.3)',
            borderColor: colorKwf ? hexA(colorKwf, 0.55) : 'rgba(88, 28, 135, 0.5)'
          }}
        >
          <span className="text-[9px] uppercase font-bold text-slate-500">KWF</span>
          <span className="text-base font-bold" style={{ color: colorKwf || '#c084fc' }}>{fmt(datos.kw)}</span>
          {hayDatoKwf && <span className="text-[8px] font-bold" style={{ color: hexA(colorKwf, 0.85) }}>{fmtPorcentaje(pctKwf)}</span>}
        </button>

        <button
          onClick={() => onClickMetrica(datos, 'cargati')}
          className="bg-orange-950/30 p-1.5 rounded-lg border border-orange-900/50 flex flex-col justify-center text-center cursor-pointer hover:bg-orange-900/40"
        >
          <span className="text-[9px] uppercase font-bold text-slate-500">Carga TI</span>
          <span className="text-base font-bold text-orange-400">{fmt(datos.cargaTiKw)}</span>
          {datos.cargaTi !== undefined && datos.cargaTi !== null && (
            <span className="text-[8px] font-bold text-orange-300/70">{fmtPorcentaje(datos.cargaTi)}</span>
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
    <div className="bg-slate-900 rounded-2xl border border-slate-700 border-t-[2px] border-t-slate-400/60 p-2.5 flex flex-col justify-between w-full" style={{ height: '145px' }}>
      <div className="flex justify-between items-center mb-1 border-b border-slate-800 pb-1 shrink-0">
        <h2 className="text-xs font-bold text-slate-200 truncate">{datos.equipo || 'Chiller'}</h2>
        <div className="text-[9px] text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 flex gap-1">
          <span>Comp:</span>
          {statusList.length > 0 ? statusList.map((st, idx) => (
            <span key={idx} className="font-bold text-slate-300">[{st || '—'}]</span>
          )) : <span>—</span>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 flex-1">
        <div className="bg-teal-950/30 p-1.5 rounded-lg border border-teal-900/50 flex flex-col justify-center text-center">
          <span className="text-[9px] uppercase font-bold text-slate-500">T° Surtidor</span>
          <span className="text-base font-bold text-teal-400">{fmt(datos.tempSurtidor, '°C')}</span>
        </div>
        <div className="bg-sky-950/30 p-1.5 rounded-lg border border-sky-900/50 flex flex-col justify-center text-center">
          <span className="text-[9px] uppercase font-bold text-slate-500">T° Retorno</span>
          <span className="text-base font-bold text-sky-400">{fmt(datos.tempRetorno, '°C')}</span>
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
    <div className="bg-slate-900 rounded-2xl border border-slate-700 border-t-[2px] border-t-amber-500/60 p-2.5 flex flex-col justify-between w-full" style={{ height: '145px' }}>
      <div className="flex justify-between items-center mb-1 border-b border-slate-800 pb-1 shrink-0">
        <h2 className="text-xs font-bold text-slate-200 truncate">{datos.equipo || 'UPS'}</h2>
        <span className="text-[9px] text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
          KVA: <strong className="text-amber-300">{fmt(datos.kvaInicio)}</strong>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 flex-1">
        <button
          onClick={() => onClickMetrica(datos, 'energia')}
          className="bg-indigo-950/30 p-1.5 rounded-lg border border-indigo-900/50 flex flex-col justify-center text-center cursor-pointer hover:bg-indigo-900/40"
        >
          <span className="text-[9px] uppercase font-bold text-slate-500">KW</span>
          <span className="text-base font-bold text-indigo-400">{fmt(datos.kvaTermino)}</span>
        </button>

        <button
          onClick={() => onClickMetrica(datos, 'energia')}
          className="p-1.5 rounded-lg border flex flex-col justify-center text-center cursor-pointer"
          style={{
            backgroundColor: colorCarga ? hexA(colorCarga, 0.18) : 'rgba(2, 44, 34, 0.3)',
            borderColor: colorCarga ? hexA(colorCarga, 0.55) : 'rgba(6, 78, 59, 0.5)'
          }}
        >
          <span className="text-[9px] uppercase font-bold text-slate-500">% Carga</span>
          <span className="text-base font-bold" style={{ color: colorCarga || '#34d399' }}>{fmtPorcentaje(pctCarga)}</span>
        </button>
      </div>
    </div>
  );
};

// --- VISTA PRINCIPAL CORREGIDA ---
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

  const indiceInicio = paginaActual * ITEMS_POR_PAGINA;
  const indiceFin = indiceInicio + ITEMS_POR_PAGINA;
  const climaEnPantalla = datosClima.slice(indiceInicio, indiceFin);
  const energiaEnPantalla = datosEnergia.slice(indiceInicio, indiceFin);

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#020617', padding: '12px', boxSizing: 'border-box', overflow: 'hidden', color: '#f1f5f9', fontFamily: 'sans-serif' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid #1e293b', paddingBottom: '8px', height: '10%' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Icetel Visualización</h1>
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
          <div style={{ backgroundColor: '#0f172a', padding: '6px 10px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '11px', fontWeight: 'bold', color: error ? '#ef4444' : '#10b981' }}>
            {error ? 'Error' : 'EN LÍNEA'}
          </div>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: '8px', backgroundColor: 'rgba(127, 29, 29, 0.4)', border: '1px solid #991b1b', color: '#f87171', fontSize: '12px', padding: '6px', borderRadius: '4px' }}>
          Error: {error}
        </div>
      )}

      {/* CONTENEDOR PRINCIPAL (Clima y Energía lado a lado por porcentaje) */}
      <div style={{ display: 'flex', flexDirection: 'row', gap: '16px', height: '88%', width: '100%' }}>
        
        {/* COLUMNA CLIMA */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', color: '#cbd5e1', borderBottom: '2px solid #334155', paddingBottom: '4px', margin: '0 0 8px 0' }}>
            Clima
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', flex: 1 }}>
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

        {/* LÍNEA DIVISORIA */}
        <div style={{ width: '2px', backgroundColor: '#1e293b', borderRadius: '2px' }}></div>

        {/* COLUMNA ENERGÍA */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', color: '#fbbf24', borderBottom: '2px solid #92400e', paddingBottom: '4px', margin: '0 0 8px 0' }}>
            Energía
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', flex: 1 }}>
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
      {mostrarNovedades && <ModalNovedades novedades={novedades} onClose={() => setMostrarNovedades(false)} />}
    </div>
  );
};

export default IcetelProgramaVista;
