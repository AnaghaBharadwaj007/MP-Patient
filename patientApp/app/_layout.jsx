import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          animation: "fade", // Apply fade animation to all screens in the stack
          headerShown: false,
        }}
      >
        {/* Make index.jsx as first screen */}
        <Stack.Screen name="index" />

        {/* Other screens for login and signup */}
        <Stack.Screen name="Signin" />
        <Stack.Screen name="Signup" />
        <Stack.Screen name="Profile" />

        {/* Tabs screen */}
        <Stack.Screen name="(tabs)" />

        {/* Other screens */}
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal" }}
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
