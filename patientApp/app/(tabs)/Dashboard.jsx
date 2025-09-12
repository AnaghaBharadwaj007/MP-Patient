import React, { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import "../../global.css";

const images = [
  require("../../assets/images/favicon.png"),
  require("../../assets/images/icon.png"),
  require("../../assets/images/react-logo.png"),
];

const windowWidth = Dimensions.get("window").width;

export default function Dashboard() {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);

  // Auto-slide images and dots
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % images.length;
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({
            x: nextIndex * windowWidth,
            animated: true,
          });
        }
        return nextIndex;
      });
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // When user swipes manually, keep state in sync
  const onScrollEnd = (event) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / windowWidth);
    setActiveIndex(index);
  };

  const handleContinue = () => {
    // Add logic here
  };

  const handleLogin = () => {
    // Add logic here
  };

  return (
    <SafeAreaView className="flex-1 bg-[#101013]">
      <Text>This is DashBoard page</Text>
    </SafeAreaView>
  );
}
