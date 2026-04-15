import React, { createContext, useContext, useState, ReactNode } from "react";

export type UnitType = "lab" | "ocp";

interface UnitContextType {
  unit: UnitType;
  setUnit: (unit: UnitType) => void;
  unitLabel: string;
  unitColor: string;
}

const UnitContext = createContext<UnitContextType>({
  unit: "lab",
  setUnit: () => {},
  unitLabel: "Laboratório",
  unitColor: "#660000",
});

export const useUnit = () => useContext(UnitContext);

export const UnitProvider = ({ children }: { children: ReactNode }) => {
  const [unit, setUnit] = useState<UnitType>("lab");

  const unitLabel = unit === "lab" ? "Laboratório" : "Certificadora OCP";
  const unitColor = unit === "lab" ? "#660000" : "#008080";

  return (
    <UnitContext.Provider value={{ unit, setUnit, unitLabel, unitColor }}>
      <div className={unit === "lab" ? "theme-lab" : "theme-ocp"}>
        {children}
      </div>
    </UnitContext.Provider>
  );
};
