import { useLocalSearchParams } from "expo-router";

import { ExerciseDetail } from "@/features/exercises/exercise-detail";

/** The exercise page inside this tab's stack, so Back comes back here. */
export default function ExerciseInTab() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  return <ExerciseDetail exerciseRef={ref} />;
}
