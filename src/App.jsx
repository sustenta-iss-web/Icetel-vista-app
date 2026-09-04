import React, { useState, useEffect, useCallback } from 'react';

// --- CONFIGURACIÓN ---
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyqf0aKdc-ndKrSryz8a42Nl-aO-nkdiY3F4pn3VxgQeo4wkgwczpDZlNZCsEIVJu9z/exec';
const ITEMS_POR_PAGINA = 6; 
const INTERVALO_DATOS_MS = 15000; 
const INTERVALO_PAGINA_MS = 15000; 

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
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 transition-opacity" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-5 border-b border-slate-100">
          <div>
            <h3 className="text-xl font-bold text-slate-800">{sala.nombre}</h3>
            <p className="text-sm text-slate-500">{(sala.equipos || []).length} equipo(s) en la sala</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl font-bold px-2 py-1 leading-none rounded-md">×</button>
        </div>
        <div className="overflow-y-auto p-5 space-y-3">
          {(!sala.equipos || sala.equipos.length === 0) && (
            <p className="text-slate-500 text-sm text-center py-4">No hay detalle de equipos para mostrar.</p>
          )}
          {(sala.equipos || []).map((eq, i) => (
            <div key={i} className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100 flex justify-between items-center">
              <div>
                <span className="font-bold text-slate-700">{eq.nombre || 'Equipo'}</span>
                {eq.tipo && <span className="ml-2 text-xs text-slate-500">({eq.tipo})</span>}
              </div>
              <div className="flex gap-4 text-sm bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                <span className="text-blue-600 font-bold">{fmt(eq.temperatura, '°C')}</span>
                <span className="text-cyan-600 font-bold">{fmt(eq.humedad, '%')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- TARJETA CLIMA ---
const TarjetaClima = ({ datos, onClick }) => {
  if (!datos) return <div className="bg-transparent rounded-xl border border-transparent p-2.5 h-full"></div>;
  
  return (
    <button 
      onClick={() => onClick(datos)}
      className="bg-white rounded-xl shadow-sm border border-slate-200 p-2.5 flex flex-col justify-between h-full hover:shadow-md transition-shadow text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 w-full overflow-hidden"
    >
      <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-1.5 shrink-0">
        <h2 className="text-sm font-bold text-slate-800 truncate">{datos.nombre || 'Sala'}</h2>
        <div className="text-[10px] font-medium text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded-md whitespace-nowrap">
          Máx: <span className="text-slate-700 font-bold">{fmt(datos.maximo)}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
        <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100/50 flex flex-col justify-center text-center">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">T°</p>
          <p className="text-xl font-bold text-blue-600">{fmt(datos.temperatura, '°C')}</p>
        </div>
        <div className="bg-cyan-50/50 p-2 rounded-lg border border-cyan-100/50 flex flex-col justify-center text-center">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">H%</p>
          <p className="text-xl font-bold text-cyan-600">{fmt(datos.humedad, '%')}</p>
        </div>
        <div className="bg-purple-50/50 p-2 rounded-lg border border-purple-100/50 flex flex-col justify-center text-center">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">KWF</p>
          <p className="text-xl font-bold text-purple-600">{fmt(datos.kw)}</p>
          {datos.porcentajeOperativo !== undefined && (
            <p className="text-[9px] font-bold text-purple-500/80 mt-0.5">
              {fmtPorcentaje(datos.porcentajeOperativo)} Operativo
            </p>
          )}
        </div>
        <div className="bg-orange-50/50 p-2 rounded-lg border border-orange-100/50 flex flex-col justify-center text-center">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Carga TI</p>
          <p className="text-xl font-bold text-orange-600">{fmtPorcentaje(datos.cargaTi)}</p>
        </div>
      </div>
    </button>
  );
};

// --- TARJETA CHILLER ---
const TarjetaChiller = ({ datos }) => {
  if (!datos) return <div className="bg-transparent rounded-xl border border-transparent p-2.5 h-full"></div>;
  const statusList = datos.statusCompresores || [];
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2.5 flex flex-col justify-between h-full transition-shadow hover:shadow-md text-left overflow-hidden">
      <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-1.5 shrink-0">
        <h2 className="text-sm font-bold text-slate-800 truncate">{datos.equipo || 'Chiller'}</h2>
        <div className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md whitespace-nowrap flex gap-1">
          <span>Comp:</span>
          {statusList.length > 0 ? statusList.map((st, idx) => (
            <span key={idx} className="font-bold text-slate-700">[{st || '—'}]</span>
          )) : <span className="text-slate-400">—</span>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
        <div className="bg-teal-50/50 p-2 rounded-lg border border-teal-100/50 flex flex-col justify-center text-center">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">T° Surtidor</p>
          <p className="text-xl font-bold text-teal-600">{fmt(datos.tempSurtidor, '°C')}</p>
        </div>
        <div className="bg-sky-50/50 p-2 rounded-lg border border-sky-100/50 flex flex-col justify-center text-center">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">T° Retorno</p>
          <p className="text-xl font-bold text-sky-600">{fmt(datos.tempRetorno, '°C')}</p>
        </div>
      </div>
    </div>
  );
};

// --- TARJETA ENERGÍA ---
const TarjetaEnergia = ({ datos }) => {
  if (!datos) return <div className="bg-transparent rounded-xl border border-transparent p-2.5 h-full"></div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2.5 flex flex-col h-full transition-shadow hover:shadow-md text-left overflow-hidden">
      <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-1.5 shrink-0">
        <h2 className="text-sm font-bold text-slate-800 truncate">{datos.equipo || 'UPS'}</h2>
        <div className="text-[10px] font-medium text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded-md whitespace-nowrap">
          KVA: <span className="text-slate-700 font-bold">{fmt(datos.kvaInicio)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2 flex-1 min-h-0">
        <div className="bg-indigo-50/50 p-2 rounded-lg border border-indigo-100/50 flex flex-col justify-center text-center">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">KW</p>
          <p className="text-xl font-bold text-indigo-600">{fmt(datos.kvaTermino)}</p>
        </div>
        <div className="bg-emerald-50/50 p-2 rounded-lg border border-emerald-100/50 flex flex-col justify-center text-center">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Porcentaje Carga</p>
          <p className="text-xl font-bold text-emerald-600">{fmtPorcentaje(datos.porcentajeCarga)}</p>
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

  const cargarDatos = useCallback(async () => {
    try {
      const res = await fetch(GAS_URL);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Error desconocido');
      
      const salas = json.salas || [];
      let chillers = json.chillers || [];

      chillers.sort((a, b) => (a.equipo || '').localeCompare(b.equipo || ''));

      const indiceInicioPanel3 = ITEMS_POR_PAGINA * 2; // 12
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

  useEffect(() => {
    if (totalPaginas <= 1) return;
    const intervaloPagina = setInterval(() => {
      setPaginaActual((p) => (p + 1) % totalPaginas);
    }, INTERVALO_PAGINA_MS);
    return () => clearInterval(intervaloPagina);
  }, [totalPaginas]);

  const indiceInicio = paginaActual * ITEMS_POR_PAGINA;
  const indiceFin = indiceInicio + ITEMS_POR_PAGINA;
  const climaEnPantalla = datosClima.slice(indiceInicio, indiceFin);
  const energiaEnPantalla = datosEnergia.slice(indiceInicio, indiceFin);

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50 p-4 flex flex-col font-sans">
      <header className="mb-3 flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Icetel Visualización</h1>
          <p className="text-slate-500 text-sm font-medium mt-0.5">
            {cargando ? 'Cargando datos...' : `Mostrando panel ${paginaActual + 1} de ${totalPaginas} (Rotación cada 15s)`}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="relative flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${error ? 'bg-red-400' : 'bg-green-400'} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${error ? 'bg-red-500' : 'bg-green-500'}`}></span>
          </span>
          <span className="text-sm font-bold text-slate-600">{error ? 'Error de conexión' : 'Sistema Activo'}</span>
        </div>
      </header>

      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-2 shrink-0">
          Error: {error}
        </div>
      )}

      <div className="flex flex-1 flex-row gap-6 min-h-0">
        
        {/* CLIMA */}
        <div className="flex-1 flex flex-col min-w-0">
          <h2 className="text-lg font-bold text-slate-700 mb-2 border-b-2 border-blue-400 pb-1 uppercase tracking-wide">
            Clima
          </h2>
          <div className="grid grid-cols-3 grid-rows-2 gap-3 flex-1 min-h-0">
            {climaEnPantalla.map((item, i) => {
              if (!item) {
                return <div key={`empty-${i}`} className="bg-transparent rounded-xl border border-transparent p-2.5 h-full"></div>;
              }
              if (item.tipo === 'chiller') {
                return <TarjetaChiller key={item.id || `chiller-${i}`} datos={item} />;
              }
              return <TarjetaClima key={item.id || `sala-${i}`} datos={item} onClick={setSalaSeleccionada} />;
            })}
          </div>
        </div>

        <div className="w-[2px] bg-slate-200 rounded-full my-4"></div>

        {/* ENERGÍA */}
        <div className="flex-1 flex flex-col min-w-0">
          <h2 className="text-lg font-bold text-slate-700 mb-2 border-b-2 border-orange-400 pb-1 uppercase tracking-wide">
            Energía
          </h2>
          <div className="grid grid-cols-3 grid-rows-2 gap-3 flex-1 min-h-0">
            {energiaEnPantalla.map((ups, i) => {
              if (!ups) {
                return <div key={`empty-ups-${i}`} className="bg-transparent rounded-xl border border-transparent p-2.5 h-full"></div>;
              }
              return <TarjetaEnergia key={ups.id || `ups-${i}`} datos={ups} />;
            })}
          </div>
        </div>

      </div>

      <ModalEquipos sala={salaSeleccionada} onClose={() => setSalaSeleccionada(null)} />
    </div>
  );
};

export default IcetelProgramaVista;
