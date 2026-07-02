import { createContext, useContext, useState } from "react";
import ContractDetailPanel from "../components/ui/ContractDetailPanel";

const ContractContext = createContext(null);

export function ContractProvider({ children }) {
  const [contract, setContract] = useState(null);

  return (
    <ContractContext.Provider value={{ openContract: setContract }}>
      {children}
      {contract && (
        <ContractDetailPanel
          contract={contract}
          onClose={() => setContract(null)}
        />
      )}
    </ContractContext.Provider>
  );
}

export function useContract() {
  return useContext(ContractContext);
}
