import React, { createContext, useContext, useState, ReactNode } from "react";

export type UnitType = "lab" | "ocp";

interface UnitContextType {
  unit: UnitType;
  setUnit: (unit: UnitType) => void;
  unitLabel: string;
  unitColor: string;
  responsaveis: Record<string, { nome: string; email: string }>;
}

const defaultResp = {
  portaria_145_2022: { nome: "Eloisa", email: "" },
  endotoxina_esterilidade: { nome: "Kevin", email: "" },
  mri_iso10993: { nome: "Ana Beatriz", email: "" },
  portaria_384_2020: { nome: "Ana Carolina", email: "" },
  portaria_071_2022: { nome: "", email: "" },
  portaria_501_2021: { nome: "", email: "" },
};

function loadResp() {
  try { return JSON.parse(localStorage.getItem("area_config") || "{}"); } catch { return {}; }
}

const UnitContext = createContext<UnitContextType>({
  unit: "lab",
  setUnit: () => {},
  unitLabel: "Laboratório",
  unitColor: "#6B0000",
  responsaveis: defaultResp,
});

export const useUnit = () => useContext(UnitContext);

export const UnitProvider = ({ children }: { children: ReactNode }) => {
  const [unit, setUnit] = useState<UnitType>("lab");
  const stored = loadResp();
  const responsaveis = { ...defaultResp, ...stored };
  const unitLabel = unit === "lab" ? "Laboratório" : "Certificadora OCP";
  const unitColor = unit === "lab" ? "#6B0000" : "#0F4C8A";

  return (
    <UnitContext.Provider value={{ unit, setUnit, unitLabel, unitColor, responsaveis }}>
      {children}
    </UnitContext.Provider>
  );
};
