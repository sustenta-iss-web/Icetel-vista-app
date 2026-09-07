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
const UMBRAL_KWF = 40;      // % Operativo: bajo esto -> preocupante
const UMBRAL_CARGA_UPS = 80; // % Carga: sobre esto -> preocupante

// Convierte un hex "#rrggbb" a "rgba(r,g,b,alpha)"
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

// --- MODAL DE DETALLE DE EQUIPOS ---
const ModalEquipos = ({ sala, onClose }) => {
  if (!sala) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-5 border-b border-slate-800">
          <div>
            <h3 className="text-xl font-bold text-slate-100">{sala.nombre}</h3>
            <p className="text-sm text-slate-400">{(sala.equipos || []).length} equipo(s) en la sala</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-2xl font-bold px-2 py-1 leading-none rounded-md">×</button>
        </div>
        <div className="overflow-y-auto p-5 space-y-3">
          {(!sala.equipos || sala.equipos.length === 0) && (
            <p className="text-slate-500 text-sm text-center py-4">No hay detalle de equipos para mostrar.</p>
          )}
          {(sala.equipos || []).map((eq, i) => (
            <div key={i} className="bg-slate-800/50 rounded-xl px-4 py-3 border border-slate-700/50 flex justify-between items-center">
              <div>
                <span className="font-bold text-slate-200">{eq.nombre || 'Equipo'}</span>
                {eq.tipo && <span className="ml-2 text-xs text-slate-500">({eq.tipo})</span>}
              </div>
              <div className="flex gap-4 text-sm bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-700 shadow-sm">
                <span className="text-blue-400 font-bold">{fmt(eq.temperatura, '°C')}</span>
                <span className="text-cyan-400 font-bold">{fmt(eq.humedad, '%')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- TARJETA CLIMA (Acero / Plata) ---
const TarjetaClima = ({ datos, onClick }) => {
  if (!datos) return <div className="bg-transparent rounded-xl border border-transparent p-2.5 h-full w-full"></div>;

  const pctKwf = datos.porcentajeOperativo;
  const hayDatoKwf = pctKwf !== undefined && pctKwf !== null;
  const kwfCritico = hayDatoKwf && pctKwf < UMBRAL_KWF;
  const colorKwf = hayDatoKwf ? (kwfCritico ? COLOR_PREOCUPANTE : COLOR_KWF_OK) : null;

  return (
    <button
      onClick={() => onClick(datos)}
      className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl shadow-lg border border-slate-700 border-t-[3px] border-t-slate-400/60 p-2.5 flex flex-col justify-between h-full hover:shadow-xl hover:border-slate-500 transition-all text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-400 w-full overflow-hidden"
    >
      <div className="flex justify-between items-center mb-2 border-b border-slate-700/80 pb-1.5 shrink-0">
        <h2 className="text-sm font-bold text-slate-100 truncate">{datos.nombre || 'Sala'}</h2>
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <div className="text-[9px] font-medium text-slate-400 bg-slate-950/60 px-1.5 py-0.5 rounded-md border border-slate-800 whitespace-nowrap">
            Max KWF: <span className="text-slate-200 font-bold">{fmt(datos.maxKwf)}</span>
          </div>
          <div className="text-[9px] font-medium text-slate-400 bg-slate-950/60 px-1.5 py-0.5 rounded-md border border-slate-800 whitespace-nowrap">
            Max TI: <span className="text-slate-200 font-bold">{fmt(datos.maxTi)}</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
        <div className="bg-blue-950/30 p-2 rounded-lg border border-blue-900/50 flex flex-col justify-center text-center">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">T°</p>
          <p className="text-xl font-bold text-blue-400">{fmt(datos.temperatura, '°C')}</p>
        </div>
        <div className="bg-cyan-950/30 p-2 rounded-lg border border-cyan-900/50 flex flex-col justify-center text-center">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">H%</p>
          <p className="text-xl font-bold text-cyan-400">{fmt(datos.humedad, '%')}</p>
        </div>
        <div
          className="p-2 rounded-lg border flex flex-col justify-center text-center transition-colors"
          style={{
            backgroundColor: colorKwf ? hexA(colorKwf, 0.18) : 'rgba(88,28,135,0.18)',
            borderColor: colorKwf ? hexA(colorKwf, 0.55) : 'rgba(88,28,135,0.5)'
          }}
        >
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">KWF</p>
          <p className="text-xl font-bold" style={{ color: colorKwf || '#c084fc' }}>{fmt(datos.kw)}</p>
          {hayDatoKwf && (
            <p className="text-[9px] font-bold mt-0.5" style={{ color: hexA(colorKwf, 0.85) }}>
              {fmtPorcentaje(pctKwf)} Operativo
            </p>
          )}
        </div>
        <div className="bg-orange-950/30 p-2 rounded-lg border border-orange-900/50 flex flex-col justify-center text-center">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Carga TI</p>
          <p className="text-xl font-bold text-orange-400">{fmt(datos.cargaTiKw)}</p>
          {datos.cargaTi !== undefined && datos.cargaTi !== null && (
            <p className="text-[9px] font-bold text-orange-300/80 mt-0.5">
              {fmtPorcentaje(datos.cargaTi)} Carga
            </p>
          )}
        </div>
      </div>
    </button>
  );
};

// --- TARJETA CHILLER (Acero / Plata) ---
const TarjetaChiller = ({ datos }) => {
  if (!datos) return <div className="bg-transparent rounded-xl border border-transparent p-2.5 h-full w-full"></div>;
  const statusList = datos.statusCompresores || [];

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl shadow-lg border border-slate-700 border-t-[3px] border-t-slate-400/60 p-2.5 flex flex-col justify-between h-full w-full transition-all hover:shadow-xl hover:border-slate-500 text-left overflow-hidden">
      <div className="flex justify-between items-center mb-2 border-b border-slate-700/80 pb-1.5 shrink-0">
        <h2 className="text-sm font-bold text-slate-100 truncate">{datos.equipo || 'Chiller'}</h2>
        <div className="text-[10px] font-medium text-slate-400 bg-slate-950/60 px-1.5 py-0.5 rounded-md border border-slate-800 whitespace-nowrap flex gap-1">
          <span>Comp:</span>
          {statusList.length > 0 ? statusList.map((st, idx) => (
            <span key={idx} className="font-bold text-slate-200">[{st || '—'}]</span>
          )) : <span className="text-slate-600">—</span>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
        <div className="bg-teal-950/30 p-2 rounded-lg border border-teal-900/50 flex flex-col justify-center text-center">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">T° Surtidor</p>
          <p className="text-xl font-bold text-teal-400">{fmt(datos.tempSurtidor, '°C')}</p>
        </div>
        <div className="bg-sky-950/30 p-2 rounded-lg border border-sky-900/50 flex flex-col justify-center text-center">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">T° Retorno</p>
          <p className="text-xl font-bold text-sky-400">{fmt(datos.tempRetorno, '°C')}</p>
        </div>
      </div>
    </div>
  );
};

// --- TARJETA ENERGÍA (Bronce / Cobre) ---
const TarjetaEnergia = ({ datos }) => {
  if (!datos) return <div className="bg-transparent rounded-xl border border-transparent p-2.5 h-full w-full"></div>;

  const pctCarga = datos.porcentajeCarga;
  const hayDatoCarga = pctCarga !== undefined && pctCarga !== null;
  const cargaCritica = hayDatoCarga && pctCarga >= UMBRAL_CARGA_UPS;
  const colorCarga = hayDatoCarga ? (cargaCritica ? COLOR_PREOCUPANTE : COLOR_ENERGIA_OK) : null;

  return (
    <div className="bg-gradient-to-br from-stone-800 to-stone-900 rounded-xl shadow-lg border border-stone-700 border-t-[3px] border-t-amber-600/60 p-2.5 flex flex-col h-full w-full transition-all hover:shadow-xl hover:border-amber-700/50 text-left overflow-hidden">
      <div className="flex justify-between items-center mb-2 border-b border-stone-700/80 pb-1.5 shrink-0">
        <h2 className="text-sm font-bold text-stone-100 truncate">{datos.equipo || 'UPS'}</h2>
        <div className="text-[10px] font-medium text-stone-400 bg-stone-950/60 px-1.5 py-0.5 rounded-md border border-stone-800 whitespace-nowrap">
          KVA: <span className="text-stone-200 font-bold">{fmt(datos.kvaInicio)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2 flex-1 min-h-0">
        <div className="bg-indigo-950/30 p-2 rounded-lg border border-indigo-900/50 flex flex-col justify-center text-center">
          <p className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">KW</p>
          <p className="text-xl font-bold text-indigo-400">{fmt(datos.kvaTermino)}</p>
        </div>
        <div
          className="p-2 rounded-lg border flex flex-col justify-center text-center transition-colors"
          style={{
            backgroundColor: colorCarga ? hexA(colorCarga, 0.18) : 'rgba(6,95,70,0.18)',
            borderColor: colorCarga ? hexA(colorCarga, 0.55) : 'rgba(6,95,70,0.5)'
          }}
        >
          <p className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Porcentaje Carga</p>
          <p className="text-xl font-bold" style={{ color: colorCarga || '#34d399' }}>{fmtPorcentaje(pctCarga)}</p>
        </div>
      </div>
    </div>
  );
};

// --- VISTA PRINCIPAL ---
const IcetelProgramaVista = () => {
  const [datosClima, setDatosClima] = useState([]);
  const [datosEnergia, setDatosEnergia] = useState([]);
  const [paginaActual, setPaginaActual] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [salaSeleccionada, setSalaSeleccionada] = useState(null);

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
    <div className="min-h-screen lg:h-screen w-full lg:w-screen overflow-y-auto lg:overflow-hidden bg-slate-950 p-4 flex flex-col font-sans">
      <header className="mb-3 flex flex-col gap-2 lg:flex-row lg:justify-between lg:items-end shrink-0">
        <div>
          <h1 className="text-xl lg:text-2xl font-extrabold text-slate-100 tracking-tight">Icetel Visualización</h1>
          <p className="text-slate-400 text-sm font-medium mt-0.5">
            {cargando ? 'Cargando datos...' : `Mostrando panel ${paginaActual + 1} de ${totalPaginas} (rotación cada 10s · usa ← → para cambiar)`}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="relative flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${error ? 'bg-red-500' : 'bg-emerald-500'} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${error ? 'bg-red-600' : 'bg-emerald-500'}`}></span>
          </span>
          <span className="text-sm font-bold text-slate-400">{error ? 'Error de conexión' : 'Sistema Activo'}</span>
        </div>
      </header>

      {error && (
        <div className="mb-3 bg-red-950/50 border border-red-900/50 text-red-400 text-sm rounded-xl px-4 py-2 shrink-0">
          Error: {error}
        </div>
      )}

      <div className="flex flex-col lg:flex-row flex-1 gap-4 lg:gap-6 min-h-0">

        {/* CLIMA */}
        <div className="flex-1 flex flex-col min-w-0">
          <h2 className="text-lg font-bold mb-2 border-b-2 border-slate-700 pb-1 uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-slate-200 via-slate-400 to-slate-200 drop-shadow-sm">
            Clima
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-rows-2 gap-3 lg:flex-[7] min-h-0">
            {climaEnPantalla.map((item, i) => {
              if (!item) {
                return <div key={`empty-${i}`} className="bg-transparent rounded-xl border border-transparent p-2.5 h-full w-full"></div>;
              }
              if (item.tipo === 'chiller') {
                return <TarjetaChiller key={item.id || `chiller-${i}`} datos={item} />;
              }
              return <TarjetaClima key={item.id || `sala-${i}`} datos={item} onClick={setSalaSeleccionada} />;
            })}
          </div>
          <div className="hidden lg:block lg:flex-1 shrink-0"></div>
        </div>

        {/* DIVISOR VERTICAL */}
        <div className="hidden lg:block w-[2px] bg-slate-800 rounded-full my-4 shadow-[1px_0_0_0_rgba(255,255,255,0.05)]"></div>
        <div className="block lg:hidden h-[2px] bg-slate-800 rounded-full shadow-[0_1px_0_0_rgba(255,255,255,0.05)]"></div>

        {/* ENERGÍA */}
        <div className="flex-1 flex flex-col min-w-0">
          <h2 className="text-lg font-bold mb-2 border-b-2 border-stone-700 pb-1 uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-500 to-amber-400 drop-shadow-sm">
            Energía
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-rows-2 gap-3 lg:flex-[7] min-h-0">
            {energiaEnPantalla.map((ups, i) => {
              if (!ups) {
                return <div key={`empty-ups-${i}`} className="bg-transparent rounded-xl border border-transparent p-2.5 h-full w-full"></div>;
              }
              return <TarjetaEnergia key={ups.id || `ups-${i}`} datos={ups} />;
            })}
          </div>
          <div className="hidden lg:block lg:flex-1 shrink-0"></div>
        </div>

      </div>

      <ModalEquipos sala={salaSeleccionada} onClose={() => setSalaSeleccionada(null)} />
    </div>
  );
};

export default IcetelProgramaVista;
