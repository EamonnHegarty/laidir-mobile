import { useLocalSearchParams, useRouter } from "expo-router";

import { ExerciseDetail } from "@/features/exercises/exercise-detail";

/**
 * Opened over the workout in progress by tapping an exercise's name: what it is, records, e1RM and
 * volume trends, best sets and past sessions. ✕ or Back closes it.
 */
export default function ExerciseHistorySheet() {
  const router = useRouter();
  const { ref } = useLocalSearchParams<{ ref: string }>();
  return <ExerciseDetail exerciseRef={ref} onClose={() => router.back()} />;
}
