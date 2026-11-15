import { useState } from "react";
import type { TextInputProps } from "react-native";

import { Field } from "./ui";

/**
 * A number field that reports every readable value as you type (so nothing is lost if the app is
 * closed mid-set). While focused it shows exactly what was typed ("82." stays "82."); otherwise it
 * shows the stored value, so values filled in elsewhere (e.g. by ticking a set) appear.
 */
export function LiveField<T>({
  value,
  format,
  parse,
  onValue,
  ...props
}: Omit<TextInputProps, "value" | "onChangeText"> & {
  value: T | undefined;
  format: (value: T) => string;
  /** undefined = cleared, null = unreadable (ignored). */
  parse: (text: string) => T | undefined | null;
  onValue: (value: T | undefined) => void;
}) {
  const shown = value === undefined ? "" : format(value);
  const [text, setText] = useState(shown);
  const [editing, setEditing] = useState(false);

  return (
    <Field
      {...props}
      value={editing ? text : shown}
      onFocus={(e) => {
        setText(shown);
        setEditing(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setEditing(false);
        props.onBlur?.(e);
      }}
      onChangeText={(next) => {
        setText(next);
        const parsed = parse(next);
        if (parsed !== null) onValue(parsed);
      }}
      selectTextOnFocus
    />
  );
}
