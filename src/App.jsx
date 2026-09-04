import React, { useState, useEffect, useCallback } from 'react';

// --- CONFIGURACIÓN ---
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyqf0aKdc-ndKrSryz8a42Nl-aO-nkdiY3F4pn3VxgQeo4wkgwczpDZlNZCsEIVJu9z/exec';

// Ayudante para formatear números
const fmt = (valor, sufijo = '') => (valor === null || valor === undefined || valor === '' || isNaN(valor) ? '—' : `${valor}${sufijo}`);

// --- MODAL DE DETALLE DE EQUIPOS (Para Clima) ---
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
                <span className="font-bold text-slate-700">{eq.nombre}</span>
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

// --- COMPONENTE: TARJETA CLIMA (Izquierda) ---
const TarjetaClima = ({ datos, onClick }) => (
  <button 
    onClick={() => onClick(datos)}
    className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 flex flex-col justify-between h-full hover:shadow-md transition-shadow text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 w-full"
  >
    <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-2">
      <h2 className="text-sm font-bold text-slate-800 truncate">{datos.nombre || 'Sala Desconocida'}</h2>
    </div>
    <div className="grid grid-cols-2 gap-2 flex-1">
      <div className="bg-blue-50 p-2 rounded-lg text-center flex flex-col justify-center">
        <p className="text-[10px] uppercase font-bold text-slate-400">T°</p>
        <p className="text-lg font-semibold text-blue-600">{fmt(datos.temperatura, '°C')}</p>
      </div>
      <div className="bg-cyan-50 p-2 rounded-lg text-center flex flex-col justify-center">
        <p className="text-[10px] uppercase font-bold text-slate-400">H%</p>
        <p className="text-lg font-semibold text-cyan-600">{fmt(datos.humedad, '%')}</p>
      </div>
      <div className="bg-purple-50 p-2 rounded-lg text-center flex flex-col justify-center">
        <p className="text-[10px] uppercase font-bold text-slate-400">Kw</p>
        <p className="text-lg font-semibold text-purple-600">{fmt(datos.kw)}</p>
      </div>
      <div className="bg-orange-50 p-2 rounded-lg text-center flex flex-col justify-center">
        <p className="text-[10px] uppercase font-bold text-slate-400">Carga TI</p>
        <p className="text-lg font-semibold text-orange-600">{fmt(datos.cargaTi, '%')}</p>
      </div>
    </div>
  </button>
);

// --- COMPONENTE: TARJETA ENERGÍA (Derecha) ---
const TarjetaEnergia = ({ datos }) => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col justify-between h-full">
    <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
      {/* Muestra el nombre desde la columna Equipo */}
      <h2 className="text-base font-bold text-slate-800 truncate">{datos.equipo || datos.nombre || 'UPS Desconocida'}</h2>
    </div>
    <div className="grid grid-cols-2 gap-3 flex-grow">
      <div className="bg-indigo-50 flex flex-col items-center justify-center p-3 rounded-xl border border-indigo-100">
        <p className="text-xs uppercase font-bold text-slate-400 mb-1">KVA</p>
        {/* Lee kvaInicio desde el backend */}
        <p className="text-2xl font-bold text-indigo-600">{fmt(datos.kvaInicio || datos.kva)}</p>
      </div>
      <div className="bg-emerald-50 flex flex-col items-center justify-center p-3 rounded-xl border border-emerald-100">
        <p className="text-xs uppercase font-bold text-slate-400 mb-1">Carga</p>
        {/* Lee porcentajeCarga desde el backend */}
        <p className="text-2xl font-bold text-emerald-600">{fmt(datos.porcentajeCarga || datos.cargaPct, '%')}</p>
      </div>
    </div>
  </div>
);

// --- VISTA PRINCIPAL ---
const IcetelProgramaVista = () => {
  const [datosClima, setDatosClima] = useState([]);
  const [datosEnergia, setDatosEnergia] = useState([]);
  const [paginaActual, setPaginaActual] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [salaSeleccionada, setSalaSeleccionada] = useState(null);

  // Función para obtener los datos de la planilla
  const cargarDatos = useCallback(async () => {
    try {
      const res = await fetch(GAS_URL);
      const json = await res.json();
      
      if (!json.ok) throw new Error(json.error || 'Error al obtener datos');
      
      setDatosClima(json.salas || []);
      setDatosEnergia(json.energia || json.ups || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  // Efecto para la actualización de la base de datos (cada 15s)
  useEffect(() => {
    cargarDatos();
    const intervaloDatos = setInterval(cargarDatos, 15000);
    return () => clearInterval(intervaloDatos);
  }, [cargarDatos]);

  // Efecto para paginación (cambia la página visible cada 30 segundos)
  const itemsPorPagina = 6;
  const totalPaginas = Math.max(1, Math.ceil(Math.max(datosClima.length, datosEnergia.length) / itemsPorPagina));

  useEffect(() => {
    if (totalPaginas <= 1) return;
    const intervaloPagina = setInterval(() => {
      setPaginaActual((prev) => (prev + 1) % totalPaginas);
    }, 30000);
    return () => clearInterval(intervaloPagina);
  }, [totalPaginas]);

  // Selección de datos para la página actual
  const inicio = paginaActual * itemsPorPagina;
  const fin = inicio + itemsPorPagina;
  const climaEnPantalla = datosClima.slice(inicio, fin);
  const energiaEnPantalla = datosEnergia.slice(inicio, fin);

  return (
    <div className="h-screen w-screen bg-slate-50 p-4 flex flex-col overflow-hidden font-sans">
      <header className="mb-4 shrink-0 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Icetel Visualización</h1>
          <p className="text-slate-500 text-sm font-medium mt-1">
            {cargando ? 'Conectando con planilla...' : `Mostrando panel ${paginaActual + 1} de ${totalPaginas}`}
          </p>
        </div>
        <div className="flex items-center space-x-2">
           <span className="relative flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${error ? 'bg-red-400' : 'bg-green-400'} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${error ? 'bg-red-500' : 'bg-green-500'}`}></span>
          </span>
          <span className="text-sm font-bold text-slate-600">
            {error ? 'Error de Conexión' : 'Sistema Activo'}
          </span>
        </div>
      </header>

      {error && (
        <div className="mb-3 bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm border border-red-200">
          No se pudieron cargar los datos: {error}
        </div>
      )}

      {/* CONTENEDOR DIVIDIDO */}
      <div className="flex flex-1 flex-row gap-6 min-h-0">
        
        {/* IZQUIERDA: CLIMA */}
        <div className="flex-1 flex flex-col min-w-0">
          <h2 className="text-xl font-bold text-slate-700 mb-3 border-b-2 border-blue-400 pb-1 tracking-wide">CLIMA</h2>
          <div className="grid grid-cols-3 grid-rows-2 gap-3 flex-1">
            {climaEnPantalla.map((sala, index) => (
              <TarjetaClima key={`clima-${sala.id || index}`} datos={sala} onClick={setSalaSeleccionada} />
            ))}
          </div>
        </div>

        {/* DIVISOR CENTRAL */}
        <div className="w-1 bg-slate-200 rounded-full my-6"></div>

        {/* DERECHA: ENERGÍA */}
        <div className="flex-1 flex flex-col min-w-0">
          <h2 className="text-xl font-bold text-slate-700 mb-3 border-b-2 border-orange-400 pb-1 tracking-wide">ENERGÍA</h2>
          <div className="grid grid-cols-3 grid-rows-2 gap-3 flex-1">
            {energiaEnPantalla.map((ups, index) => (
              <TarjetaEnergia key={`ups-${ups.id || index}`} datos={ups} />
            ))}
          </div>
        </div>

      </div>

      <ModalEquipos sala={salaSeleccionada} onClose={() => setSalaSeleccionada(null)} />
    </div>
  );
};

export default IcetelProgramaVista;
