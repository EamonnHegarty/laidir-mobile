import { useLocalSearchParams, useRouter } from "expo-router";

import { ExerciseDetail } from "@/features/exercises/exercise-detail";

export default function ExerciseDetailScreen() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  const router = useRouter();
  return (
    <ExerciseDetail
      exerciseRef={ref}
      onEdit={() => router.push({ pathname: "/exercises/form", params: { id: ref } })}
    />
  );
}
