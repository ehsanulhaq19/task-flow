"use client";

import { useEffect, useState } from "react";
import { getCaptureState, subscribeCapture, type CaptureState } from "@/services/screenCapture";

export function useScreenCapture() {
  const [state, setState] = useState<CaptureState>(getCaptureState);

  useEffect(() => {
    return subscribeCapture(setState);
  }, []);

  return state;
}
