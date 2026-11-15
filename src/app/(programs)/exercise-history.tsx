import { useLocalSearchParams } from "expo-router";

import { ExerciseDetail } from "@/features/exercises/exercise-detail";

/** Opened over the workout in progress: this exercise's records, trend and past sessions. */
export default function ExerciseHistorySheet() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  return <ExerciseDetail exerciseRef={ref} />;
}
