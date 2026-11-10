"use client";

import { useEffect, useRef } from "react";
import { Provider } from "react-redux";
import Loader from "@/components/Loader";
import { hydrateWorkspace } from "@/store/hydrate";
import { store, useAppDispatch, useAppSelector } from "@/store/store";

function PersistGate({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const hydrated = useAppSelector((state) => state.auth.hydrated);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    dispatch(hydrateWorkspace());
  }, [dispatch]);

  if (!hydrated) return <Loader />;
  return <>{children}</>;
}

export default function StoreProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <PersistGate>{children}</PersistGate>
    </Provider>
  );
}
