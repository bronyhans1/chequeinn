import { useState, useEffect } from "react";
import * as Location from "expo-location";

export function useLocationPermission() {
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(({ status }) => {
      setGranted(status === "granted");
    });
  }, []);

  const request = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setGranted(status === "granted");
    return status === "granted";
  };

  return { granted, request };
}
