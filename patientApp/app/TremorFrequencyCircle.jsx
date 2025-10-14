import { Text, View } from "react-native";
import { AnimatedCircularProgress } from "react-native-circular-progress";

export default function TremorFrequencyCircle({ value = 0, threshold = 7 }) {
  // Dynamically set color based on threshold
  // You may adjust color logic as needed!
  let color =
    value < threshold * 0.7
      ? "#22c55e"
      : value < threshold
        ? "#eab308"
        : "#ef4444";

  return (
    <AnimatedCircularProgress
      size={160}
      width={14}
      fill={Math.min((value / threshold) * 100, 100)}
      tintColor={color}
      backgroundColor="#22282c"
      lineCap="round"
      rotation={0}
    >
      {() => (
        <View style={{ alignItems: "center" }}>
          <Text style={{ color: "#fff", fontSize: 28, fontWeight: "bold" }}>
            {value} Hz
          </Text>
          <Text style={{ color: "#999", fontSize: 14, marginTop: 8 }}>
            Tremor Frequency
          </Text>
        </View>
      )}
    </AnimatedCircularProgress>
  );
}
