import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { CameraView, useCameraPermissions } from "expo-camera";
import { validateAttendanceQr } from "@/lib/api/attendance.api";
import { useThemePrefs } from "@/store/theme";
import { pressStyle } from "@/lib/pressFeedback";

export default function ScanScreen() {
  const router = useRouter();
  const { colors } = useThemePrefs();
  const [permission, requestPermission] = useCameraPermissions();
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const processingRef = useRef(false);
  const [scanProcessing, setScanProcessing] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === "granted");
    })();
  }, []);

  const onBarCodeScanned = useCallback(
    async (data: { data?: string }) => {
      if (processingRef.current) return;

      const qrCode = data?.data?.trim();
      if (!qrCode || !qrCode.startsWith("branch:")) {
        setError("Invalid QR code. Scan your office QR code (branch code).");
        return;
      }

      processingRef.current = true;
      setScanProcessing(true);
      setError(null);
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const res = await validateAttendanceQr({
          qr_code: qrCode,
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (res.success === false) {
          processingRef.current = false;
          setScanProcessing(false);
          setError(res.error ?? "Validation failed");
          return;
        }
        router.replace({
          pathname: "/attendance/check-in",
          params: {
            branchId: res.data.branch_id,
            branchName: res.data.name,
          },
        });
      } catch (e) {
        processingRef.current = false;
        setScanProcessing(false);
        setError(e instanceof Error ? e.message : "Validation failed");
      }
    },
    [router]
  );

  if (!permission?.granted) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <Text style={[styles.message, { color: colors.muted }]}>
            Camera access is required to scan office QR codes.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: colors.primary },
              pressStyle({ pressed }, { opacity: 0.9, scale: 0.98 }),
            ]}
            onPress={requestPermission}
          >
            <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Grant permission</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (locationPermission === false) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <Text style={[styles.message, { color: colors.muted }]}>
            Location is required to verify you are at your office.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.cameraArea}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={scanProcessing ? undefined : onBarCodeScanned}
        />
        {scanProcessing ? (
          <View style={[styles.processingOverlay, { backgroundColor: colors.overlayScrim }]} pointerEvents="none">
            <ActivityIndicator size="large" color={colors.onOverlay} />
            <Text style={[styles.processingText, { color: colors.onOverlay }]}>Checking office…</Text>
          </View>
        ) : null}
        {error ? (
          <View style={[styles.errorBox, { backgroundColor: colors.surfaceDanger, borderColor: colors.danger }]}>
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          </View>
        ) : null}
        <Text
          style={[
            styles.hint,
            { color: colors.onOverlay, textShadowColor: colors.hintShadow },
          ]}
        >
          Point your camera at your branch attendance QR code
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  cameraArea: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  camera: { flex: 1 },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  processingText: { marginTop: 12, fontSize: 16, fontWeight: "600" },
  message: { fontSize: 16, textAlign: "center", lineHeight: 22 },
  button: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: { fontWeight: "700" },
  errorBox: {
    position: "absolute",
    bottom: 100,
    left: 24,
    right: 24,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorText: { textAlign: "center", fontWeight: "600", fontSize: 14 },
  hint: {
    position: "absolute",
    bottom: 24,
    left: 24,
    right: 24,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
