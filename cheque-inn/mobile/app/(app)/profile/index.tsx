import { useEffect, useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Pressable,
  Alert,
  ActionSheetIOS,
  Platform,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { mobileSupabase, useAuth } from "@/store/auth";
import { updateMyProfile, markPasswordChanged } from "@/lib/api/auth.api";
import { isApiError } from "@/types/api";
import { useThemePrefs } from "@/store/theme";
import { getAuthToken, getRefreshToken } from "@/lib/api/client";
import { uploadProfilePhotoFromUri } from "@/lib/profilePhotoUpload";
import { ProfileCompletionChecklist } from "@/components/ProfileCompletionChecklist";
import type { ChecklistItem } from "@/components/ProfileCompletionChecklist";

const GENDER_CHIPS = [
  { value: "", label: "Not specified" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuth();
  const { preference, setPreference, colors } = useThemePrefs();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  /** Local image pending upload (preview) */
  const [pendingLocalUri, setPendingLocalUri] = useState<string | null>(null);
  const [pendingMime, setPendingMime] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const avatarScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName ?? "");
    setLastName(user.lastName ?? "");
    setPhone(user.phoneNumber ?? "");
    setDob(user.dateOfBirth ?? "");
    setGender(user.gender ?? "");
    setPhotoUrl(user.profilePhotoUrl ?? "");
    setPendingLocalUri(null);
    setPendingMime(null);
  }, [user]);

  const checklistItems = useMemo((): ChecklistItem[] => {
    if (!user) return [];
    const c = user.profileCompletion;
    const requiredDone = !c.missingRequiredFields.includes("password");
    const dobDone = !c.missingRequiredFields.includes("date_of_birth");
    const phoneDone = !c.recommendedMissingFields.includes("phone_number");
    const genderDone = !c.recommendedMissingFields.includes("gender");
    const photoDone = !c.recommendedMissingFields.includes("profile_photo_url");
    return [
      { key: "password", label: "Password updated", required: true, done: requiredDone },
      { key: "dob", label: "Date of birth added", required: true, done: dobDone },
      { key: "phone", label: "Phone number", required: false, done: phoneDone },
      { key: "gender", label: "Gender", required: false, done: genderDone },
      { key: "photo", label: "Profile photo", required: false, done: photoDone },
    ];
  }, [user]);

  const completionBlocking = !!(user?.profileCompletion && !user.profileCompletion.requiredComplete);

  async function handleLogout() {
    await logout();
    router.replace("/(auth)/login");
  }

  async function pickFromLibrary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Photo library permission is required.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setPendingLocalUri(a.uri);
    setPendingMime(a.mimeType ?? "image/jpeg");
    setError(null);
    setMessage(null);
  }

  async function pickFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError("Camera permission is required to take a photo.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setPendingLocalUri(a.uri);
    setPendingMime(a.mimeType ?? "image/jpeg");
    setError(null);
    setMessage(null);
  }

  function openPhotoPicker() {
    const title = "Profile photo";
    const message = "Choose a source for your profile picture.";
    const onLibrary = () => {
      void pickFromLibrary();
    };
    const onCamera = () => {
      void pickFromCamera();
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title,
          message,
          options: ["Cancel", "Choose from library", "Take photo"],
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx === 1) onLibrary();
          if (idx === 2) onCamera();
        }
      );
    } else {
      Alert.alert(title, message, [
        { text: "Cancel", style: "cancel" },
        { text: "Choose from library", onPress: onLibrary },
        { text: "Take photo", onPress: onCamera },
      ]);
    }
  }

  function handleClearPhoto() {
    if (pendingLocalUri) {
      setPendingLocalUri(null);
      setPendingMime(null);
      return;
    }
    setPhotoUrl("");
  }

  async function handleSaveProfile() {
    setError(null);
    setMessage(null);
    setSaving(true);

    let finalPhotoUrl = photoUrl.trim() || null;

    if (pendingLocalUri && user?.userId) {
      setUploadingPhoto(true);
      const up = await uploadProfilePhotoFromUri(pendingLocalUri, user.userId, pendingMime);
      setUploadingPhoto(false);
      if ("error" in up) {
        setError(up.error);
        setSaving(false);
        return;
      }
      finalPhotoUrl = up.publicUrl;
      setPhotoUrl(up.publicUrl);
      setPendingLocalUri(null);
      setPendingMime(null);
    }

    const res = await updateMyProfile({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone_number: phone.trim() || null,
      date_of_birth: dob.trim() || null,
      gender: (gender || null) as "male" | "female" | "other" | "prefer_not_to_say" | null,
      profile_photo_url: finalPhotoUrl,
      theme_preference: preference,
    });
    if (isApiError(res)) {
      setError(res.error ?? "Failed to save profile");
      setSaving(false);
      return;
    }

    if (newPassword.trim()) {
      if (!mobileSupabase) {
        setError("Cannot update password: Supabase not configured.");
        setSaving(false);
        return;
      }
      // Ensure the shared Supabase client has an active session before updateUser.
      const current = await mobileSupabase.auth.getSession();
      if (!current.data.session) {
        const access = await getAuthToken();
        const refresh = await getRefreshToken();
        if (access && refresh) {
          const setRes = await mobileSupabase.auth.setSession({
            access_token: access,
            refresh_token: refresh,
          });
          if (setRes.error) {
            setError(setRes.error.message);
            setSaving(false);
            return;
          }
        }
      }
      const { error: passErr } = await mobileSupabase.auth.updateUser({
        password: newPassword.trim(),
      });
      if (passErr) {
        setError(passErr.message);
        setSaving(false);
        return;
      }
      await markPasswordChanged();
      setNewPassword("");
    }

    await refreshUser();
    setMessage("Profile updated.");
    setSaving(false);
  }

  const displayName = [firstName, lastName].filter(Boolean).join(" ") || "Your profile";

  const avatarSource = pendingLocalUri
    ? { uri: pendingLocalUri }
    : photoUrl
      ? { uri: photoUrl }
      : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.screenTitle, { color: colors.text }]}>Profile</Text>
        <Text style={[styles.email, { color: colors.muted }]}>{user?.email ?? ""}</Text>

        {user && (user.companyName || user.branchName || user.department) ? (
          <View style={[styles.identityCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Text style={[styles.identityTitle, { color: colors.text }]}>Work</Text>
            {user.companyName ? (
              <Text style={[styles.identityLine, { color: colors.muted }]}>{user.companyName}</Text>
            ) : null}
            {user.branchName ? (
              <Text style={[styles.identityLine, { color: colors.muted }]}>Branch: {user.branchName}</Text>
            ) : null}
            {user.department?.name ? (
              <Text style={[styles.identityLine, { color: colors.muted }]}>
                Department: {user.department.name}
              </Text>
            ) : null}
            <Text style={[styles.identityRoles, { color: colors.muted }]}>
              {user.roles?.join(", ") ?? ""}
            </Text>
          </View>
        ) : null}

        {user ? (
          <ProfileCompletionChecklist
            colors={colors}
            items={checklistItems}
            title={completionBlocking ? "Finish setting up your profile" : "Profile checklist"}
            subtitle={
              completionBlocking
                ? "We’ll help you knock out the essentials — it only takes a minute."
                : "Optional items help colleagues recognize you."
            }
          />
        ) : null}

        {completionBlocking ? (
          <View style={[styles.hintBanner, { borderColor: colors.border, backgroundColor: colors.surfaceWarning }]}>
            <Ionicons name="information-circle-outline" size={22} color={colors.primary} />
            <Text style={[styles.hintText, { color: colors.text }]}>
              Complete the required items below so you can use the full app.
            </Text>
          </View>
        ) : null}

        {error ? (
          <View
            style={[
              styles.feedback,
              styles.feedbackRow,
              { backgroundColor: colors.surfaceDanger, borderColor: colors.danger },
            ]}
          >
            <Ionicons name="alert-circle" size={20} color={colors.danger} style={{ marginTop: 2 }} />
            <Text style={[styles.feedbackText, styles.feedbackTextFlex, { color: colors.danger }]}>{error}</Text>
          </View>
        ) : null}
        {message ? (
          <View style={[styles.feedback, { backgroundColor: colors.surfaceMuted, borderColor: colors.success }]}>
            <Text style={[styles.feedbackText, { color: colors.success }]}>{message}</Text>
          </View>
        ) : null}

        {/* Personal */}
        <Text style={[styles.sectionHeading, { color: colors.muted }]}>Personal info</Text>
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={styles.avatarRow}>
            <Pressable
              onPress={openPhotoPicker}
              onPressIn={() => {
                Animated.spring(avatarScale, {
                  toValue: 0.96,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(avatarScale, {
                  toValue: 1,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              accessibilityLabel="Change profile photo"
            >
              <Animated.View style={[styles.avatarWrap, { borderColor: colors.border, transform: [{ scale: avatarScale }] }]}>
                {avatarSource ? (
                  <Image source={avatarSource} style={styles.avatarImg} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surfaceMuted }]}>
                    <Text style={[styles.avatarLetter, { color: colors.primary }]}>
                      {displayName.charAt(0).toUpperCase() || "?"}
                    </Text>
                  </View>
                )}
                {uploadingPhoto ? (
                  <View style={[styles.avatarLoading, { backgroundColor: colors.overlayScrim }]}>
                    <ActivityIndicator color={colors.onOverlay} />
                  </View>
                ) : null}
              </Animated.View>
            </Pressable>
            <View style={styles.avatarActions}>
              <Text style={[styles.avatarHint, { color: colors.text }]}>{displayName}</Text>
              <Text style={[styles.avatarSub, { color: colors.muted }]}>
                Tap your photo to open the gallery or camera. Changes are saved when you tap Save profile.
              </Text>
              {pendingLocalUri || photoUrl ? (
                <View style={styles.avatarBtnRow}>
                  <Pressable
                    onPress={handleClearPhoto}
                    style={({ pressed }) => [
                      styles.chipGhost,
                      { borderColor: colors.border },
                      { opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Text style={[styles.chipTextGhost, { color: colors.muted }]}>
                      {pendingLocalUri ? "Discard selection" : "Remove photo"}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
          <Field label="First name" value={firstName} onChangeText={setFirstName} colors={colors} />
          <Field label="Last name" value={lastName} onChangeText={setLastName} colors={colors} />
          <Field
            label="Telephone"
            value={phone}
            onChangeText={setPhone}
            colors={colors}
            keyboardType="phone-pad"
          />
          <Field
            label="Date of birth (YYYY-MM-DD)"
            value={dob}
            onChangeText={(value) => setDob(formatDateInput(value))}
            colors={colors}
            keyboardType="number-pad"
            maxLength={10}
            placeholder="YYYY-MM-DD"
          />

          <Text style={[styles.fieldLabel, { color: colors.muted }]}>Gender</Text>
          <View style={styles.genderRow}>
            {GENDER_CHIPS.map((o) => {
              const selected = gender === o.value;
              return (
                <TouchableOpacity
                  key={`gender-${o.value || "none"}`}
                  onPress={() => setGender(o.value)}
                  style={[
                    styles.genderChip,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.surfaceMuted : "transparent",
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: selected ? colors.primary : colors.text,
                      fontWeight: selected ? "700" : "500",
                      fontSize: 13,
                    }}
                  >
                    {o.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Settings */}
        <Text style={[styles.sectionHeading, { color: colors.muted }]}>Settings</Text>
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={[styles.settingsLabel, { color: colors.text }]}>Appearance</Text>
          <View style={styles.row}>
            {(["light", "dark", "system"] as const).map((opt) => (
              <TouchableOpacity
                key={opt}
                onPress={() => setPreference(opt)}
                style={[
                  styles.themePill,
                  preference === opt
                    ? { backgroundColor: colors.primary }
                    : { borderColor: colors.border, borderWidth: 1 },
                ]}
              >
                <Text
                  style={{
                    color: preference === opt ? colors.onPrimary : colors.text,
                    fontWeight: "600",
                    textTransform: "capitalize",
                  }}
                >
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.separator, { backgroundColor: colors.border }]} />

          <Text style={[styles.settingsLabel, { color: colors.text }]}>Security</Text>
          <Text style={[styles.fieldLabel, { color: colors.muted }]}>New password</Text>
          <View style={styles.passwordInputWrap}>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Leave blank to keep current password"
              placeholderTextColor={colors.muted}
              style={[
                styles.input,
                styles.passwordFullInput,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceMuted,
                  color: colors.text,
                },
              ]}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.passwordEyeInline}
              hitSlop={8}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={22}
                color={colors.muted}
              />
            </TouchableOpacity>
          </View>
          <Text style={[styles.helper, { color: colors.muted }]}>
            Update only when needed. Saving with a new password marks it as updated.
          </Text>

        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }, (saving || uploadingPhoto) && { opacity: 0.85 }]}
          onPress={() => void handleSaveProfile()}
          disabled={saving || uploadingPhoto}
          activeOpacity={0.9}
        >
          {saving || uploadingPhoto ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Save profile</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.buttonSecondary, { borderColor: colors.border }]}
          onPress={handleLogout}
        >
          <Text style={[styles.buttonTextSecondary, { color: colors.muted }]}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function Field({
  label,
  colors,
  ...props
}: React.ComponentProps<typeof TextInput> & {
  label: string;
  colors: import("@/store/theme").ThemePalette;
}) {
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.muted}
        style={[
          styles.input,
          {
            borderColor: colors.border,
            backgroundColor: colors.surfaceMuted,
            color: colors.text,
          },
          props.style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },
  screenTitle: { fontSize: 24, fontWeight: "800" },
  email: { fontSize: 15, marginTop: 6 },
  identityCard: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  identityTitle: { fontSize: 14, fontWeight: "700", marginBottom: 6 },
  identityLine: { fontSize: 14, marginTop: 2 },
  identityRoles: { fontSize: 12, marginTop: 8, fontWeight: "600" },
  hintBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  hintText: { flex: 1, fontSize: 14, lineHeight: 20 },
  feedback: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  feedbackText: { fontSize: 14, fontWeight: "600" },
  sectionHeading: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 20,
    marginBottom: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  avatarRow: { flexDirection: "row", gap: 14, marginBottom: 8 },
  avatarWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: { fontSize: 32, fontWeight: "800" },
  avatarLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  feedbackRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  feedbackTextFlex: { flex: 1 },
  avatarActions: { flex: 1, justifyContent: "center" },
  avatarHint: { fontSize: 16, fontWeight: "700" },
  avatarSub: { fontSize: 12, marginTop: 4, lineHeight: 18 },
  avatarBtnRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chipGhost: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chipTextGhost: { fontSize: 13, fontWeight: "600" },
  fieldLabel: { fontWeight: "600", marginBottom: 6, fontSize: 13 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  genderRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  genderChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 8 },
  settingsLabel: { fontSize: 15, fontWeight: "700", marginTop: 2 },
  separator: { height: 1, marginTop: 14, marginBottom: 14 },
  themePill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  passwordInputWrap: { position: "relative", marginTop: 2 },
  passwordFullInput: { paddingRight: 48, marginTop: 0 },
  passwordEyeInline: {
    position: "absolute",
    right: 12,
    top: 12,
  },
  helper: { fontSize: 12, marginTop: 8, lineHeight: 18 },
  button: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    minHeight: 50,
    justifyContent: "center",
  },
  buttonText: { fontWeight: "700", fontSize: 16 },
  buttonSecondary: {
    marginTop: 10,
    borderWidth: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonTextSecondary: { fontWeight: "700", fontSize: 16 },
});
