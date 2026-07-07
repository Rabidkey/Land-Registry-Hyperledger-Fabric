import React from "react";

export default function MapCluster({ selectedZone, onSelectZone, getZoneStatus, actor }) {
  
  const zonesData = [
    { id: "Block-A", d: "m910.966 426.444-278.385 41.194a20.001 20.001 0 0 1-19.603-8.742l-45.461-68.656a150.002 150.002 0 0 0-54.625-49.617l-167.598-89.147c-5.412-2.879-6.984-9.905-3.314-14.816l28.52-38.16h880.23c17.79 0 31.67 15.398 29.84 33.096l-49.28 475c-1.58 15.288-14.47 26.904-29.84 26.904H897.48c-19.69 0-34.041-18.647-29-37.681l64.747-244.47c3.678-13.887-8.05-27.008-22.261-24.905Z" },
    { id: "Block-B", d: "M1901.15 563.5h-588.54c-17.55 0-31.36-15.005-29.89-32.498l25.33-303.142c1.36-16.3 15.53-28.505 31.85-27.438l259.61 16.974c109.43 7.154 206.24 73.45 252.47 172.896l67.3 144.777c6.17 13.257-3.51 28.431-18.13 28.431Z" },
    { id: "Block-C", d: "m2020.85 684.331-201.02-391.533c-3.26-6.336.97-13.945 8.07-14.533l357.24-29.616a29.985 29.985 0 0 1 23.69 8.684l433.82 433.813c6.19 6.195 1.99 16.797-6.77 17.066l-546 16.828c-28.94.892-55.81-14.953-69.03-40.709Z" },
    { id: "Block-D", d: "m1147.28 1271.72 94.71-491.787c2.64-13.717 14.4-23.795 28.36-24.306l752.38-27.549a29.996 29.996 0 0 1 25.18 12.095l217.05 292.317c9.37 12.62 1.19 30.62-14.48 31.86l-161.57 12.77a299.744 299.744 0 0 0-71.06 14.41L1788 1168l-212.55 88.59a499.946 499.946 0 0 1-164.35 37.7l-232.68 13.05c-19.51 1.1-34.84-16.44-31.14-35.62Z" },
    { id: "Block-E", d: "m848.188 723.359 52.16-196.092c3.653-13.732-7.801-26.801-21.9-25.033C744.663 519.006 661.195 529.599 535.5 630.5c-49.012 48.586-70.751 81.758-81.705 125.923-6.639 26.769-19.933 51.868-41.75 68.74-88.378 68.346-133.894 114.2-202.689 186.097-5.547 5.8-10.392 12.26-14.359 19.23-51.301 90.2-77.855 151.4-104.202 233.77-11.573 36.19 6.848 75.74 43.361 86.23 87.543 25.15 156.558 16.39 264.344 1.51 152.107-36.72 236.805-51.9 387-67.5 117.147-4.21 189.002-.87 286.78 27.1 26.03 7.45 52.72-11.29 53.59-38.35 6.03-187.05 25.58-307.381 85.67-484.597 6.66-19.63-7.82-40.153-28.54-40.153H867.515c-13.135 0-22.704-12.447-19.327-25.141Z" }
  ];

  return (
    <svg 
      viewBox="0 0 2754 1536" 
      preserveAspectRatio="xMidYMid slice" 
      className="w-full h-full absolute inset-0 drop-shadow-2xl z-10"
    >
      
      {zonesData.map((zone) => {
        const status = getZoneStatus(zone.id);
        
        let isVisible = true;
        let fillClass = "";
        let strokeClass = "";

        // LOGIKA VISIBILITAS SESUAI PERAN (ACTOR)
        if (status === "Belum Diterbitkan") {
          if (actor !== "dev") {
            isVisible = false; // Selain Dev: Hilang Total
          } else {
            // Khusus Dev: Tembus pandang, hanya muncul garis tipis pas di-hover
            fillClass = "fill-transparent hover:fill-slate-500/20";
            strokeClass = "stroke-transparent hover:stroke-slate-400/50";
          }
        } else {
          // Kalau udah diterbitin, semua orang bisa liat garisnya nyala
          fillClass = "fill-emerald-500/10 hover:fill-emerald-500/30 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]";
          strokeClass = "stroke-emerald-400";
        }

        // Kalau isVisible false (Bukan dev dan belum terbit), jangan di-render sama sekali
        if (!isVisible) return null;

        return (
          <path
            key={zone.id}
            id={zone.id}
            d={zone.d}
            onClick={() => onSelectZone(zone.id)}
            className={`transition-all duration-500 cursor-pointer stroke-[3px] ${fillClass} ${strokeClass} ${
              selectedZone === zone.id ? "stroke-white stroke-[5px] fill-white/20" : ""
            }`} 
          />
        );
      })}
    </svg>
  );
}