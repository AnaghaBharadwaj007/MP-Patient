import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import "../../global.css";

export default function HomeScreen() {
  return (
    <SafeAreaView>
      <View className="bg-blue-200 font-bold">
        <Text>This is index page or first page</Text>
      </View>
    </SafeAreaView>
  );
}
