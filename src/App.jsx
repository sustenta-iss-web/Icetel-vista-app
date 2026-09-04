import React, { useState, useEffect, useCallback } from 'react';

// --- CONFIGURACIÓN ---
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyqf0aKdc-ndKrSryz8a42Nl-aO-nkdiY3F4pn3VxgQeo4wkgwczpDZlNZCsEIVJu9z/exec';
const SALAS_POR_PAGINA = 10;
const INTERVALO_DATOS_MS = 15000; // refresca datos cada 15s
const INTERVALO_PAGINA_MS = 30000; // cambia de página cada 30s

// --- HELPERS DE FORMATO (para campos que aún no existen en la planilla) ---
const fmt = (valor, sufijo = '') => (valor === null || valor === undefined ? '—' : `${valor}${sufijo}`);

// --- COMPONENTE DE TARJETA (KPI) ---
const TarjetaSala = ({ datos, onClick }) => {
  const obtenerEstiloCondicion = (condicion) => {
    switch (condicion) {
      case 'Óptima': return 'bg-green-100 text-green-700 border-green-200';
      case 'Alerta': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Crítica': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-500 border-gray-200';
    }
  };

  return (
    <button
      onClick={() => onClick(datos)}
      className="bg-white rounded-xl shadow-sm border border-slate-200 p-2.5 flex flex-col h-full transition-shadow hover:shadow-md text-left cursor-pointer overflow-hidden"
    >
      <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-1.5 shrink-0">
        <h2 className="text-sm font-bold text-slate-800 truncate">{datos.nombre}</h2>
        <div className="text-[10px] font-medium text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded-md whitespace-nowrap">
          Máx: <span className="text-slate-700 font-bold">{fmt(datos.maximo)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2 flex-1 min-h-0">
        <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100/50 flex flex-col justify-center">
          <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">T°</p>
          <p className="text-2xl font-bold text-blue-600">{fmt(datos.temperatura, '°C')}</p>
        </div>
        <div className="bg-cyan-50/50 p-2 rounded-lg border border-cyan-100/50 flex flex-col justify-center">
          <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">H%</p>
          <p className="text-2xl font-bold text-cyan-600">{fmt(datos.humedad, '%')}</p>
        </div>
        <div className="bg-purple-50/50 p-2 rounded-lg border border-purple-100/50 flex flex-col justify-center">
          <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Kw</p>
          <p className="text-2xl font-bold text-purple-600">{fmt(datos.kw)}</p>
        </div>
        <div className="bg-orange-50/50 p-2 rounded-lg border border-orange-100/50 flex flex-col justify-center">
          <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Carga TI</p>
          <p className="text-2xl font-bold text-orange-600">{fmt(datos.cargaTi, '%')}</p>
        </div>
      </div>

      <div className={`shrink-0 text-center py-1.5 rounded-md text-xs font-bold border ${obtenerEstiloCondicion(datos.condicion)}`}>
        {datos.condicion || 'Sin datos'}
      </div>
    </button>
  );
};

// --- MODAL DE EQUIPOS DE UNA SALA ---
const ModalEquipos = ({ sala, onClose }) => {
  if (!sala) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-5 border-b border-slate-100">
          <div>
            <h3 className="text-xl font-bold text-slate-800">{sala.nombre}</h3>
            <p className="text-sm text-slate-500">{sala.equipos.length} equipo(s) registrado(s)</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none px-2"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-3">
          {sala.equipos.length === 0 && (
            <p className="text-slate-400 text-sm">No hay equipos registrados para esta sala.</p>
          )}
          {sala.equipos.map((eq, i) => {
            const estadoOk = !eq.estado || eq.estado.toUpperCase() === 'OK';
            const tieneAlarma = eq.alarmas && eq.alarmas > 0;
            return (
              <div key={i} className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium text-slate-700">{eq.nombre}</span>
                    {eq.tipo && <span className="ml-2 text-xs text-slate-400">({eq.tipo})</span>}
                  </div>
                  <div className="flex gap-3 text-sm">
                    <span className="text-blue-600 font-semibold">{fmt(eq.temperatura, '°C')}</span>
                    <span className="text-cyan-600 font-semibold">{fmt(eq.humedad, '%')}</span>
                  </div>
                </div>
                {(eq.estado || tieneAlarma) && (
                  <div className="mt-2 flex gap-2">
                    {eq.estado && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${estadoOk ? 'bg-green-100 text-green-700 border-green-200' : 'bg-yellow-100 text-yellow-700 border-yellow-200'}`}>
                        {eq.estado}
                      </span>
                    )}
                    {tieneAlarma && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md border bg-red-100 text-red-700 border-red-200">
                        {eq.alarmas} alarma(s)
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// --- VISTA PRINCIPAL (DASHBOARD) ---
const IcetelProgramaVista = () => {
  const [salas, setSalas] = useState([]);
  const [paginaActual, setPaginaActual] = useState(0);
  const [salaSeleccionada, setSalaSeleccionada] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargarDatos = useCallback(async () => {
    try {
      const res = await fetch(GAS_URL);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Error desconocido del backend');
      setSalas(json.salas || []);
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

  const totalPaginas = Math.max(1, Math.ceil(salas.length / SALAS_POR_PAGINA));

  // Si cambia el número de salas y la página actual queda fuera de rango, la corrige
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

  const indiceInicio = paginaActual * SALAS_POR_PAGINA;
  const indiceFin = indiceInicio + SALAS_POR_PAGINA;
  const salasEnPantalla = salas.slice(indiceInicio, indiceFin);

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50 p-4 flex flex-col font-sans">
      <header className="mb-3 flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Icetel Visualización</h1>
          <p className="text-slate-500 text-sm font-medium mt-0.5 transition-all">
            {salas.length > 0
              ? `Mostrando salas ${indiceInicio + 1} a ${Math.min(indiceFin, salas.length)} de ${salas.length}`
              : cargando ? 'Cargando datos...' : 'Sin salas para mostrar'}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="relative flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${error ? 'bg-red-400' : 'bg-green-400'} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${error ? 'bg-red-500' : 'bg-green-500'}`}></span>
          </span>
          <span className="text-sm font-bold text-slate-600">{error ? 'Error de datos' : 'Sistema Activo'}</span>
        </div>
      </header>

      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-2 shrink-0">
          No se pudieron cargar los datos de la planilla: {error}
        </div>
      )}

      <div className="grid grid-cols-5 grid-rows-2 gap-3 flex-1 min-h-0">
        {salasEnPantalla.map((sala) => (
          <TarjetaSala key={sala.id} datos={sala} onClick={setSalaSeleccionada} />
        ))}
      </div>

      <ModalEquipos sala={salaSeleccionada} onClose={() => setSalaSeleccionada(null)} />
    </div>
  );
};

export default IcetelProgramaVista;
