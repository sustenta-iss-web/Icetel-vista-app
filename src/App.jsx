import React, { useState, useEffect } from 'react';

// --- DATOS DE PRUEBA (MOCK DATA) ---
const generarDatosSalas = () => {
  return Array.from({ length: 19 }, (_, i) => ({
    id: i + 1,
    nombre: `Sala ${i + 1}`,
    maximo: Math.floor(Math.random() * 100) + 50,
    temperatura: (Math.random() * 10 + 18).toFixed(1), 
    humedad: Math.floor(Math.random() * 20 + 40), 
    kw: (Math.random() * 50 + 10).toFixed(2),
    cargaTi: Math.floor(Math.random() * 100),
    condicion: ['Óptima', 'Alerta', 'Crítica'][Math.floor(Math.random() * 3)]
  }));
};

// --- COMPONENTE DE TARJETA (KPI) ---
const TarjetaSala = ({ datos }) => {
  const obtenerEstiloCondicion = (condicion) => {
    switch (condicion) {
      case 'Óptima': return 'bg-green-100 text-green-700 border-green-200';
      case 'Alerta': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Crítica': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between h-full transition-shadow hover:shadow-md">
      <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
        <h2 className="text-xl font-bold text-slate-800">{datos.nombre}</h2>
        <div className="text-sm font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded-md">
          Máx: <span className="text-slate-700 font-bold">{datos.maximo}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100/50">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">T° (Temp)</p>
          <p className="text-lg font-semibold text-blue-600">{datos.temperatura}°C</p>
        </div>
        <div className="bg-cyan-50/50 p-3 rounded-xl border border-cyan-100/50">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">H% (Humedad)</p>
          <p className="text-lg font-semibold text-cyan-600">{datos.humedad}%</p>
        </div>
        <div className="bg-purple-50/50 p-3 rounded-xl border border-purple-100/50">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Kw (Frigorífico)</p>
          <p className="text-lg font-semibold text-purple-600">{datos.kw}</p>
        </div>
        <div className="bg-orange-50/50 p-3 rounded-xl border border-orange-100/50">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Carga TI</p>
          <p className="text-lg font-semibold text-orange-600">{datos.cargaTi}%</p>
        </div>
      </div>

      <div className={`mt-auto text-center py-2 rounded-lg text-sm font-bold border ${obtenerEstiloCondicion(datos.condicion)}`}>
        Condición: {datos.condicion}
      </div>
    </div>
  );
};

// --- VISTA PRINCIPAL (DASHBOARD) ---
const IcetelProgramaVista = () => {
  const [salas, setSalas] = useState([]);
  const [paginaActual, setPaginaActual] = useState(0); // 0 = Salas 1-10, 1 = Salas 11-19

  useEffect(() => {
    // Carga inicial de datos
    setSalas(generarDatosSalas());
    
    // Temporizador para actualizar los DATOS cada 10 segundos
    const intervaloDatos = setInterval(() => {
      setSalas(generarDatosSalas());
    }, 10000); 

    return () => clearInterval(intervaloDatos);
  }, []);

  useEffect(() => {
    // Temporizador para cambiar la PÁGINA cada 30 segundos
    const intervaloPagina = setInterval(() => {
      setPaginaActual((paginaAnterior) => (paginaAnterior === 0 ? 1 : 0));
    }, 30000); // 30000 milisegundos = 30 segundos

    return () => clearInterval(intervaloPagina);
  }, []);

  // Lógica de paginación
  const salasPorPagina = 10;
  const indiceInicio = paginaActual * salasPorPagina;
  const indiceFin = indiceInicio + salasPorPagina;
  const salasEnPantalla = salas.slice(indiceInicio, indiceFin);

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col font-sans">
      <header className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Icetel Visualización</h1>
          <p className="text-slate-500 font-medium mt-1 transition-all">
            Mostrando salas {indiceInicio + 1} a {Math.min(indiceFin, salas.length)} de {salas.length}
          </p>
        </div>
        <div className="flex items-center space-x-2">
           <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <span className="text-sm font-bold text-slate-600">Sistema Activo</span>
        </div>
      </header>

      {/* Grid de 10 tarjetas: 5 columnas en pantallas grandes (5 arriba, 5 abajo) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5 flex-grow content-start">
        {salasEnPantalla.map((sala) => (
          <TarjetaSala key={sala.id} datos={sala} />
        ))}
      </div>
    </div>
  );
};

export default IcetelProgramaVista;
