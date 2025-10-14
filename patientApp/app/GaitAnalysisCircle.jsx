import { Text, View } from "react-native";
import { AnimatedCircularProgress } from "react-native-circular-progress";

export default function GaitAnalysisCircle({ value = 0, threshold = 80 }) {
  let color =
    value >= threshold
      ? "#22c55e"
      : value >= threshold * 0.7
        ? "#eab308"
        : "#ef4444";

  return (
    <AnimatedCircularProgress
      size={160}
      width={14}
      fill={Math.min(value, 100)}
      tintColor={color}
      backgroundColor="#22282c"
      lineCap="round"
      rotation={0}
    >
      {() => (
        <View style={{ alignItems: "center" }}>
          <Text style={{ color: "#fff", fontSize: 28, fontWeight: "bold" }}>
            {value}%
          </Text>
          <Text style={{ color: "#999", fontSize: 14, marginTop: 8 }}>
            Gait Analysis
          </Text>
        </View>
      )}
    </AnimatedCircularProgress>
  );
}
