import { useEffect } from "react";
import { Tabs } from "expo-router";
import { usePathname, useRouter } from "expo-router";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/store/auth";
import { useThemePrefs } from "@/store/theme";
import { AppTopBar } from "@/components/AppTopBar";

type IconProps = { color: string; size: number; focused: boolean };

function TabIcon({
  focused,
  color,
  size,
  active,
  inactive,
}: IconProps & {
  active: keyof typeof Ionicons.glyphMap;
  inactive: keyof typeof Ionicons.glyphMap;
}) {
  return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
}

export default function AppLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { user, isLoading, platformAdminWebOnly } = useAuth();
  const { colors, mode } = useThemePrefs();

  useEffect(() => {
    if (isLoading) return;
    if (platformAdminWebOnly) {
      router.replace("/(auth)/platform-admin-web-only");
      return;
    }
    if (!user) {
      router.replace("/(auth)/login");
      return;
    }
    const mustComplete =
      user.profileCompletion && !user.profileCompletion.requiredComplete;
    if (mustComplete && !pathname.includes("/profile")) {
      router.replace("/profile");
    }
  }, [user, isLoading, platformAdminWebOnly, router, pathname]);

  if (platformAdminWebOnly) return null;
  if (!user && !isLoading) return null;

  const tabBarStyleIOS = {
    paddingTop: 6,
    // Do not set paddingBottom: it must stay as insets.bottom from the navigator (a flat 6px
    // override sat inside a bar whose height still included the full inset, which skews Android).
    backgroundColor: colors.tabBar,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: mode === "dark" ? 0.35 : 0.07,
    shadowRadius: 10,
    elevation: mode === "dark" ? 18 : 10,
  };

  const tabBarStyleAndroid = {
    ...tabBarStyleIOS,
    paddingTop: 4,
    height: 54 + insets.bottom,
    paddingBottom: insets.bottom,
  };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle:
          Platform.OS === "android"
            ? { fontSize: 11, fontWeight: "600", marginBottom: 2 }
            : { fontSize: 11, fontWeight: "600", marginBottom: 4 },
        tabBarStyle: Platform.OS === "android" ? tabBarStyleAndroid : tabBarStyleIOS,
        tabBarIconStyle: Platform.OS === "android" ? undefined : { marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          header: () => <AppTopBar feature="Home" />,
          title: "",
          tabBarLabel: "Home",
          tabBarIcon: (props) => (
            <TabIcon {...props} active="home" inactive="home-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          header: () => <AppTopBar feature="Attendance" />,
          title: "",
          tabBarLabel: "Attendance",
          tabBarIcon: (props) => (
            <TabIcon {...props} active="time" inactive="time-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="leave/index"
        options={{
          header: () => <AppTopBar feature="Leave" />,
          title: "",
          tabBarLabel: "Leave",
          tabBarIcon: (props) => (
            <TabIcon {...props} active="calendar" inactive="calendar-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="history/index"
        options={{
          header: () => <AppTopBar feature="History" />,
          title: "",
          tabBarLabel: "History",
          tabBarIcon: (props) => (
            <TabIcon {...props} active="list" inactive="list-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          header: () => <AppTopBar feature="Profile" />,
          title: "",
          tabBarLabel: "Profile",
          tabBarIcon: (props) => (
            <TabIcon {...props} active="person" inactive="person-outline" />
          ),
        }}
      />
      <Tabs.Screen name="approvals/index" options={{ href: null }} />
      <Tabs.Screen name="team/index" options={{ href: null }} />
      <Tabs.Screen name="payslips/index" options={{ href: null }} />
      <Tabs.Screen
        name="notifications/index"
        options={{
          href: null,
          title: "",
          header: () => <AppTopBar feature="Notifications" />,
        }}
      />
    </Tabs>
  );
}
