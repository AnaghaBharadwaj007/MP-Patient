import { Tabs } from "expo-router";
import React from "react";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import "../../global.css";

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="Dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="house.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="Device"
        options={{
          title: "Device",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="cpu.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="Medication"
        options={{
          title: "Medication",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="cross.case.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="Activity"
        options={{
          title: "Activity",
          tabBarIcon: ({ color }) => (
            // 'figure.walk' is the standard SF Symbol for physical activity
            <IconSymbol size={28} name="heart.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="History"
        options={{
          title: "History",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="clock.arrow.circlepath" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
