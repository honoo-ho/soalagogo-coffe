"use client";

import { createContext, useContext } from "react";
import { toko } from "@/lib/toko";

const PengaturanTokoContext = createContext(toko);

export function PengaturanTokoProvider({ children, pengaturan }) {
  return (
    <PengaturanTokoContext.Provider value={pengaturan ?? toko}>
      {children}
    </PengaturanTokoContext.Provider>
  );
}

export function usePengaturanToko() {
  return useContext(PengaturanTokoContext);
}
