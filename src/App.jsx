import React, { useState, useEffect } from 'react';

// --- CONFIGURACIÓN ---
// TODO: Reemplaza esta URL con el enlace web de tu Google Apps Script
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyqf0aKdc-ndKrSryz8a42Nl-aO-nkdiY3F4pn3VxgQeo4wkgwczpDZlNZCsEIVJu9z/exec'; 

// --- DATOS SIMULADOS (Mientras conectas la planilla) ---
const generarDatosClima = () => Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  nombre: `Sala ${i + 1}`,
  maximo: 85,
  temperatura: (Math.random() * 5 + 18).toFixed(1),
  humedad: Math.floor(Math.random() * 20 + 40),
  kw: (Math.random() * 30 + 10).toFixed(1),
  cargaTi: Math.floor(Math.random() * 100),
  condicion: 'Óptima'
}));

const generarDatosEnergia = () => Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  equipo: `UPS Central ${i + 1}`,
  kvaInicio: (Math.random() * 10 + 40).toFixed(1),
  porcentajeCarga: Math.floor(Math.random() * 100)
}));

// --- COMPONENTE: TARJETA CLIMA (Izquierda) ---
const TarjetaClima = ({ datos }) => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 flex flex-col justify-between h-full">
    <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-2">
      <h2 className="text-sm font-bold text-slate-800 truncate">{datos.nombre}</h2>
    </div>
    <div className="grid grid-cols-2 gap-2 mb-2">
      <div className="bg-blue-50 p-2 rounded-lg text-center">
        <p className="text-[10px] uppercase font-bold text-slate-400">T°</p>
        <p className="text-lg font-semibold text-blue-600">{datos.temperatura}°C</p>
      </div>
      <div className="bg-cyan-50 p-2 rounded-lg text-center">
        <p className="text-[10px] uppercase font-bold text-slate-400">H%</p>
        <p className="text-lg font-semibold text-cyan-600">{datos.humedad}%</p>
      </div>
      <div className="bg-purple-50 p-2 rounded-lg text-center">
        <p className="text-[10px] uppercase font-bold text-slate-400">Kw</p>
        <p className="text-lg font-semibold text-purple-600">{datos.kw}</p>
      </div>
      <div className="bg-orange-50 p-2 rounded-lg text-center">
        <p className="text-[10px] uppercase font-bold text-slate-400">Carga TI</p>
        <p className="text-lg font-semibold text-orange-600">{datos.cargaTi}%</p>
      </div>
    </div>
  </div>
);

// --- COMPONENTE: TARJETA ENERGÍA (Derecha) ---
const TarjetaEnergia = ({ datos }) => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col justify-between h-full">
    <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
      <h2 className="text-base font-bold text-slate-800 truncate">{datos.equipo}</h2>
    </div>
    <div className="grid grid-cols-2 gap-3 flex-grow">
      <div className="bg-indigo-50 flex flex-col items-center justify-center p-3 rounded-lg border border-indigo-100">
        <p className="text-xs uppercase font-bold text-slate-400 mb-1">KVA</p>
        <p className="text-2xl font-bold text-indigo-600">{datos.kvaInicio}</p>
      </div>
      <div className="bg-emerald-50 flex flex-col items-center justify-center p-3 rounded-lg border border-emerald-100">
        <p className="text-xs uppercase font-bold text-slate-400 mb-1">Carga</p>
        <p className="text-2xl font-bold text-emerald-600">{datos.porcentajeCarga}%</p>
      </div>
    </div>
  </div>
);

// --- VISTA PRINCIPAL ---
const IcetelProgramaVista = () => {
  const [datosClima, setDatosClima] = useState([]);
  const [datosEnergia, setDatosEnergia] = useState([]);
  const [paginaActual, setPaginaActual] = useState(0);

  // Efecto para cargar datos (Simulado por ahora)
  useEffect(() => {
    // Cuando tengas tu GAS_URL, reemplazarás esto con un fetch real
    setDatosClima(generarDatosClima());
    setDatosEnergia(generarDatosEnergia());
    
    const intervaloDatos = setInterval(() => {
      setDatosClima(generarDatosClima());
      setDatosEnergia(generarDatosEnergia());
    }, 15000);
    return () => clearInterval(intervaloDatos);
  }, []);

  // Efecto para paginación (cambia cada 30 segundos)
  useEffect(() => {
    const intervaloPagina = setInterval(() => {
      setPaginaActual((prev) => (prev === 0 ? 1 : 0));
    }, 30000);
    return () => clearInterval(intervaloPagina);
  }, []);

  const itemsPorPagina = 6;
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
            Mostrando grupo {paginaActual + 1} de 2
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

      {/* CONTENEDOR DIVIDIDO */}
      <div className="flex flex-1 flex-row gap-6 min-h-0">
        
        {/* IZQUIERDA: CLIMA */}
        <div className="flex-1 flex flex-col min-w-0">
          <h2 className="text-xl font-bold text-slate-700 mb-3 border-b-2 border-blue-400 pb-1">CLIMA</h2>
          <div className="grid grid-cols-3 grid-rows-2 gap-3 flex-1">
            {climaEnPantalla.map((sala) => (
              <TarjetaClima key={`clima-${sala.id}`} datos={sala} />
            ))}
          </div>
        </div>

        {/* DIVISOR CENTRAL */}
        <div className="w-1 bg-slate-200 rounded-full my-8"></div>

        {/* DERECHA: ENERGÍA */}
        <div className="flex-1 flex flex-col min-w-0">
          <h2 className="text-xl font-bold text-slate-700 mb-3 border-b-2 border-orange-400 pb-1">ENERGÍA</h2>
          <div className="grid grid-cols-3 grid-rows-2 gap-3 flex-1">
            {energiaEnPantalla.map((ups) => (
              <TarjetaEnergia key={`ups-${ups.id}`} datos={ups} />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default IcetelProgramaVista;
