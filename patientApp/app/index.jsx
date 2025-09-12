import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const images = [
  require("../assets/images/homepage.jpg"),
  require("../assets/images/icon.png"),
  require("../assets/images/react-logo.png"),
];

const windowWidth = Dimensions.get("window").width;

export default function Index() {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollViewRef = useRef(null);

  // Animation for the pulsing effect
  const pulse = useSharedValue(1);
  const router = useRouter();

  useEffect(() => {
    // Start pulsing animation on component mount
    pulse.value = withRepeat(
      withTiming(1.05, {
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );

    // Auto-scroll logic
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
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const onScrollEnd = (event) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / windowWidth);
    setActiveIndex(index);
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: pulse.value }],
    };
  });

  const sign = () => {
    router.push("/Signin");
  };

  return (
    <SafeAreaView className="flex-1 bg-[#101013]">
      <View className="flex-1 bg-[#101013] px-6 justify-between">
        <View>
          <View className="flex-row items-center justify-between mt-4">
            <View className="flex-row items-center">
              {images.map((_, i) => (
                <View
                  key={i}
                  className={`h-2 w-2 rounded-full mx-1 ${
                    activeIndex === i
                      ? "bg-green-400 shadow-lg shadow-green-400"
                      : "bg-[#656ca9]"
                  }`}
                />
              ))}
            </View>
            {/* <Link href="/login" asChild> */}
            <TouchableOpacity
              className="px-4 py-2 bg-[#181B1F] rounded-full"
              onPress={sign}
            >
              <Text className="text-green-400 font-semibold">Login</Text>
            </TouchableOpacity>
            {/* </Link> */}
          </View>

          {/* Carousel */}
          <View className="flex items-center justify-center h-64 mt-12 mb-3">
            <ScrollView
              ref={scrollViewRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onScrollEnd}
              style={{ width: windowWidth }}
            >
              {images.map((img, idx) => (
                <View
                  key={idx}
                  style={{
                    width: windowWidth,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Animated.View
                    style={[
                      animatedStyle,
                      {
                        width: 200, // w-56
                        height: 200, // h-56
                        borderRadius: 112,
                        backgroundColor: "#101013",
                        alignItems: "center",
                        justifyContent: "center",
                        // Manual shadow for glow effect
                        shadowColor: "#4ADE80", // green-400
                        shadowOffset: {
                          width: 0,
                          height: 0,
                        },
                        shadowOpacity: 0.8,
                        shadowRadius: 10,
                        elevation: 15, // For Android
                      },
                    ]}
                  >
                    <Image
                      source={img}
                      style={{
                        width: 190,
                        height: 190,
                        borderRadius: 85,
                        resizeMode: "cover",
                      }}
                    />
                  </Animated.View>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Headline + Subtitle */}
          <Text className="text-4xl font-extrabold text-center mt-20 text-green-400">
            Monitor Your Health in Real-Time
          </Text>
          <Text className="text-base text-center text-gray-300 mt-8 mx-4">
            Connect your device to track and manage your symptoms with a
            personalized digital twin.
          </Text>
        </View>

        <View>
          <TouchableOpacity
            className="mt-8 px-8 py-4 bg-green-500 rounded-full shadow-lg"
            onPress={sign}
          >
            <Text className="text-[#101013] text-lg font-bold text-center">
              Continue
            </Text>
          </TouchableOpacity>
          <View className="mt-12 mb-4">
            <Text className="text-center text-xs text-gray-500">
              By continuing, you agree to our Terms of Service and Privacy
              Policy.
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
